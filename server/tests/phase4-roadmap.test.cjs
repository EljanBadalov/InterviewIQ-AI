const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const f=require('./phase4-roadmap-fixture.cjs');
const benchmark=require('./phase4-roadmap-benchmark.cjs');
const scope=f.load('services/roadmapEvidenceScope');
const next=f.load('services/careerNextStepsService');
const resume=f.load('services/careerContextService');
const interview=f.load('services/careerInterviewContextService');
const profile=f.load('services/careerSkillProfileService');
const progress=f.load('services/careerProgressService');
const planner=f.load('services/roadmapPlanningService');
const automationPlanner=f.load('services/roadmapAutomationPlanner');
const baseline=JSON.parse(fs.readFileSync(path.resolve(__dirname,'fixtures/phase4ab/golden-before.json')));
const seed=JSON.parse(fs.readFileSync(path.resolve(__dirname,'fixtures/phase4ab/seed-before.json')));
const owner=String(f.ownerA), other=String(f.ownerB);
const json=value=>JSON.parse(JSON.stringify(value));
// The historical goldens remain immutable evidence. Compare the stable public
// contract and persisted IDs, not AI-owned titles removed by 4C or B3 guidance.
function assertPublicContract(response, legacy, scenario) {
 assert.equal(response.statusCode,legacy.statusCode);
 assert.equal(response.body.success,legacy.body.success);
 assert.equal(response.body.message,legacy.body.message);
 assert.deepEqual(Object.keys(response.body.data).sort(),Object.keys(legacy.body.data).sort());
 const {automation,summary}=response.body.data,old=legacy.body.data.automation;
 for(const section of ['automation','summary'])for(const key of Object.keys(legacy.body.data[section]))
  assert.ok(key in response.body.data[section],`${section}.${key} is required`);
 assert.equal(String(automation.userId),owner);
 assert.equal(summary.id,automation._id);
 for(const key of ['_id','userId','status','targetRole','careerGoal','roadmapDurationDays','activeResumeId','settings','jobPreferences','createdAt','updatedAt','lastReplannedAt','lastProgressCalculatedAt'])
  assert.deepEqual(automation[key],old[key],key);
 // Independently calculate this fixture's unchanged scoring rules: resume 69,
 // best job 82, completed interview 74, one improved progress metric (+1).
 const expectedReadiness=Math.round(69*.35+82*.40+74*.25+1);
 assert.equal(automation.currentReadinessScore,expectedReadiness);
 assert.equal(summary.currentReadinessScore,expectedReadiness);
 assert.equal(summary.tasks.total,automation.tasks.length);
 const completed=automation.tasks.filter(task=>task.status==='completed');
 assert.equal(summary.tasks.completed,completed.length);
 assert.equal(summary.progress.completedTasks,completed.length);
 assert.equal(summary.progress.overallProgress,Math.round(completed.length/automation.tasks.length*100));
 assert.equal(new Set(automation.tasks.map(task=>task.id)).size,automation.tasks.length);
 const ids=new Set(automation.roadmap.map(milestone=>milestone.id));
 for(const task of automation.tasks){
  assert.ok(task.id&&task.title&&task.description);
  assert.ok(!task.roadmapMilestoneId||ids.has(task.roadmapMilestoneId),'Task must reference the returned roadmap');
  assert.ok(Number.isFinite(Date.parse(task.scheduledFor))&&Number.isFinite(Date.parse(task.dueAt)));
 }
 if(scenario!=='create')for(const [index,previous] of seed.roadmap.entries()){
  const current=automation.roadmap.find(milestone=>milestone.category===previous.category);
  assert.ok(current,previous.category);
  for(const key of ['id','targetDate'])assert.deepEqual(current[key],previous[key],key);
  // The benchmark explicitly completes the first persisted milestone on Oct 1.
  // Its original completion date must survive; old goldens reset/lost that date.
  assert.deepEqual(current.completedAt,index===0?'2026-10-01T00:00:00.000Z':previous.completedAt);
  if(index===0||previous.status==='completed')assert.equal(current.status,'completed');
 }
 if(scenario!=='create'){
  const expected=json(seed.tasks);expected[0].status='completed';expected[0].completedAt='2026-10-01T00:00:00.000Z';
  assert.deepEqual(completed,expected.filter(task=>task.status==='completed'));
 }
 return automation;
}
function assertNarrativeBudget(measured) {
 // B2 adds the eligible interview/question assessment reads. Each underlying
 // source is still bounded; the second interview query is the separate projection.
 assert.equal(measured.queries,8);
 assert.deepEqual([...measured.sources].sort(),['automations','resumes','interviews','skills','interviews','jobs','knowledge','questions'].sort());
 assert.equal(measured.writes,1);
 assert.equal(measured.qwen.length,1);
 const call=measured.qwen[0];
 assert.deepEqual({maxTokens:call.maxTokens,timeoutMs:call.timeoutMs,retries:call.retries,temperature:call.temperature,topP:call.topP},
  {maxTokens:1800,timeoutMs:300000,retries:0,temperature:.35,topP:.9});
 assert.equal(call.nodes,6);assert.equal(call.sections,3);
}
for(const name of ['create','replan','progress-refresh']) test(`${name}: preserves the historical public contract with current deterministic guidance`,async()=>{
 const measured=await benchmark.scenario(name);
 const automation=assertPublicContract(measured.response,baseline[name].freshRoadmap,name);
 assertNarrativeBudget(measured);
 const nodes=automation.roadmap.flatMap(m=>m.metadata.roadmapNarrative.nodes);
 assert.ok(nodes.some(node=>node.ai),'Valid fixture narratives must reach the result');
 assert.ok(nodes.some(node=>node.learning&&!node.ai),'Learning guidance stays deterministic');
 assert.ok(nodes.filter(node=>node.learning).every(node=>node.learning.score===null),'Claims cannot become verified proficiency');
});

