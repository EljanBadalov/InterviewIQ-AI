// Repeatable synthetic measurement. All persistence and Qwen calls are mocked.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const f=require('./phase4c-roadmap-fixture.cjs');
const before=process.env.PHASE4C_BASELINE==='1';
const owner=String(f.ownerA);
const resume=f.clone(f.resumes[0]), interview=f.clone(f.interviews[1]);
const percent=(values,p)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];
async function scenario(name){
 f.reset();Object.assign(f.resumes[0],f.clone(resume));Object.assign(f.interviews[1],f.clone(interview));
 if(name!=='create')await f.service.createCareerAutomation(f.input());
 if(name==='skill')f.resumes[0].skillsDetected.push('API Testing');
 if(name==='role')f.store.get(owner).targetRole='Frontend Developer';
 if(name==='resume')f.resumes[0].summary='Updated evidence about backend delivery';
 if(name==='interview')f.interviews[1].finalReport.summary='Updated interview evidence';
 f.resetCounters();f.inference.calls.length=0;f.narrativeMetrics.length=0;f.matching.clearJobMatchCache?.();
 const started=performance.now();
 const response=await f.invoke(name==='create'?f.controller.createAutomation:name==='progress'?f.controller.refreshAutomationProgress:f.controller.replanAutomation,name==='create'?f.input():{preserveCompletedTasks:true});
 const elapsed=performance.now()-started;assert.equal(response.statusCode,name==='create'?201:200);
 const calls=f.inference.calls;
 const metric=f.narrativeMetrics[0];
 return {elapsed,queries:f.counters.queries.length,writes:f.counters.writes,calls:calls.length,promptEstimate:calls.reduce((s,c)=>s+c.promptEstimate,0),completionEstimate:calls.reduce((s,c)=>s+c.completionEstimate,0),promptBytes:calls.reduce((s,c)=>s+c.promptBytes,0),completionBytes:calls.reduce((s,c)=>s+c.completionBytes,0),hits:metric?.hits??null,misses:metric?.misses??null,generatedNodes:metric?.generatedNodes??(calls.length?response.body.data.automation.roadmap.reduce((sum,m)=>sum+m.recommendations.length,0):0),totalNodes:response.body.data.automation.roadmap.reduce((sum,m)=>sum+m.recommendations.length,0)};
}
async function main(){
 const log=console.log,warn=console.warn;console.log=console.warn=()=>{};
 try{
 const samples=Number(process.env.PHASE4C_SAMPLES||100),output={fixture:true,mode:before?'before':'after',samples,queryDelayMs:2,qwenStubDelayMs:5,tokenMethod:'ceil(UTF-8 JSON bytes / 4), not measured tokenizer tokens',scenarios:{}};
 for(const name of (process.env.PHASE4C_SCENARIO?[process.env.PHASE4C_SCENARIO]:['create','identical-replan','skill','role','resume','interview','progress'])){
  const rows=[];for(let i=0;i<samples;i++)rows.push(await scenario(name));
  const {elapsed,...last}=rows.at(-1);output.scenarios[name]={...last,p50Ms:percent(rows.map(r=>r.elapsed),.5),p95Ms:percent(rows.map(r=>r.elapsed),.95)};
 }
 const directory=path.resolve(__dirname,'../docs/phase4c');fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,`benchmark-${output.mode}.json`);if(process.env.PHASE4C_SCENARIO){const previous=JSON.parse(fs.readFileSync(file));output.scenarios={...previous.scenarios,...output.scenarios};}fs.writeFileSync(file,JSON.stringify(output,null,2));log(JSON.stringify(output));
 }finally{console.log=log;console.warn=warn;}
}
module.exports={scenario};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
