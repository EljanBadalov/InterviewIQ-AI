const test=require('node:test'),assert=require('node:assert/strict');const f=require('./phase4d-generation-fixture.cjs'),q=f.load('services/qwenService');
test('duplicate, unknown, valid, missing and fallback node telemetry matches actual acceptance',async()=>{
 f.reset();const original=q.generateQwenJSON;q.generateQwenJSON=async options=>{const response=await original(options);response.data.nodes.push({...response.data.nodes[0]},{...response.data.nodes[1],id:'unknown-fixture-node'});return response;};
 try{await f.service.createCareerAutomation(f.input());const m=f.narrativeMetrics.at(-1);assert.equal(m.duplicateNodes,1);assert.equal(m.unknownNodes,1);assert.equal(m.validNodes,m.generatedNodes-1);assert.equal(m.missingNodes,1);assert.equal(m.fallbackNodes,1);assert.equal(m.receivedNodes,m.generatedNodes+2);}finally{q.generateQwenJSON=original;}
});
test('unavailable Qwen reports missing nodes and retains deterministic learning actions',async()=>{
 f.reset();const original=q.generateQwenJSON;q.generateQwenJSON=async()=>({success:false,error:'Fixture unavailable'});
 try{const result=await f.service.createCareerAutomation(f.input());const m=f.narrativeMetrics.at(-1);assert.equal(m.validNodes,0);assert.equal(m.missingNodes,m.generatedNodes);assert.equal(m.fallbackNodes,m.generatedNodes);assert.ok(m.deterministicNodes>0);assert.ok(result.roadmap.some(s=>s.recommendations.some(r=>r.whatToLearn.length)));}finally{q.generateQwenJSON=original;}
});