test('historical contract checks reject missing fields, foreign owners and orphaned task links',async()=>{
 const measured=await benchmark.scenario('replan');
 for(const mutate of [
  response=>delete response.body.data.summary.currentReadinessScore,
  response=>response.body.data.automation.userId=other,
  response=>response.body.data.automation.tasks[0].roadmapMilestoneId='foreign-milestone',
  response=>response.body.data.automation.tasks.find(task=>task.status==='completed').id='rewritten-completion',
 ]){
  const changed=json(measured.response);mutate(changed);
  assert.throws(()=>assertPublicContract(changed,baseline.replan.freshRoadmap,'replan'));
 }
});

test('fresh narrative drives pending steps, completed legacy task stays intact',async()=>{
 f.reset();f.store.set(owner,JSON.parse(fs.readFileSync(path.resolve(__dirname,'fixtures/phase4ab/seed-before.json'))));
 const stored=f.store.get(owner);stored.tasks[0].status='completed';stored.tasks[0].completedAt=new Date('2026-10-01');const completed=json(stored.tasks[0]);
 f.inference.version='New';
 const result=await f.service.replanCareerAutomation({userId:owner,preserveCompletedTasks:true});
 assert.deepEqual(json(result.tasks.find(t=>t.id===completed.id)),completed);
 // Backend owns titles; the newly generated practical action reaches Next Steps.
 assert.ok(result.tasks.some(t=>t.status==='pending'&&t.description.startsWith('New:')));
 assert.ok(!result.tasks.some(t=>t.status==='pending'&&t.description.startsWith('Current:')));
 assert.ok(result.tasks.filter(t=>t.status==='pending').every(t=>!t.title.startsWith('New ')));
 assert.ok(result.tasks.filter(t=>t.status!=='completed').every(t=>!t.roadmapMilestoneId||result.roadmap.some(m=>m.id===t.roadmapMilestoneId)));
});
test('Career Assistant builders read owned stored actions without hidden generation',async()=>{
 await benchmark.scenario('replan');
 const stored=f.store.get(owner),calls=f.inference.calls.length,writes=f.counters.writes;
 const response=await next.buildCareerNextStepsContext({...f.input(),contextIntent:'CAREER_AUTOMATION'});
 assert.ok(response.found);
 const personalized=response.data.steps.filter(step=>step.metadata?.personalized);
 assert.ok(personalized.some(step=>step.description.startsWith('Current:')));
 for(const step of personalized){
  const milestone=stored.roadmap.find(item=>item.id===step.metadata.roadmapMilestoneId);
  assert.ok(milestone);
  assert.ok(milestone.recommendations.some(item=>item.action===step.description));
 }
 const result=await f.goal.buildCareerGoalContext(f.input(),undefined,true);
 assert.ok(result.found);assert.equal(result.data.readinessScore,76);
 assert.ok(result.data.resume&&result.data.interview&&result.data.jobMatches&&result.data.progress);
 assert.equal(f.inference.calls.length,calls);assert.equal(f.counters.writes,writes);
});

