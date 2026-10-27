import { createHash } from 'node:crypto';
import { getCanonicalSkillName } from './skillEvidenceIdentity';
import { readActiveCareerSource, resolveActiveCareer, type ActiveCareer } from './activeCareerService';
import { buildCareerKnowledgeContext } from './careerKnowledgeService';
import { loadAssessmentClaims, loadSkillEvidenceAssessment, type AssessmentClaims } from './skillEvidenceAssessmentService';
import { planCareerLearning } from './careerLearningPlanner';
import type { AssessmentInterview, AssessmentQuestion } from './skillEvidenceAssessment';
export const careerRoleKey = (role:string) => role.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-');
export function roadmapContextStatus(roadmap: readonly any[], targetRole:string, owner?:string) {
    const active=roadmap.filter(section=>!section.metadata?.retainedForCompletedTasks);
    const contexts=active.map(section=>section.metadata?.roadmapNarrative?.career);
    const known=contexts.filter(context=>context && typeof context.targetRole==='string' && context.targetRole.trim());
    const expectedOwner=owner?createHash('sha256').update(JSON.stringify(owner.trim().toLowerCase())).digest('hex'):undefined;
    const ownerMismatch=expectedOwner && active.some(section=>section.metadata?.roadmapNarrative?.owner!==expectedOwner);
    const status=!active.length?'empty':ownerMismatch?'unverified':known.length!==active.length?'unverified':known.every(c=>careerRoleKey(c.targetRole)===careerRoleKey(targetRole))?'current':'stale';
    return {status,activeTargetRole:targetRole,generatedForRole:known[0]?.targetRole || null};
}
/** Account default never rewrites an explicit conversation topic or preference. */
export function conversationCareerContext(context:any, active:ActiveCareer|null) {
    return {...context,targetRole:context.targetRole || active?.targetRole,
        metadata:{...context.metadata,activeCareer:active}};
}
/** Parallel reads are outside transactions and remain scoped to the authenticated owner. */
export async function prepareActiveRoleProgress(userId:string) {
    const sourcePromise=readActiveCareerSource(userId);
    const careerPromise=sourcePromise.then(source=>resolveActiveCareer(userId,source));
    const [career,claims,knowledge]=await Promise.all([
        careerPromise, sourcePromise.then(source=>source && ['active','paused'].includes(source.status)?loadAssessmentClaims(userId):{owner:userId,resume:null,profile:null}),
        sourcePromise.then(source=>source && ['active','paused'].includes(source.status)?buildCareerKnowledgeContext({targetRole:source.targetRole,userSkills:[]}):null),
    ]);
    return {career,claims,knowledge,source:await sourcePromise};
}
export async function buildActiveRoleProgress(userId:string, prepared?:{interviews:AssessmentInterview[];questions:AssessmentQuestion[]}, active?:ActiveCareer|null, frame?:{claims:AssessmentClaims;knowledge:Awaited<ReturnType<typeof buildCareerKnowledgeContext>>|null}) {
    const career=active===undefined?await resolveActiveCareer(userId):active;
    if(!career)return null;
    const [knowledge,assessment]=await Promise.all([
        frame?.knowledge ? Promise.resolve(frame.knowledge) : buildCareerKnowledgeContext({targetRole:career.targetRole,userSkills:[]}),
        loadSkillEvidenceAssessment({userId,preparedAssessment:prepared,reuseRoadmapSources:true,preparedClaims:frame?.claims})
    ]);
    const plan=planCareerLearning({userId,targetRole:career.targetRole,knowledge,assessment});
    const evidence=new Map(assessment.skills.map(item=>[item.normalizedName,item]));
    const proofFor=(name:string)=>evidence.get(getCanonicalSkillName(name).trim());
    const skills=plan.nodes.map(node=>({id:node.id,name:node.name,kind:node.category==='CORE_SKILLS'?'core' as const:'role' as const,
        // A partial answer is not a verified proficiency percentage.
        score:node.state==='verified_proficiency'||node.state==='verified_gap'?node.score:null,
        assessmentScore:node.score,evidenceState:node.state,
        status:node.state==='verified_proficiency'?'strong':node.state==='verified_gap'?'beginner':'not_assessed',
        confidence:null,evidenceCount:proofFor(node.name)?.eligibleAnswerCount || 0,
        sources:proofFor(node.name)?.claimSources || [],
        interviewVerified:node.state==='verified_proficiency',presentInResume:Boolean(proofFor(node.name)?.claimSources.includes('resume')),
        level:node.level,reason:node.explanation,prerequisiteStatus:plan.blocked.includes(node.id)?'blocked':'ready'}));
    const measured=skills.filter(skill=>skill.score!==null),strong=skills.filter(skill=>skill.evidenceState==='verified_proficiency');
    const average=measured.length?Math.round(measured.reduce((n,s)=>n+s.score!,0)/measured.length):null;
    return {targetRole:career.targetRole,roleTitle:career.targetRole,activeCareer:career,
        roleReadiness:measured.length===skills.length&&skills.length?average:null,assessedAverage:average,
        coveragePercent:skills.length?Math.round(measured.length/skills.length*100):0,totalSkills:skills.length,assessedSkills:measured.length,
        strongSkills:strong.length,priorityGaps:skills.filter(s=>s.evidenceState==='verified_gap').length,
        strongestSkills:strong,focusSkills:skills.filter(s=>s.evidenceState!=='verified_proficiency').slice(0,8),notAssessedCount:skills.filter(s=>s.score===null).length,
        skills,coverage:plan.diagnostics,assessmentPolicy:assessment.policyVersion,evidenceVersion:assessment.evidenceVersion};
}
