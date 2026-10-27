import { createHash } from 'node:crypto';
import { getCanonicalSkillName, getDisplaySkillName, isUsableSkill } from './skillEvidenceIdentity';

export const SKILL_ASSESSMENT_POLICY = Object.freeze({ version: 'skill-evidence-v1', strongSingle: 90, strongAverage: 80, gapBelow: 40, minimumRepeated: 2 });
export type SkillEvidenceState = 'verified_proficiency' | 'partial_evidence' | 'unverified' | 'verified_gap';
type Id = unknown;
export interface AssessmentAnswer { question: Id; evaluationStatus: string; score?: unknown; technicalAccuracy?: unknown }
export interface AssessmentInterview { _id?: Id; user: Id; status: string; interviewType?: string; completedAt?: unknown; answers: readonly AssessmentAnswer[] }
export interface AssessmentQuestion { _id?: Id; interviewType: string; tags?: readonly string[]; difficulty?: string; updatedAt?: unknown }
export interface AssessmentProfile { user: Id; skills: readonly { name: string; evidence?: readonly { source: string; sourceId?: Id }[]; sources?: readonly string[] }[] }
export interface AssessmentResume { _id?: Id; user: Id; skillsDetected?: readonly string[]; updatedAt?: unknown }
export interface SkillAssessmentSnapshot {
    userId: string;
    includeScopeScores?: boolean;
    requiredSkills?: readonly string[];
    resume?: AssessmentResume | null;
    profile?: AssessmentProfile | null;
    interviews: readonly AssessmentInterview[];
    questions: readonly AssessmentQuestion[];
}
export interface SkillAssessmentUnit { source: 'completed-interview'; sourceId: string; score: number; questionCount: number; levels: string[]; scopeScores?: {level:string; score:number; questionCount:number}[] }
export interface SkillAssessmentItem {
    name: string; normalizedName: string; state: SkillEvidenceState; score: number | null;
    eligibleAnswerCount: number; independentAssessmentCount: number;
    claimSources: string[]; assessments: SkillAssessmentUnit[];
    reason: 'no_eligible_evidence' | 'claim_only' | 'insufficient_assessments' | 'conflicting_results' | 'assessed_proficiency' | 'repeated_assessed_gap';
}
const id = (value: Id) => value == null ? '' : String(value).trim().toLowerCase();
const finiteScore = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
const timestamp = (value: unknown): number | null => {
    if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') return null;
    const parsed = new Date(value).getTime(); return Number.isFinite(parsed) ? parsed : null;
};
/** Invalid model output must not become persisted synthetic assessment scores. */
export function requireInterviewScoreFields(value: Record<string, unknown>): void {
    for (const key of ['score', 'technicalAccuracy', 'completeness', 'communication'])
        if (!finiteScore(value[key])) throw new Error('Interview assessment contains missing or invalid numeric scores');
}
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const round = (value: number) => Math.round(value);
const canonical = (value: string) => getCanonicalSkillName(value).trim();
const metadataTags = new Set(['beginner', 'intermediate', 'advanced', 'senior', 'expert', 'question']);
const tags = (values: readonly string[] = []) => [...new Set((Array.isArray(values) ? values : []).filter(value => typeof value === 'string' && isUsableSkill(canonical(value)) && !metadataTags.has(canonical(value))).map(canonical))].sort();
const sameOwner = (owner: string, value: { user: Id }) => { if (id(value.user) !== owner) throw new Error('Skill assessment source owner mismatch'); };
/** Score is measured only: resume/manual/source labels cannot establish mastery. */
export function assessSkillEvidence(input: SkillAssessmentSnapshot) {
    const owner = id(input.userId);
    if (!owner) throw new Error('Skill assessment owner is required');
    if (input.resume) sameOwner(owner, input.resume);
    if (input.profile) sameOwner(owner, input.profile);
    for (const interview of input.interviews) sameOwner(owner, interview);
    type Bucket = { name: string; claims: Set<string>; units: Map<string, Map<string, { score: number; level?: string }>>; blocked: Set<string> };
    const skills = new Map<string, Bucket>();
    const skill = (name: string): Bucket | undefined => {
        if (typeof name !== 'string' || !name.trim()) return;
        const key = canonical(name), display = getDisplaySkillName(name);
        let value = skills.get(key);
        if (!value) { value = { name: display, claims: new Set(), units: new Map(), blocked: new Set() }; skills.set(key, value); }
        else if (display < value.name) value.name = display;
        return value;
    };
    for (const name of input.requiredSkills || []) skill(name);
    for (const name of input.resume?.skillsDetected || []) if (typeof name === 'string' && isUsableSkill(canonical(name))) skill(name)?.claims.add('resume');
    for (const item of input.profile?.skills || []) {
        const bucket = typeof item.name === 'string' && isUsableSkill(canonical(item.name)) ? skill(item.name) : undefined;
        if (!bucket) continue;
        // A legacy aggregate or a self-declared source is a claim, never a second sample.
        for (const source of [...(item.sources || []), ...(item.evidence || []).map(row => row.source)]) if (typeof source === 'string') bucket.claims.add(source);
        if (!bucket.claims.size) bucket.claims.add('profile');
    }
    const questions = new Map<string, { skills: string[]; type: string; level?: string; updatedAt: number | null }>();
    for (const row of input.questions) {
        if (!id(row._id)) continue;
        const value = { skills: tags(row.tags), type: row.interviewType, level: row.difficulty, updatedAt: timestamp(row.updatedAt) };
        const previous = questions.get(id(row._id));
        if (previous && JSON.stringify(previous) !== JSON.stringify(value)) throw new Error('Conflicting skill assessment question snapshots');
        questions.set(id(row._id), value);
    }
    const interviewStatus = new Map<string, string>();
    const completionTimes = new Map<string, number | null>();
    for (const row of input.interviews) {
        if (!id(row._id)) continue;
        const previous = interviewStatus.get(id(row._id));
        const statusSignature = JSON.stringify([row.status, row.interviewType]);
        if (previous && previous !== statusSignature) throw new Error('Conflicting skill assessment interview snapshots');
        interviewStatus.set(id(row._id), statusSignature);
        const completedAt = timestamp(row.completedAt);
        if (completionTimes.has(id(row._id)) && completionTimes.get(id(row._id)) !== completedAt) throw new Error('Conflicting skill assessment completion times');
        completionTimes.set(id(row._id), completedAt);
    }
    // Gather every attempt before checking eligibility; conflicting duplicates fail closed.
    const answers = new Map<string, { interview: string; question: string; variants: Map<string, AssessmentAnswer> }>();
    for (const row of input.interviews) {
        if (row.status !== 'completed' || row.interviewType !== 'technical' || !id(row._id)) continue;
        for (const answer of row.answers) {
            if (!id(answer.question)) continue;
            const key = JSON.stringify([id(row._id), id(answer.question)]);
            let group = answers.get(key);
            if (!group) { group = { interview: id(row._id), question: id(answer.question), variants: new Map() }; answers.set(key, group); }
            const signature = JSON.stringify([answer.evaluationStatus, typeof answer.score, String(answer.score), typeof answer.technicalAccuracy, String(answer.technicalAccuracy)]);
            group.variants.set(signature, answer);
        }
    }
    let ambiguousAnswers = 0, rejectedAnswers = 0;
    for (const group of answers.values()) {
        const question = questions.get(group.question);
        if (!question || question.type !== 'technical') { rejectedAnswers++; continue; }
        const completedAt = completionTimes.get(group.interview);
        if (completedAt != null && question.updatedAt != null && question.updatedAt > completedAt) { rejectedAnswers++; continue; }
        if (group.variants.size !== 1) {
            ambiguousAnswers++;
            for (const name of question.skills) { const bucket = skill(name)!; bucket.blocked.add(group.interview); bucket.claims.add('ambiguous-assessment'); }
            continue;
        }
        const answer = group.variants.values().next().value!;
        if (answer.evaluationStatus !== 'completed' || !finiteScore(answer.score) || (answer.technicalAccuracy !== undefined && !finiteScore(answer.technicalAccuracy))) { rejectedAnswers++; continue; }
        // Same valid per-question weighting as legacy ingestion, without rolling means.
        const score = answer.technicalAccuracy === undefined ? round(answer.score) : round(round(answer.score) * .4 + round(answer.technicalAccuracy as number) * .6);
        for (const name of question.skills) {
            const bucket = skill(name)!;
            let unit = bucket.units.get(group.interview);
            if (!unit) { unit = new Map(); bucket.units.set(group.interview, unit); }
            unit.set(group.question, { score, level: question.level });
        }
    }
    const items: SkillAssessmentItem[] = [...skills.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([normalizedName, bucket]) => {
        const assessments: SkillAssessmentUnit[] = [...bucket.units.entries()].filter(([key]) => !bucket.blocked.has(key)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([sourceId, samples]) => {
            const rows = [...samples.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, value]) => value);
            const levels=[...new Set(rows.flatMap(row=>row.level?[row.level]:[]))].sort();
            const scopeScores=input.includeScopeScores ? levels.map(level=>{
                const scoped=rows.filter(row=>row.level===level);
                return {level,score:average(scoped.map(row=>row.score)),questionCount:scoped.length};
            }) : undefined;
            return { source: 'completed-interview', sourceId, score: average(rows.map(row => row.score)), questionCount: rows.length, levels,
                ...(scopeScores ? {scopeScores} : {}) };
        });
        const count = assessments.length, scores = assessments.map(row => row.score), mean = count ? average(scores) : null;
        const contradictory = count > 1 && Math.min(...scores) < SKILL_ASSESSMENT_POLICY.gapBelow && Math.max(...scores) >= SKILL_ASSESSMENT_POLICY.strongAverage;
        let state: SkillEvidenceState = count || bucket.claims.size ? 'partial_evidence' : 'unverified';
        let reason: SkillAssessmentItem['reason'] = count ? 'insufficient_assessments' : bucket.claims.size ? 'claim_only' : 'no_eligible_evidence';
        if (contradictory) reason = 'conflicting_results';
        else if (mean !== null && (count === 1 ? mean >= SKILL_ASSESSMENT_POLICY.strongSingle : count >= SKILL_ASSESSMENT_POLICY.minimumRepeated && mean >= SKILL_ASSESSMENT_POLICY.strongAverage)) { state = 'verified_proficiency'; reason = 'assessed_proficiency'; }
        else if (count >= SKILL_ASSESSMENT_POLICY.minimumRepeated && scores.every(score => score < SKILL_ASSESSMENT_POLICY.gapBelow)) { state = 'verified_gap'; reason = 'repeated_assessed_gap'; }
        return { name: bucket.name, normalizedName, state, score: mean === null ? null : round(mean), eligibleAnswerCount: assessments.reduce((sum, row) => sum + row.questionCount, 0), independentAssessmentCount: count, claimSources: [...bucket.claims].sort(), assessments, reason };
    });
    const version = createHash('sha256').update(JSON.stringify({ policy: SKILL_ASSESSMENT_POLICY, owner, resume: input.resume ? [id(input.resume._id), timestamp(input.resume.updatedAt)] : null, skills: items })).digest('hex');
    return { userId: owner, policyVersion: SKILL_ASSESSMENT_POLICY.version, evidenceVersion: version, skills: items, diagnostics: { ambiguousAnswers, rejectedAnswers } };
}
