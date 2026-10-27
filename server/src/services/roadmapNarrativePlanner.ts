import { narrativeSkillFacts, NARRATIVE_EVIDENCE_POLICY } from './roadmapNarrativeGrounding';
import type { CareerLearningPlan } from './careerLearningPlanner';
import { createHash } from 'node:crypto';
import type { ICareerGoalMilestone } from './careerGoalService';
import type { IRoadmapSectionSeed } from './roadmapPlanningService';
import { buildFallbackMilestone, buildFallbackRecommendation, getRoadmapPriorityFromReadiness, uniqueStrings } from './roadmapPlanningService';
import type { ICareerResumeContext } from './careerContextService';
import type { ICareerInterviewContext } from './careerInterviewContextService';
import type { ICareerJobMatchingResult } from './careerJobContextService';
import type { ICareerSkillProfile } from './careerSkillProfileService';
import type { ICareerKnowledgeContext } from './careerKnowledgeService';
export const NARRATIVE_POLICY = 'roadmap-text-v1';
export function stableHash(value: unknown): string {
    function canonical(item: any): any {
        if (item instanceof Date)
            return item.toISOString();
        if (Array.isArray(item))
            return item.map(canonical);
        if (item && typeof item === 'object')
            return Object.fromEntries(Object.keys(item).sort().filter(key => item[key] !== undefined).map(key => [key, canonical(item[key])]));
        return item;
    }
    return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export interface NarrativeText {
    whyItMatters: string;
    action: string;
    proofOfCompletion: string;
}
export interface NarrativeNode {
    id: string;
    version: string;
    section: number;
    label: string;
    category: IRoadmapSectionSeed['category'];
    topics: string[];
    evidence: string[];
    priority: ReturnType<typeof getRoadmapPriorityFromReadiness>;
    source: IRoadmapSectionSeed['source'];
    context: Record<string, unknown>;
    fallback: NarrativeText;
    deterministic?: boolean;
}
export interface NarrativePlannerInput {
    userId: string;
    targetRole: string;
    careerGoal?: string;
    resume?: ICareerResumeContext;
    interview?: ICareerInterviewContext;
    jobMatches?: ICareerJobMatchingResult;
    careerSkillProfile?: ICareerSkillProfile;
    careerKnowledge?: ICareerKnowledgeContext;
    knowledgeIdentity?: unknown;
    learningPlan?: CareerLearningPlan;
}
export function planNarrativeNodes(seeds: IRoadmapSectionSeed[], input: NarrativePlannerInput) {
    if(input.learningPlan && input.learningPlan.owner !== input.userId) throw new Error('Learning plan owner mismatch');
    const role = input.careerKnowledge?.resolvedRole?.slug || key(input.targetRole);
    const sourceRevisions = { resume: stableHash(input.resume || null), interview: stableHash(input.interview || null) };
    const matches = [...(input.careerKnowledge?.topics || []), ...(input.careerKnowledge?.strongTopics || [])];
    const proposals = seeds.map((seed, section) => {
        if(input.learningPlan && ['CORE_SKILLS','ROLE_SKILLS'].includes(seed.category) && !seed.relatedSkills.length) return [];
        const skills = uniqueStrings(seed.relatedSkills);
        const learning = input.learningPlan?.selected.filter(item => seed.category === 'PROJECTS' || item.category === seed.category) || [];
        let labels: string[];
        switch (seed.category) {
            case 'CORE_SKILLS':
            case 'ROLE_SKILLS':
                labels = skills;
                break;
            case 'PROJECTS':
                labels = learning.length ? learning.map(item=>`Practice: ${item.name}`) : input.careerKnowledge?.recommendedProjects?.length ? input.careerKnowledge.recommendedProjects : skills.map(skill => `${skill} portfolio evidence`);
                break;
            case 'CV':
                labels = [...(input.resume?.recommendations || []), ...(input.resume?.weaknesses || [])];
                break;
            case 'INTERVIEW':
                labels = [...(input.interview?.finalReport.improvements || []), ...(input.careerKnowledge?.interviewTopics.map(topic => topic.title) || [])];
                break;
            case 'JOB_SEARCH':
                labels = ['Prepare a targeted application'];
                break;
        }
        if (!labels.length)
            labels = [buildFallbackRecommendation(seed, input.targetRole).title];
        const group = uniqueStrings(labels).slice(0, 3).map(label => {
            const guidance = learning.find(item => item.name === label || `Practice: ${item.name}` === label);
            const match = matches.find(item => key(item.topic.name) === key(label));
            const selectedSkills = (['CORE_SKILLS', 'ROLE_SKILLS', 'CV', 'INTERVIEW'].includes(seed.category)) ? [label] : skills.slice(0, 3);
            const facts=narrativeSkillFacts(selectedSkills,input.learningPlan,input.careerSkillProfile,!['CV','INTERVIEW'].includes(seed.category));
            const topics = uniqueStrings(guidance ? guidance.subtopics : match?.topic.subtopics.length ? match.topic.subtopics : selectedSkills.length ? selectedSkills : [label]).slice(0, 6);
            const evidence = guidance ? [guidance.explanation, `Prerequisites: ${guidance.prerequisites.length ? 'supported by eligible assessment scope' : 'foundation topic; no prerequisites'}.`] : (seed.category === 'CORE_SKILLS' || seed.category === 'ROLE_SKILLS') ? [match?.reason || `Target-role skill: ${label}.`, ...facts.map(item => `${item.name}: ${item.state} at ${item.scope}; ${item.proficiency===null?'proficiency unverified':'assessed score '+item.proficiency}.`)] : seed.evidence;
            const context: Record<string, unknown> = { role: input.targetRole, goal: input.careerGoal || '', knowledge: input.knowledgeIdentity, topic: match?.topic, ...(guidance?{skillEvidence:[]}:{evidencePolicy:NARRATIVE_EVIDENCE_POLICY,skillFacts:facts}), ...(guidance ? {learning:{version:input.learningPlan!.version,id:guidance.id,state:guidance.state,score:guidance.score,guidanceSource:guidance.guidanceSource || 'career-knowledge',knowledge:input.knowledgeIdentity,prerequisites:guidance.prerequisites,exercise:guidance.exercise,proof:guidance.proof}} : {}) };
            if (seed.category === 'CV')
                context.resume = { summary: input.resume?.summary, documentQualityScores: [input.resume?.overallScore, input.resume?.atsScore, input.resume?.contentScore, input.resume?.skillsScore], weaknesses: input.resume?.weaknesses, recommendations: input.resume?.recommendations };
            if (seed.category === 'INTERVIEW')
                context.interview = { evidenceKind:'interview-observation', overallAssessmentScore: input.interview?.overallScore, report: input.interview?.finalReport, technical: input.interview?.averageTechnicalAccuracy, completeness: input.interview?.averageCompleteness, communication: input.interview?.averageCommunication };
            if (seed.category === 'PROJECTS')
                context.projects = { label, scenarios: input.careerKnowledge?.practicalScenarios.filter(item => item.skillsTested.some(skill => selectedSkills.some(selected => key(skill) === key(selected)))) };
            if (seed.category === 'JOB_SEARCH')
                context.jobs = input.jobMatches;
            const fallback = buildFallbackRecommendation({ ...seed, relatedSkills: selectedSkills, evidence }, input.targetRole);
            const semantic = { role, category: seed.category, topic: guidance?.id || match?.topic.id || key(label) };
            const id = `n_${stableHash(semantic).slice(0, 20)}`;
            // Structural priority/status/dates are deliberately excluded from AI text.
            const version = stableHash({ policy: NARRATIVE_POLICY, semantic, label, topics, evidence, context, sourceRevision: seed.category === 'CV' ? sourceRevisions.resume : seed.category === 'INTERVIEW' ? sourceRevisions.interview : undefined });
            return { id, version, section, label, category: seed.category, topics, evidence, context, deterministic:Boolean(guidance?.exercise && guidance.proof && topics.length), priority: guidance ? (guidance.level==='beginner' && !guidance.verified ? 'high' : getRoadmapPriorityFromReadiness(guidance.score ?? undefined)) : getRoadmapPriorityFromReadiness(match?.readinessScore ?? seed.readinessScore), source: seed.source, fallback: { whyItMatters: guidance?.explanation || fallback.whyItMatters, action: guidance?.exercise || fallback.action, proofOfCompletion: guidance?.proof || fallback.proofOfCompletion || 'Keep a documented, working example.' } } satisfies NarrativeNode;
        });
        if (group.length === 1 && !learning.length) {
            const first = group[0];
            group.push({ ...first, id: `n_${stableHash([first.id, 'verification']).slice(0, 20)}`, version: stableHash([first.version, 'verification']), label: `Validate and document: ${first.label}`, context: { ...first.context, intent: 'verification' }, fallback: { whyItMatters: first.fallback.whyItMatters, action: `Validate ${first.label} using a focused example and record the checks or review feedback.`, proofOfCompletion: 'Keep the working example, checks and a short explanation of the result.' } });
        }
        return group;
    });
    // Keep every section represented before spending the remaining bounded budget.
    const nodes: NarrativeNode[] = [];
    for (let level = 0; level < 3; level++)
        for (const group of proposals)
            if (group[level] && nodes.length < 18 && !nodes.some(node => node.id === group[level].id))
                nodes.push(group[level]);
    nodes.sort((a, b) => a.section - b.section);
    return { nodes, sections: seeds.map((seed, index) => {
        const section=buildFallbackMilestone(seed,input.targetRole,index+1);
        if(input.learningPlan && ['CORE_SKILLS','ROLE_SKILLS'].includes(seed.category)) {
            section.title=!seed.relatedSkills.length?'Role skills await prerequisite evidence':seed.category==='CORE_SKILLS'?'Validate and strengthen foundational skills':'Develop prerequisite-ready role skills';
            section.description=seed.evidence[0] || section.description;
        }
        return section;
    }) };
}
export function applyNodeText(sections: ICareerGoalMilestone[], nodes: NarrativeNode[], text: Map<string, {
    text: NarrativeText;
    ai: boolean;
}>) {
    return sections.map((section, index) => {
        const selected = nodes.filter(node => node.section === index);
        return { ...section, recommendations: selected.map(node => {
                const value = text.get(node.id);
                return { title: node.label, whyItMatters: (value?.text || node.fallback).whyItMatters, whatToLearn: node.topics, action: (value?.text || node.fallback).action, proofOfCompletion: (value?.text || node.fallback).proofOfCompletion, priority: node.priority, source: node.source, evidence: node.evidence };
            }), generatedBy: selected.some(node => text.get(node.id)?.ai) ? 'qwen' as const : 'fallback' as const };
    });
}
