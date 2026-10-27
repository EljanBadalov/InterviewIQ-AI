import { timeGenerationStage } from './roadmapGenerationMetrics';
import { loadSkillEvidenceAssessment } from './skillEvidenceAssessmentService';
import { planCareerLearning } from './careerLearningPlanner';
import { resolveResumeContext } from './careerContextService';
import { resolveCareerInterviewContext } from './careerInterviewContextService';
import { buildCareerProgressContext } from './careerProgressService';
import { buildCareerSkillProfile } from './careerSkillProfileService';
import { getCareerJobMatches } from './careerJobContextService';
import { buildCareerKnowledgeContext } from './careerKnowledgeService';
import type { ICareerGoalInput } from './careerGoalService';
import { measureRoadmapStage } from './roadmapEvidenceScope';

/** Independent reads run together; profile/knowledge/matching keep their dependencies. */
export async function loadRoadmapEvidence(input: ICareerGoalInput & { userId: string; targetRole: string }) {
  const userId = input.userId.trim();
  let sourceFailures = 0;
  async function optional<T>(stage: string, work: () => Promise<T>): Promise<T | undefined> {
    try { return await measureRoadmapStage(stage,work); }
    catch { sourceFailures++; console.warn("[Roadmap Evidence] Optional context unavailable:", stage); return undefined; }
  }
  // Register history reads first so explicit/latest lookups can reuse the same rows.
  const progressPromise = optional('progress', async () => {
    const value = await buildCareerProgressContext(userId); return value.found ? value.data : undefined;
  });
  const resumePromise = optional('resume', async () => {
    const value = await resolveResumeContext({ userId, activeResumeId: input.activeResumeId }); return value.found ? value.data : undefined;
  });
  const interviewPromise = optional('interview', async () => {
    const value = await resolveCareerInterviewContext({ userId, activeInterviewId: input.activeInterviewId }); return value.found ? value.data : undefined;
  });
  const skillPromise = optional('skill-profile', async () => {
    const resume = await resumePromise;
    return buildCareerSkillProfile({ userId, resumeAnalysisId: resume?.id, strongestSkillLimit:25 });
  });
  const knowledgePromise = optional('knowledge', async () => {
    const profile = await skillPromise;
    return buildCareerKnowledgeContext({ targetRole: input.targetRole.trim(), userSkills: profile?.skills.map(skill => ({ name:skill.name, score:skill.skillScore, confidence:skill.confidence, verified:skill.interviewVerified, sources:skill.sources.map(String) })) || [], maxTopics:18,maxPriorityTopics:10,maxInterviewTopics:6,maxScenarios:5,includeStrongTopics:false });
  });
  const jobsPromise = optional('job-matches', async () => {
    const resume = await resumePromise;
    if (!resume) return undefined;
    const value = await getCareerJobMatches({ userId, activeResumeId:resume.id,targetRole:input.targetRole.trim(),limit:5 });
    return value.found ? value : undefined;
  });
  const assessmentPromise = optional('skill-assessment', async () => {
    const resume=await resumePromise;
    return loadSkillEvidenceAssessment({userId,resumeAnalysisId:resume?.id,reuseRoadmapSources:true});
  });
  const [resume,interview,progress,careerSkillProfile,careerKnowledge,jobMatches,assessment] = await Promise.all([resumePromise,interviewPromise,progressPromise,skillPromise,knowledgePromise,jobsPromise,assessmentPromise]);
  const learningPlan = timeGenerationStage('planner',()=>planCareerLearning({userId,targetRole:input.targetRole,assessment,knowledge:careerKnowledge}));
  return { resume,interview,progress,careerSkillProfile,careerKnowledge,jobMatches,learningPlan,narrativeSourceComplete:sourceFailures===0 };
}
