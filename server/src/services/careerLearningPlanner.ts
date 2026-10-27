import { getSupplementalGuidance } from '../data/careerLearningGuidance';
import { getCareerLearningTopics, LEARNING_KNOWLEDGE_HASH, LEARNING_KNOWLEDGE_VERSION, type LearningTopic } from '../data/careerLearningKnowledge';
import { getCanonicalSkillName } from './skillEvidenceIdentity';
import { SKILL_ASSESSMENT_POLICY, type assessSkillEvidence, type SkillAssessmentItem } from './skillEvidenceAssessment';
import type { ICareerKnowledgeContext } from './careerKnowledgeService';
import type { IRoadmapSectionSeed } from './roadmapPlanningService';
export const LEARNING_PLANNER_POLICY = 'foundation-planner-v1';
export type LearningAssessment = ReturnType<typeof assessSkillEvidence>;
export interface PlannedLearningNode extends LearningTopic {
    category: 'CORE_SKILLS' | 'ROLE_SKILLS'; state: SkillAssessmentItem['state'];
    score: number | null; explanation: string; verified: boolean;
}
export interface CareerLearningPlan {
    owner: string; role: string; version: string; nodes: PlannedLearningNode[];
    selected: PlannedLearningNode[]; blocked: string[]; diagnostics: string[];
}
const canonical = (value: string) => getCanonicalSkillName(value).trim();
const rank = (level: string) => ({beginner:1, intermediate:2, advanced:3, production:3, expert:3}[level] || 0);
/** Apply the B2 policy to only the question scope needed by this prerequisite. */
function scopeEvidence(topic:LearningTopic,item?:SkillAssessmentItem) {
    const scores=(item?.assessments || []).flatMap(unit=>{
        if(unit.scopeScores) {
            const rows=unit.scopeScores.filter(row=>rank(row.level)>=rank(topic.level));
            const count=rows.reduce((sum,row)=>sum+row.questionCount,0);
            return count ? [rows.reduce((sum,row)=>sum+row.score*row.questionCount,0)/count] : [];
        }
        // Legacy assessment units cannot prove a higher level from a mixed aggregate.
        return unit.levels.length && unit.levels.every(level=>rank(level)>=rank(topic.level)) ? [unit.score] : [];
    });
    const mean=scores.length ? scores.reduce((sum,score)=>sum+score,0)/scores.length : null;
    const conflicting=scores.length>1 && Math.min(...scores)<SKILL_ASSESSMENT_POLICY.gapBelow && Math.max(...scores)>=SKILL_ASSESSMENT_POLICY.strongAverage;
    let state:SkillAssessmentItem['state']=scores.length || item?.claimSources.length ? 'partial_evidence':'unverified';
    if(!conflicting && mean!==null && (scores.length===1 ? mean>=SKILL_ASSESSMENT_POLICY.strongSingle : scores.length>=SKILL_ASSESSMENT_POLICY.minimumRepeated && mean>=SKILL_ASSESSMENT_POLICY.strongAverage))state='verified_proficiency';
    else if(!conflicting && scores.length>=SKILL_ASSESSMENT_POLICY.minimumRepeated && scores.every(score=>score<SKILL_ASSESSMENT_POLICY.gapBelow))state='verified_gap';
    return {state,score:mean===null?null:Math.round(mean),verified:state==='verified_proficiency',count:scores.length};
}
function verified(topic: LearningTopic, item?: SkillAssessmentItem): boolean {
    return scopeEvidence(topic,item).verified;
}
export function getLearningCurriculum(targetRole: string, knowledge?: ICareerKnowledgeContext, assessment?: LearningAssessment): LearningTopic[] {
    const slug = knowledge?.resolvedRole?.slug || targetRole.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-');
    const curated = getCareerLearningTopics(slug);
    const stackGroups = [['React','Vue','Angular'],['React Native','Flutter','Swift','Kotlin']];
    const chosen = stackGroups.map(group => [...(assessment?.skills || [])].filter(item=>group.some(name=>canonical(name)===canonical(item.name)) && (item.state==='verified_proficiency'||item.claimSources.length>0)).sort((a,b)=>Number(b.state==='verified_proficiency')-Number(a.state==='verified_proficiency')||a.normalizedName.localeCompare(b.normalizedName))[0]?.name);
    const component=curated.find(topic=>topic.id==='react');
    if(component) {
        component.name=chosen[0] || 'Component UI Development';
        if(!chosen[0])component.exercise='Choose one component framework (React, Vue or Angular), then build a searchable list with loading, error and retry states.';
    }
    for(const topic of curated)if(topic.id==='mobile') {
        topic.exercise=chosen[1]?`Build a two-screen ${chosen[1]} app with restored navigation state.`:'Choose one mobile framework, then build a two-screen app with restored navigation state.';
    }
    const database = knowledge?.role?.topics || knowledge?.topics.map(item => item.topic) || [];
    const merged: LearningTopic[] = curated.map(topic => {
        const existing = database.find(item => canonical(item.name) === canonical(topic.name) && item.level === topic.level);
        return {...topic,guidanceSource:existing?'combined' as const:'reference-pack' as const, id: existing?.id || `learning:${slug}:${topic.id}${topic.id==='react'&&topic.name!=='React'?`:${canonical(topic.name)}`:''}`,
            subtopics: existing?.subtopics?.length ? [...existing.subtopics] : topic.subtopics,
            exercise: existing?.practicalScenarios?.[0] || topic.exercise,
            proof: [...(existing?.expectedEvidence || []),topic.proof].filter((value,index,all)=>all.indexOf(value)===index).join('. ')};
    });
    const byReference = new Map<string,string>();
    for (let index=0; index<curated.length; index++) byReference.set(curated[index].id,merged[index].id);
    for (const item of database) {
        // A role's catalogue of alternative stacks is not a list of mandatory skills.
        if(stackGroups.some((group,index)=>group.some(name=>canonical(name)===canonical(item.name)) && ((index===0 && curated.some(topic=>topic.id==='react')) || (index===1 && slug==='mobile-developer')) && canonical(item.name)!==canonical(chosen[index] || '')))continue;
        const existing = merged.find(topic => canonical(topic.name) === canonical(item.name));
        if (existing) { byReference.set(item.id,existing.id); byReference.set(canonical(item.name),existing.id); continue; }
        const supplement=getSupplementalGuidance(item.name);
        merged.push({id:item.id,name:item.name,level:rank(item.level)===1?'beginner':rank(item.level)===2?'intermediate':'advanced',
            prerequisites:[], guidanceSource:supplement?'combined':'career-knowledge',subtopics:item.subtopics?.length ? [...item.subtopics] : supplement?.subtopics || [],exercise:item.practicalScenarios?.[0] || '',proof:[...(item.expectedEvidence || []),supplement?.proof].filter(Boolean).join('. ')});
        byReference.set(item.id,item.id); byReference.set(canonical(item.name),item.id);
    }
    for (const topic of merged) byReference.set(canonical(topic.name),topic.id);
    for (const topic of merged) {
        const existing = database.find(item => item.id === topic.id);
        const refs = [...topic.prerequisites,...(existing?.prerequisites || [])];
        topic.prerequisites = [...new Set(refs.map(ref => byReference.get(ref) || byReference.get(canonical(ref)) || `unresolved:${ref}`))].sort();
        // Unconnected advanced catalogue entries need explicit role foundations, not inferred mastery.
        if (!topic.prerequisites.length && topic.level !== 'beginner' && !curated.some(item => canonical(item.name)===canonical(topic.name)))
            {
                const intermediate=merged.filter(item=>item.curated && item.level==='intermediate');
                const prerequisites=topic.level==='advanced' && intermediate.length ? intermediate : merged.filter(item=>item.level==='beginner');
                topic.prerequisites=prerequisites.length ? prerequisites.map(item=>item.id).sort() : [`unresolved:prerequisite-coverage:${topic.id}`];
            }
    }
    return merged;
}
/** Pure DAG traversal and evidence frontier. No scores are invented for unknown skills. */
export function planCareerLearning(input: {userId:string; targetRole:string; assessment?:LearningAssessment; knowledge?:ICareerKnowledgeContext; curriculum?:LearningTopic[]}): CareerLearningPlan {
    if (input.assessment && input.assessment.userId !== input.userId) throw new Error('Learning assessment owner mismatch');
    const topics = input.curriculum || getLearningCurriculum(input.targetRole,input.knowledge,input.assessment);
    const byId = new Map(topics.map(topic=>[topic.id,topic]));
    const evidence = new Map(input.assessment?.skills.map(item=>[canonical(item.name),item]) || []);
    const duplicateIds=topics.filter((topic,index)=>topics.findIndex(other=>other.id===topic.id)!==index).map(topic=>topic.id);
    const diagnostics:string[] = duplicateIds.map(id=>`Duplicate topic ID: ${id}`), order:LearningTopic[]=[], visited=new Set<string>(), active=new Set<string>(), invalid=new Set<string>(duplicateIds);
    function visit(topic:LearningTopic):boolean {
        if(active.has(topic.id)){ diagnostics.push(`Cyclic prerequisite: ${topic.id}`);invalid.add(topic.id);return false; }
        if(visited.has(topic.id))return !invalid.has(topic.id);
        active.add(topic.id);let valid=true;
        for(const ref of [...topic.prerequisites].sort()) {
            const parent=byId.get(ref);
            if(!parent){ diagnostics.push(`Unresolved prerequisite: ${ref}`);valid=false; }
            else if(!visit(parent))valid=false;
        }
        active.delete(topic.id);visited.add(topic.id);if(!valid)invalid.add(topic.id);order.push(topic);return valid;
    }
    for(const topic of [...topics].sort((a,b)=>rank(a.level)-rank(b.level)||a.id.localeCompare(b.id)))visit(topic);
    const nodes = order.map(topic=>{
        const item=evidence.get(canonical(topic.name)), scoped=scopeEvidence(topic,item),state=scoped.state;
        const explanation=state==='unverified'
            ? `${topic.name}: proficiency is unverified${item?.claimSources.length ? ' despite a profile or resume mention' : ''}; assess it before assuming a knowledge gap.`
            : state==='verified_gap' ? `${topic.name}: repeated eligible assessments show a verified gap; practice the assessed fundamentals.`
            : state==='partial_evidence' ? `${topic.name}: evidence is partial${scoped.count ? ' or conflicting' : item?.claimSources.length ? ' and claim-only' : ' outside this topic level'}; validate the uncertain areas before advancing. A mention does not verify mastery.`
            : verified(topic,item) ? `${topic.name}: assessed proficiency is supported within the recorded question scope; use a practical extension when prerequisites are supported.` : `${topic.name}: proficiency is supported only in a narrower or unspecified question scope; validate this topic level before advancing.`;
        return {...topic,category:topic.level==='beginner'?'CORE_SKILLS' as const:'ROLE_SKILLS' as const,state,score:scoped.score,explanation,verified:scoped.verified};
    });
    const blocked=nodes.filter(topic=>invalid.has(topic.id)||topic.prerequisites.some(ref=>{const parent=byId.get(ref);return !parent || !verified(parent,evidence.get(canonical(parent.name)));})).map(topic=>topic.id);
    let selected=nodes.filter(topic=>!blocked.includes(topic.id)&&!topic.verified);
    // All assessed topics can still support deliberate advanced practice without being called gaps.
    if(!selected.length)selected=nodes.filter(topic=>topic.verified&&!blocked.includes(topic.id)&&topic.level==='advanced');
    selected.sort((a,b)=>Number(b.level==='beginner')-Number(a.level==='beginner')||Number(Boolean(b.curated))-Number(Boolean(a.curated))||rank(a.level)-rank(b.level)||a.id.localeCompare(b.id));
    if(!topics.length)diagnostics.push('No role-specific learning curriculum is available');
    return {owner:input.userId,role:input.targetRole,version:`${LEARNING_PLANNER_POLICY}:${LEARNING_KNOWLEDGE_VERSION}:${LEARNING_KNOWLEDGE_HASH}`,nodes,selected,blocked,diagnostics:[...new Set(diagnostics)].sort()};
}
export function applyLearningSeeds(seeds:IRoadmapSectionSeed[], plan:CareerLearningPlan):IRoadmapSectionSeed[] {
    const result=seeds.filter(seed=>!['CORE_SKILLS','ROLE_SKILLS'].includes(seed.category));
    for(const category of ['ROLE_SKILLS','CORE_SKILLS'] as const) {
        const selected=plan.selected.filter(node=>node.category===category);
        if(!selected.length && !seeds.some(seed=>seed.category===category))continue;
        const measured=selected.filter(node=>node.score!==null).map(node=>node.score!);
        // A partial mean is not a readiness estimate for the whole section.
        result.unshift({category,readinessScore:selected.length>0 && measured.length===selected.length?Math.round(measured.reduce((a,b)=>a+b,0)/measured.length):undefined,
            completed:false,relatedSkills:selected.map(node=>node.name),evidence:selected.length?selected.map(node=>node.explanation):['Role skills are deferred until prerequisite evidence supports the next learning stage.'],source:'career_profile'});
    }
    return result.map(seed=>seed.category==='PROJECTS'?{...seed,completed:false,readinessScore:undefined,relatedSkills:plan.selected.map(node=>node.name),evidence:plan.selected.map(node=>node.explanation)}:seed);
}
