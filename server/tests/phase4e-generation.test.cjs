const test=require('node:test'),assert=require('node:assert/strict');
const f=require('./phase4d-generation-fixture.cjs');
const m=f.load('services/roadmapGenerationMetrics');
const {compactNarrativePacket}=f.load('services/roadmapNarrativeProtocol');
const owner=String(f.ownerA),other=String(f.ownerB);
const create=who=>f.service.createCareerAutomation(f.input(who));
const replan=()=>f.service.replanCareerAutomation({userId:owner,preserveCompletedTasks:true});
const json=x=>JSON.parse(JSON.stringify(x));

test('compact transport reconstructs the exact bounded facts and canonical IDs',()=>{
 const context={skills:[],resume:{summary:'Fixture evidence '.repeat(30)},intent:undefined};
 const payload={role:'Backend Developer',goal:'Career goal',nodes:[{id:'canonical-1',category:'CV',context},{id:'canonical-2',category:'CV',context:{...context,intent:'verification'}}]};
 const packet=compactNarrativePacket(payload);
 assert.ok(Buffer.byteLength(JSON.stringify(packet))<Buffer.byteLength(JSON.stringify(payload)));
 assert.ok(packet.contexts);
 const expanded={...packet,nodes:packet.nodes.map(({contextRef,intent,...node})=>({...node,context:{...packet.contexts[contextRef],...(intent===undefined?{}:{intent})}}))};delete expanded.contexts;
 assert.deepEqual(json(expanded),json(payload));
});
test('tiny partial batch does not pay reference table overhead',()=>{
 const input={nodes:[{id:'n1',context:{intent:'verification'}}]};assert.equal(compactNarrativePacket(input),input);
});
test('metrics observe stage failures, are PII-free, and isolate concurrent operations',async()=>{
 const results=[];
 await Promise.all([1,2].map(i=>m.withGenerationMetrics('replan',async()=>{
  m.countGenerationMetric('cacheHits',i);
  await m.timeGenerationStage('planner',async()=>{await new Promise(r=>setTimeout(r,4));});
  await assert.rejects(m.timeGenerationStage('database.model',async()=>{throw new Error('PRIVATE_SECRET');}));
 },value=>results.push(value))));
 assert.deepEqual(results.map(v=>v.counters.cacheHits).sort(),[1,2]);
 for(const result of results){assert.equal(result.stages['database.model'].failures,1);assert.equal(result.success,true);assert.ok(result.totalMs>=0);assert.equal(JSON.stringify(result).includes('PRIVATE_SECRET'),false);}
 assert.notEqual(results[0].correlationId,results[1].correlationId);
});
test('telemetry observer failure cannot fail generation',async()=>{
 assert.equal(await m.withGenerationMetrics('create',async()=>42,()=>{throw new Error('sink failure');}),42);
});
test('closed metrics scopes ignore late work after request completion',async()=>{
 let release,late,snapshot;
 await m.withGenerationMetrics('create',async()=>{
  late=new Promise(r=>release=r).then(()=>m.countGenerationMetric('qwenCalls'));
 },value=>snapshot=value);
 release();await late;assert.equal(snapshot.counters.qwenCalls,undefined);
});
test('create uses one owned automation load and measures planner/cache/Qwen/commit',async()=>{
 f.reset();let snapshot;
 await m.withGenerationMetrics('create',create,value=>snapshot=value);
 const auto=f.counters.queries.filter(q=>JSON.stringify(q).includes('automations'));
 assert.equal(auto.length,1);
 assert.equal(snapshot.counters.automationReuse,1);
 for(const stage of ['database.coordination','database.evidence','planner','cache','prompt','qwen','validation','nextSteps','commit'])assert.ok(snapshot.stages[stage],stage);
 assert.equal(snapshot.counters.qwenCalls,1);assert.equal(snapshot.counters.cacheMisses,require('node:fs').existsSync(require('node:path').join(f.root,'services/careerLearningPlanner.js'))?6:13);
 for(const privateValue of [owner,other,'Fixture resume','Backend Developer'])assert.equal(JSON.stringify(snapshot).includes(privateValue),false);
});
test('working automation cannot mutate the CAS baseline or cross owner boundaries',async()=>{
 f.reset();await create();const original=f.coordination.roadmapGenerationStore.automation;
 let baseline;
 f.coordination.roadmapGenerationStore.automation=async(...args)=>{const value=await original(...args);if(!args[1])baseline=value;return value;};
 try{
  const coordinate=f.coordination.createRoadmapGenerationCoordinator();
  await coordinate(owner,'replan',{reason:'snapshot-test'},async()=>{
   await assert.rejects(f.coordination.readGenerationAutomation(other,async()=>null),e=>e.code==='GENERATION_OWNER_MISMATCH');
   const draft=await f.service.getCareerAutomation(owner);draft.targetRole='Changed working copy';
   assert.equal(baseline.targetRole,'Backend Developer');
   const oldStatus=baseline.tasks[0].status;draft.tasks[0].status='completed';assert.equal(baseline.tasks[0].status,oldStatus);
   await f.coordination.saveGeneratedAutomation(draft);
  });
  assert.equal(f.store.get(owner).targetRole,'Changed working copy');
 }finally{f.coordination.roadmapGenerationStore.automation=original;}
});
test('uncoordinated reads stay fresh instead of reusing a snapshot',async()=>{
 f.reset();await create();f.resetCounters();await f.service.getCareerAutomation(owner);f.store.get(owner).targetRole='New role';
 assert.equal((await f.service.getCareerAutomation(owner)).targetRole,'New role');assert.equal(f.counters.queries.filter(q=>JSON.stringify(q).includes('automations')).length,2);
});
test('actual usage is distinct from estimates and the inference options stay unchanged',async()=>{
 f.reset();const q=f.load('services/qwenService'),original=q.generateQwenJSON;
 q.generateQwenJSON=async options=>{assert.equal(options.maxCompletionTokens,1800);assert.equal(options.timeoutMs,300000);assert.equal(options.temperature,.35);assert.equal(options.topP,.9);assert.equal(options.retries,0);return {...await original(options),usage:{promptTokens:123,completionTokens:45}};};
 try{let snapshot;await m.withGenerationMetrics('create',create,v=>snapshot=v);assert.equal(snapshot.counters.promptTokensActual,123);assert.equal(snapshot.counters.completionTokensActual,45);assert.ok(snapshot.counters.promptTokensEstimate>123);}
 finally{q.generateQwenJSON=original;}
});
test('compact protocol rejects structural fields and preserves failure fallback',async()=>{
 for(const mode of ['malicious','timeout','invalid','jsonerror']){
  f.reset();f.inference.mode=mode;const result=await create();assert.ok(result.roadmap.every(n=>n.generatedBy==='fallback'));assert.equal(f.accounts.get(owner).roadmapGeneration.degraded,true);
 }
});
test('persisted 4C narratives remain reusable after clearing process cache',async()=>{
 f.reset();await create();f.load('services/roadmapNarrativeCache').clearRoadmapNarrativeCache();f.inference.calls.length=0;
 await replan();assert.equal(f.inference.calls.length,0);
});
test('model read timings preserve query results, read concerns and transaction sessions',async()=>{
 const {installRoadmapReadGuard,withGenerationReads}=f.load('services/roadmapWriteGuard');
 class Query{constructor(session){this.op='findOne';this.options={session};this.changes=[];}getOptions(){return this.options;}readConcern(v){this.changes.push(['concern',v]);return this;}read(v){this.changes.push(['read',v]);return this;}exec(){return Promise.resolve('unchanged');}}
 const model={Query};installRoadmapReadGuard(model);
 let snapshot;const plain=new Query(),transactional=new Query({inTransaction:()=>true});
 await m.withGenerationMetrics('replan',()=>withGenerationReads(owner,async()=>{
  assert.equal(await plain.exec(),'unchanged');assert.equal(await transactional.exec(),'unchanged');
 }),v=>snapshot=v);
 assert.deepEqual(plain.changes,[['concern','majority'],['read','primary']]);assert.deepEqual(transactional.changes,[]);
 assert.equal(snapshot.counters.modelReads,2);assert.equal(snapshot.stages['database.model'].calls,2);
});
test('unfinished inference at request timeout is reported as incomplete, not omitted',async()=>{
 let release,late,snapshot;
 await assert.rejects(m.withGenerationMetrics('replan',async()=>{
  m.countGenerationMetric('qwenCalls');
  late=m.timeGenerationStage('qwen',()=>new Promise(r=>release=r));
  throw new Error('Private timeout reason');
 },v=>snapshot=v));
 assert.equal(snapshot.success,false);assert.equal(snapshot.counters.qwenCalls,1);
 assert.equal(snapshot.stages.qwen.incomplete,1);assert.equal(snapshot.stages.qwen.calls,1);
 release();await late;assert.equal(snapshot.stages.qwen.calls,1);
});