test('controllers reject missing identity without reads or inference',async()=>{
 for(const handler of [f.controller.createAutomation,f.controller.replanAutomation,f.controller.refreshAutomationProgress]){
  f.reset();const result=await f.invoke(handler,{},null);assert.equal(result.statusCode,401);assert.equal(f.counters.queries.length,0);assert.equal(f.inference.calls.length,0);
 }
});
test('scope joins identical reads, clones returned values and never persists across operations',async()=>{
 let reads=0, metrics;
 await scope.withRoadmapEvidence(owner,async()=>{
  const work=async()=>{reads++;return {skills:['SQL'],id:f.ownerA,date:new Date()};};
  const [a,b]=await Promise.all([scope.readRoadmapEvidence(owner,'same',work),scope.readRoadmapEvidence(owner,'same',work)]);
  a.skills.push('mutation');assert.deepEqual(b.skills,['SQL']);assert.equal(String(b.id),owner);assert.ok(b.date instanceof Date);
  await assert.rejects(scope.withRoadmapEvidence(other,async()=>null),/owner mismatch/);
 },value=>metrics=value);
 assert.equal(reads,1);assert.equal(metrics.reusedReads,1);
 await scope.withRoadmapEvidence(owner,()=>scope.readRoadmapEvidence(owner,'same',async()=>{reads++;return null;}));assert.equal(reads,2);
});
test('parallel owners get independent snapshots',async()=>{
 const results=await Promise.all([owner,other].map(user=>scope.withRoadmapEvidence(user,()=>scope.readRoadmapEvidence(user,'same',async()=>user))));assert.deepEqual(results,[owner,other]);
 await assert.rejects(scope.withRoadmapEvidence(owner,()=>next.buildCareerNextStepsContext(f.input(),{userId:other,roadmap:[]})),/owner mismatch/);
});
test('history aliases reuse the selected owned resume and interview without extra reads',async()=>{
 f.reset();await scope.withRoadmapEvidence(owner,async()=>{
  await progress.buildCareerProgressContext(owner);
  const before=f.counters.queries.length;
  const result=await resume.resolveResumeContext({userId:owner,activeResumeId:String(f.resumes[0]._id)});
  const byFile=await resume.resolveResumeContext({userId:owner,activeResumeId:String(f.resumes[0].fileId)});
  const selected=await interview.resolveCareerInterviewContext({userId:owner,activeInterviewId:String(f.interviews[0]._id)});
  assert.equal(result.data.id,String(f.resumes[0]._id));assert.equal(byFile.data.id,result.data.id);assert.equal(selected.data.id,String(f.interviews[0]._id));
  // fileId resolution retains its initial _id miss; its fileId hit reuses history.
  assert.equal(f.counters.queries.length-before,1);
 });
});
test('foreign resume and interview are not adopted; owner profile fallback remains owned',async()=>{
 f.reset();await scope.withRoadmapEvidence(owner,async()=>{
  await progress.buildCareerProgressContext(owner);
  const r=await resume.resolveResumeContext({userId:owner,activeResumeId:String(f.resumes[1]._id)});
  const i=await interview.resolveCareerInterviewContext({userId:owner,activeInterviewId:String(f.interviews[3]._id)});
  assert.equal(r.found,false);assert.equal(i.found,false);
  const p=await profile.buildCareerSkillProfile({userId:owner,resumeAnalysisId:f.resumes[1]._id});assert.equal(p.userId,owner);assert.equal(p.resumeAnalysisId,String(f.resumes[0]._id));
 });
});
test('an owned older selected resume outside the history window is fetched once',async()=>{
 f.reset();const old={...f.resumes[0],_id:f.id(40000),createdAt:new Date('2024-01-01'),skillsDetected:['Python']};f.resumes.push({...old,_id:f.id(40001),createdAt:new Date('2025-01-01')},old);
 try{await scope.withRoadmapEvidence(owner,async()=>{
  await progress.buildCareerProgressContext(owner);
  f.resetCounters();await resume.resolveResumeContext({userId:owner,activeResumeId:String(old._id)});await profile.buildCareerSkillProfile({userId:owner,resumeAnalysisId:old._id});
  // An older selected analysis must be read once, then shared with the profile builder.
  assert.equal(f.counters.queries.filter(q=>q.model==='resumes').length,1);
 });}finally{f.resumes.splice(-2);}
});
test('optional context failure does not prevent a valid fallback plan',async()=>{
 f.reset();const find=f.Interview.find;f.Interview.find=()=>{throw new Error('Fixture history failure');};
 try{const result=await f.service.createCareerAutomation(f.input());assert.ok(result.roadmap.length>0);assert.equal(f.counters.writes,1);}finally{f.Interview.find=find;}
});
test('Qwen unavailable retains fallback and completion semantics without changing model options',async()=>{
 f.reset();f.inference.fail=true;let metrics;const result=await scope.withRoadmapEvidence(owner,()=>f.service.createCareerAutomation(f.input()),value=>metrics=value);assert.equal(metrics.stages.find(stage=>stage.name==='qwen').success,false);assert.ok(result.roadmap.length>0);assert.ok(result.roadmap.every(m=>m.generatedBy==='fallback'));assert.equal(f.inference.calls.length,1);
});
test('failed save never updates the in-memory persisted source',async()=>{
 f.reset();const save=f.Automation.prototype.save;f.Automation.prototype.save=async()=>{throw new Error('Fixture save failed');};
 try{await assert.rejects(f.service.createCareerAutomation(f.input()),/save failed/);assert.equal(f.store.size,0);}finally{f.Automation.prototype.save=save;}
});
test('extracted planner declarations exactly preserve the baseline function bodies',()=>{
 const ts=require('../../client/node_modules/typescript');
 for(const [current,previous] of [['roadmapPlanningService','careerGoalService'],['roadmapAutomationPlanner','careerAutomationService']]){
  const source=file=>ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  const extracted=source(path.resolve(__dirname,`../src/services/${current}.ts`));
  const fingerprint=JSON.parse(fs.readFileSync(path.resolve(__dirname,'fixtures/phase4ab/planner-fingerprints.json')))[current];
  const {createHash}=require('node:crypto');
  for(const n of extracted.statements.filter(n=>!ts.isImportDeclaration(n))){
    const name=ts.isVariableStatement(n)?n.declarationList.declarations[0].name.getText(extracted):n.name?.getText(extracted);
    const text=n.getText(extracted).replace(/^export /,'').replace(/\r\n/g,'\n');
    assert.equal(createHash('sha256').update(text).digest('hex'),fingerprint[name],`${current}.${name} changed behavior`);
  }
 }
 const input={resume:{overallScore:65,atsScore:70,contentScore:60,structureScore:75,skillsScore:50,experienceScore:55}};
 assert.equal(planner.calculateReadinessScore(input),planner.calculateReadinessScore(json(input)));
 assert.equal(automationPlanner.createStableId('milestone','CORE_SKILLS-SQL',0),automationPlanner.createStableId('milestone','CORE_SKILLS-SQL',0));
});

