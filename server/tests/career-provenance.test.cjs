const test=require('node:test'),assert=require('node:assert/strict');
const f=require('./active-career-fixture.cjs'),owner=String(f.ownerA),json=value=>JSON.parse(JSON.stringify(value));
const {roadmapContextStatus}=f.load('services/careerIntelligenceService');
test('generated provenance survives role switching without changing persisted history or starting inference',async()=>{
 await f.seed();const saved=json(f.store.get(owner));assert.equal(roadmapContextStatus(saved.roadmap,'Backend Developer').status,'current');
 const response=await f.invoke(f.controller.updateJobPreferences,{targetRole:'Mobile Developer',expectedRevision:saved.__v});assert.equal(response.statusCode,200);
 const result=await f.invoke(f.controller.getAutomation);assert.equal(result.statusCode,200);assert.equal(result.body.data.careerContext.status,'stale');assert.equal(result.body.data.careerContext.generatedForRole,'Backend Developer');assert.equal(result.body.data.careerContext.activeTargetRole,'Mobile Developer');
 assert.deepEqual(json(f.store.get(owner).roadmap),saved.roadmap);assert.deepEqual(json(f.store.get(owner).tasks),saved.tasks);assert.equal(f.inference.calls.length,0);
});
test('legacy unknown provenance is never assigned to the selected career by assumption',()=>{
 assert.equal(roadmapContextStatus([{metadata:{}}],'Mobile Developer').status,'unverified');assert.equal(roadmapContextStatus([],'Mobile Developer').status,'empty');
});
test('career selection race remains protected by the existing CAS revision',async()=>{
 await f.seed();const revision=f.store.get(owner).__v;const responses=await Promise.all(['Mobile Developer','Frontend Developer'].map(targetRole=>f.invoke(f.controller.updateJobPreferences,{targetRole,expectedRevision:revision})));
 assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,409]);assert.equal(f.inference.calls.length,0);
});
test('read endpoints reject anonymous identity without reading account data',async()=>{
 f.resetCounters();const result=await f.invoke(f.controller.getAutomation,{},null);assert.equal(result.statusCode,401);assert.equal(f.counters.queries.length,0);
});

test('cross-career rebuild retains old IDs and completed task links as historical, not current mastery',async()=>{
 await f.seed();const before=json(f.store.get(owner));f.store.get(owner).tasks[0].status='completed';const done=json(f.store.get(owner).tasks[0]);
 await f.invoke(f.controller.updateJobPreferences,{targetRole:'Mobile Developer',expectedRevision:before.__v});f.inference.calls.length=0;
 const rebuilt=await f.service.replanCareerAutomation({userId:owner,preserveCompletedTasks:true});const sections=json(rebuilt.roadmap);
 for(const old of before.roadmap){const historical=sections.find(s=>s.id===old.id);assert.ok(historical);assert.equal(historical.metadata.retainedForCompletedTasks,true);}
 assert.deepEqual(json(rebuilt.tasks.find(t=>t.id===done.id)),done);
 const current=sections.filter(s=>!s.metadata?.retainedForCompletedTasks);assert.ok(current.every(s=>s.metadata.roadmapNarrative.career.targetRole==='Mobile Developer'));assert.ok(current.every(s=>!before.roadmap.some(old=>old.id===s.id)));
 assert.equal(roadmapContextStatus(sections,'Mobile Developer').status,'current');
});

test('malformed or foreign provenance is unverified rather than a crash or ownership claim',()=>{
 assert.equal(roadmapContextStatus([{metadata:{roadmapNarrative:{career:'legacy'}}}],'Mobile Developer').status,'unverified');
 assert.equal(roadmapContextStatus([{metadata:{roadmapNarrative:{career:{targetRole:'Mobile Developer'},owner:'foreign'}}}],'Mobile Developer',owner).status,'unverified');
});
