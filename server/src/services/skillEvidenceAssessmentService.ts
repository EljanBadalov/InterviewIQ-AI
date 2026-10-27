import { Types } from 'mongoose';
import { ResumeAnalysis } from '../models/resumeAnalysis';
import { UserSkillProfile } from '../models/UserSkillProfile';
import { Interview } from '../models/Interview';
import { Question } from '../models/Question';
import { readRoadmapDocument, readRoadmapEvidence, withRoadmapEvidence } from './roadmapEvidenceScope';
import { timeGenerationStage } from './roadmapGenerationMetrics';
import { assessSkillEvidence, type AssessmentInterview, type AssessmentQuestion, type AssessmentProfile, type AssessmentResume, type SkillAssessmentSnapshot } from './skillEvidenceAssessment';
export interface AssessmentClaims { owner: string; resume: AssessmentResume | null; profile: AssessmentProfile | null }
/** Read-only claims. Mentions remain unverified; the latest-resume selector is unchanged. */
export async function loadAssessmentClaims(userId: string): Promise<AssessmentClaims> {
    if (!Types.ObjectId.isValid(userId)) throw new Error('A valid skill assessment owner is required');
    const owner = String(new Types.ObjectId(userId));
    const committed = (query: any) => query.read('primary').readConcern('majority').maxTimeMS(5000);
    const [resume, profile] = await Promise.all([
        committed(ResumeAnalysis.findOne({user:new Types.ObjectId(owner)}).sort({createdAt:-1,_id:-1}).select('_id user skillsDetected updatedAt')).lean(),
        committed(UserSkillProfile.findOne({user:new Types.ObjectId(owner)})).lean(),
    ]);
    for (const row of [resume,profile]) if(row && String(row.user)!==owner) throw new Error('Skill assessment source owner mismatch');
    return {owner,resume,profile};
}
const preparedIds = new WeakMap<object,number>();
let preparedSequence = 0;
function preparedKey(value?: object) {
    if(!value) return 'database';
    if(!preparedIds.has(value)) preparedIds.set(value,++preparedSequence);
    return String(preparedIds.get(value));
}
export interface SkillAssessmentRequest { userId: string; resumeAnalysisId?: string; requiredSkills?: readonly string[]; reuseRoadmapSources?: boolean; preparedClaims?: AssessmentClaims; preparedAssessment?: {interviews:AssessmentInterview[];questions:AssessmentQuestion[]} }
/** Narrow, owned snapshots only. No notes, answer text, report text or write methods. */
export async function loadSkillEvidenceAssessment(input: SkillAssessmentRequest) {
    if (!Types.ObjectId.isValid(input.userId)) throw new Error('A valid skill assessment owner is required');
    if (input.resumeAnalysisId && !Types.ObjectId.isValid(input.resumeAnalysisId)) throw new Error('A valid resume reference is required');
    const owner = String(new Types.ObjectId(input.userId));
    const resumeId = input.resumeAnalysisId ? String(new Types.ObjectId(input.resumeAnalysisId)) : undefined;
    return withRoadmapEvidence(owner, async () => {
        if(input.preparedClaims && (input.preparedClaims.owner!==owner || resumeId)) throw new Error('Prepared claim selector or owner mismatch');
        const source = await readRoadmapEvidence(owner, `skill-assessment-snapshot:v1:${resumeId || 'latest'}:${Boolean(input.reuseRoadmapSources)}:${preparedKey(input.preparedAssessment)}:${preparedKey(input.preparedClaims)}`, async () => {
            const committed = (query: any) => query.read('primary').readConcern('majority').maxTimeMS(5000);
            const loadResume = () => committed(ResumeAnalysis.findOne({ user: new Types.ObjectId(owner),
                ...(resumeId ? { _id: new Types.ObjectId(resumeId) } : {})
            }).sort({createdAt:-1,_id:-1}).select('_id user skillsDetected updatedAt')).lean() as Promise<AssessmentResume | null>;
            const loadProfile = () => {
                const query=committed(UserSkillProfile.findOne({user:new Types.ObjectId(owner)}));
                if(!input.reuseRoadmapSources)query.select('user skills.name skills.sources skills.evidence.source skills.evidence.sourceId');
                return query.lean() as Promise<AssessmentProfile | null>;
            };
            const [resume, profile, interviews] = await Promise.all([
                input.preparedClaims ? Promise.resolve(input.preparedClaims.resume) : input.reuseRoadmapSources ? readRoadmapDocument(owner,'resume',resumeId ? {id:resumeId} : {latest:true},loadResume) : loadResume(),
                input.preparedClaims ? Promise.resolve(input.preparedClaims.profile) : input.reuseRoadmapSources ? readRoadmapEvidence(owner,'skill-profile:raw',loadProfile) : loadProfile(),
                input.preparedAssessment ? Promise.resolve(input.preparedAssessment.interviews) : committed(Interview.find({ user: new Types.ObjectId(owner), status: 'completed', interviewType: 'technical' }).select('_id user status interviewType completedAt answers.question answers.score answers.technicalAccuracy answers.evaluationStatus')).lean() as Promise<AssessmentInterview[]>,
            ]);
            for (const row of [resume, profile, ...interviews]) if (row && String(row.user) !== owner) throw new Error('Skill assessment source owner mismatch');
            const ids = [...new Set(interviews.flatMap(row => row.answers.map(answer => String(answer.question))))].filter(id => Types.ObjectId.isValid(id));
            const questions: AssessmentQuestion[] = input.preparedAssessment ? input.preparedAssessment.questions : ids.length ? await committed(Question.find({ _id: { $in: ids.map(id => new Types.ObjectId(id)) } }).select('_id tags interviewType difficulty updatedAt')).lean() : [];
            return { userId: owner, resume, profile, interviews, questions } satisfies SkillAssessmentSnapshot;
        });
        return timeGenerationStage('planner', () => assessSkillEvidence({ ...source, requiredSkills: input.requiredSkills, includeScopeScores:input.reuseRoadmapSources }));
    });
}