test('operation timing observer exposes stages without personal source data',async()=>{
 f.reset();let metrics;
 await scope.withRoadmapEvidence(owner,()=>f.service.createCareerAutomation(f.input()),value=>metrics=value);
 assert.equal(metrics.stages.filter(stage=>stage.name==='qwen').length,1);
 assert.ok(metrics.reusedReads>0&&metrics.historyReuse>0);
 assert.ok(!JSON.stringify(metrics).includes(owner));
 assert.ok(metrics.stages.every(stage=>typeof stage.durationMs==='number'));
});
test('body identity cannot replace authenticated ownership for create',async()=>{
 f.reset();const result=await f.invoke(f.controller.createAutomation,{...f.input(),userId:other},f.ownerA);
 assert.equal(result.statusCode,201);assert.equal(result.body.data.automation.userId,owner);assert.ok(!f.store.has(other));
});
test('parallel operations for the same user do not share request snapshots',async()=>{
 const values=await Promise.all(['one','two'].map(value=>scope.withRoadmapEvidence(owner,()=>scope.readRoadmapEvidence(owner,'same',async()=>value))));
 assert.deepEqual(values,['one','two']);
});

test('existing create/rebuild preserves persisted IDs, completion and the public contract',async()=>{
 const measured=await benchmark.scenario('create-existing');
 const legacy=JSON.parse(fs.readFileSync(path.resolve(__dirname,'fixtures/phase4ab/existing-create-before.json'))).freshRoadmap;
 assertPublicContract(measured.response,legacy,'create-existing');
 assertNarrativeBudget(measured);
});

