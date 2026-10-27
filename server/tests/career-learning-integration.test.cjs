const test=require('node:test'),assert=require('node:assert/strict');
const f=require('./phase4d-generation-fixture.cjs'),owner=String(f.ownerA);
const {getLearningCurriculum,planCareerLearning}=f.load('services/careerLearningPlanner');
const {assessSkillEvidence}=f.load('services/skillEvidenceAssessment');
const n=f.load('services/roadmapNarrativeService');
const {loadRoadmapEvidence}=f.load('services/roadmapEvidenceService');
const {withRoadmapEvidence}=f.load('services/roadmapEvidenceScope');
const Question=f.load('models/Question').Question;
const originalInterviews=f.clone(f.interviews),questions=Question.find;
test.beforeEach(()=>{f.reset();f.interviews.splice(0,f.interviews.length,...f.clone(originalInterviews));Question.find=questions;});
test.afterEach(()=>{f.interviews.splice(0,f.interviews.length,...f.clone(originalInterviews));Question.find=questions;});
test('create persists specific foundations, defers advanced skills, and excludes deterministic guidance from Qwen',async()=>{
 const result=await f.service.createCareerAutomation(f.input());await result.validate();
 const core=result.roadmap.find(m=>m.category==='CORE_SKILLS'),role=result.roadmap.find(m=>m.category==='ROLE_SKILLS');
 assert.equal(core.readinessScore,undefined);assert.ok(core.recommendations.length>0);assert.equal(role.recommendations.length,0);
 assert.ok(core.metadata.roadmapNarrative.nodes.every(node=>node.learning&&node.learning.score===null&&!node.ai));
 assert.ok(core.recommendations.every(node=>node.whatToLearn.length>=2&&!node.action.startsWith('Current:')));
 const metric=f.narrativeMetrics.at(-1);assert.equal(metric.deterministicNodes,6);assert.equal(metric.generatedNodes,6);assert.equal(f.inference.calls.length,1);
 assert.equal(f.counters.queries.filter(q=>q.model==='skills').length,1);assert.equal(f.counters.queries.filter(q=>q.model==='resumes').length,1);
});
test('skill-only explicit narrative request uses no Qwen and keeps real completion checks',async()=>{
 const result=await n.generateRoadmapNarratives({userId:owner,targetRole:'Mobile Developer',gaps:[],sourceComplete:true,learningPlan:planCareerLearning({userId:owner,targetRole:'Mobile Developer'}),previous:{userId:owner,targetRole:'Mobile Developer',roadmap:[]}});
 assert.equal(f.inference.calls.length,0);assert.ok(result.flatMap(m=>m.recommendations).every(r=>r.proofOfCompletion.length>35));assert.equal(n.getRoadmapNarrativeMetrics(result).fallbackNodes,0);
});
test('owned snapshot evaluates older eligible sessions beyond progress latest-two history',async()=>{
 const sql=f.id(9901);Question.find=filter=>new f.Query('questions',[{_id:sql,tags:['SQL'],difficulty:'beginner',interviewType:'technical',updatedAt:new Date('2025-01-01')}],filter);
 f.interviews.push(...[1,2].map((i)=>({_id:f.id(9910+i),user:f.ownerA,status:'completed',interviewType:'technical',completedAt:new Date(`2025-02-0${i}`),answers:[{question:sql,evaluationStatus:'completed',score:25}]})));
 const evidence=await withRoadmapEvidence(owner,()=>loadRoadmapEvidence(f.input()));
 const node=evidence.learningPlan.nodes.find(n=>n.name==='SQL');assert.equal(node.state,'verified_gap');assert.equal(node.score,25);
 const technical=f.counters.queries.filter(q=>q.model==='interviews'&&q.filter.interviewType==='technical');assert.equal(technical.length,1);assert.equal(String(technical[0].filter.user),owner);
});
test('eligible prerequisites unlock advanced nodes while completion history and public milestone IDs survive',async()=>{
 const initial=await f.service.createCareerAutomation(f.input()),ids=initial.roadmap.map(m=>m.id);
 const saved=f.store.get(owner);saved.tasks[0].status='completed';saved.tasks[0].completedAt=new Date('2026-02-01');const done=JSON.parse(JSON.stringify(saved.tasks[0]));
 const topics=getLearningCurriculum('Backend Developer').filter(n=>n.level!=='advanced'),catalog=[];
 topics.forEach((topic,index)=>{const id=f.id(10000+index);catalog.push({_id:id,tags:[topic.name],difficulty:topic.level,interviewType:'technical',updatedAt:new Date('2025-01-01')});f.interviews.push({_id:f.id(11000+index),user:f.ownerA,status:'completed',interviewType:'technical',completedAt:new Date('2026-02-01'),answers:[{question:id,evaluationStatus:'completed',score:95}]});});
 Question.find=filter=>new f.Query('questions',catalog,filter);f.change(owner,'roadmapEvidenceRevision');
 const result=await f.service.replanCareerAutomation({userId:owner,preserveCompletedTasks:true});
 assert.deepEqual(result.roadmap.map(m=>m.id),ids);assert.deepEqual(JSON.parse(JSON.stringify(result.tasks.find(t=>t.id===done.id))),done);
 const role=result.roadmap.find(m=>m.category==='ROLE_SKILLS');assert.ok(role.recommendations.some(r=>r.title==='Distributed Systems'));
});
test('ordinary replan receipt skips duplicate inference and all evidence re-reads',async()=>{
 await f.service.createCareerAutomation(f.input());await f.service.replanCareerAutomation({userId:owner});f.resetCounters();f.inference.calls.length=0;
 await f.service.replanCareerAutomation({userId:owner});assert.equal(f.inference.calls.length,0);assert.equal(f.counters.queries.filter(q=>['resumes','skills','interviews','questions'].includes(q.model)).length,0);assert.equal(f.counters.writes,0);
});
test('foreign records cannot become learning evidence or prompt personalization',async()=>{
 const read=f.Interview.find;f.Interview.find=filter=>new f.Query('interviews',[{_id:f.id(99999),user:f.ownerB,status:'completed',interviewType:'technical',answers:[]}],{});
 try{const evidence=await withRoadmapEvidence(owner,()=>loadRoadmapEvidence(f.input()));assert.equal(evidence.narrativeSourceComplete,false);assert.ok(evidence.learningPlan.nodes.every(n=>n.score===null));}finally{f.Interview.find=read;}
});
