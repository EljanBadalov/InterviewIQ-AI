const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const f=require('./phase4d-generation-fixture.cjs'),metrics=f.load('services/roadmapGenerationMetrics');
for(const [name,handler] of [['create','createAutomation'],['replan','replanAutomation'],['progress-refresh','refreshAutomationProgress']])test(name+' returns the unchanged controller contract without a post-commit read',async()=>{
 f.reset();if(name!=='create')await f.service.createCareerAutomation(f.input());f.resetCounters();
 const original=f.service.getCareerAutomationSummary;let prepared;
 f.service.getCareerAutomationSummary=async(owner,date,document)=>{assert.equal(String(document.userId),owner);prepared=document;const reads=f.counters.queries.length;const result=await original(owner,date,document);assert.equal(f.counters.queries.length,reads);return result;};
 try{const response=await f.invoke(f.controller[handler],name==='create'?f.input():{preserveCompletedTasks:true});assert.ok(prepared);const before=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/phase4/r1-r3/contract-before-'+name+'.json')));const normalized=value=>{const copy=JSON.parse(JSON.stringify(value));assert.equal(copy.data.summary.id,copy.data.automation._id);copy.data.automation._id='<generated-automation-id>';copy.data.summary.id='<generated-automation-id>';if(fs.existsSync(path.join(f.root,'services/roadmapNarrativeGrounding.js')))for(const section of copy.data.automation.roadmap)for(const note of section.metadata?.roadmapNarrative?.nodes||[])if(!note.learning)delete note.version;return copy;};assert.deepEqual(normalized(response.body),normalized(before));}finally{f.service.getCareerAutomationSummary=original;}
});
test('summary is coherent with the committed document when another task update follows commit',async()=>{
 f.reset();await f.service.createCareerAutomation(f.input());const original=f.service.replanCareerAutomation;let expected;
 f.service.replanCareerAutomation=async input=>{const doc=await original(input);expected=await f.service.getCareerAutomationSummary(String(f.ownerA),new Date(),doc);const stored=f.store.get(String(f.ownerA));stored.tasks=[];stored.__v++;f.change(String(f.ownerA),'roadmapAutomationRevision');return doc;};
 try{const response=await f.invoke(f.controller.replanAutomation,{});assert.deepEqual(response.body.data.summary,JSON.parse(JSON.stringify(expected)));assert.equal(f.store.get(String(f.ownerA)).tasks.length,0);}finally{f.service.replanCareerAutomation=original;}
});
test('prepared summary rejects foreign owners and response telemetry restores json',async()=>{
 f.reset();const doc=await f.service.createCareerAutomation(f.input());await assert.rejects(f.service.getCareerAutomationSummary(String(f.ownerB),new Date(),doc),/owner mismatch/);
 const response={statusCode:409,json(){return this;}},original=response.json;let observed;
 await metrics.withGenerationMetrics('replan',()=>metrics.withGenerationResponseMetrics('replan',response,async()=>response.json({success:false})),value=>observed=value);assert.equal(response.json,original);assert.ok(observed.stages.serialization);
});

test('prepared and standalone summary agree across UTC day boundaries',async()=>{
 f.reset();const document=await f.service.createCareerAutomation(f.input());
 for(const instant of ['2026-10-24T23:59:59.999Z','2026-10-25T00:00:00.000Z','2026-10-25T00:00:00+04:00']){
  const date=new Date(instant),owned=await f.service.getCareerAutomationSummary(String(f.ownerA),date),prepared=await f.service.getCareerAutomationSummary(String(f.ownerA),date,document);
  assert.deepEqual(JSON.parse(JSON.stringify(prepared)),JSON.parse(JSON.stringify(owned)));
 }
});