test('complete assessment reaches inference, partial assessment stays deterministic',async()=>{
 f.reset();const assessment=f.load('services/skillEvidenceAssessmentService'),load=assessment.loadSkillEvidenceAssessment;
 assessment.loadSkillEvidenceAssessment=async()=>{throw new Error('Fixture assessment unavailable');};
 try{
  const result=await f.service.createCareerAutomation(f.input());
  assert.equal(f.inference.calls.length,0);
  assert.ok(result.roadmap.length>0&&result.roadmap.every(m=>m.generatedBy==='fallback'));
 }finally{assessment.loadSkillEvidenceAssessment=load;}
 f.reset();await f.service.createCareerAutomation(f.input());assert.equal(f.inference.calls.length,1);
});

test('a current roadmap progress refresh reuses persisted narratives without inference',async()=>{
 f.reset();const created=await f.service.createCareerAutomation(f.input());
 const ids=created.roadmap.map(m=>m.id);
 f.load('services/roadmapNarrativeCache').clearRoadmapNarrativeCache();f.inference.calls.length=0;
 const refreshed=await f.service.refreshCareerAutomationProgress(owner);
 assert.equal(f.inference.calls.length,0);
 assert.deepEqual(refreshed.roadmap.map(m=>m.id),ids);
});

test('disabled automatic replanning does not invoke generation or save',async()=>{
 await benchmark.scenario('replan');
 const stored=f.store.get(owner);stored.settings.automaticReplanningEnabled=false;
 f.resetCounters();f.inference.calls.length=0;
 const result=await f.service.replanCareerAutomation({userId:owner});
 assert.equal(result.settings.automaticReplanningEnabled,false);assert.equal(f.counters.writes,0);assert.equal(f.inference.calls.length,0);
});
