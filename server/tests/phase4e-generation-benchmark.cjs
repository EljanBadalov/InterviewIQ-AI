// Fixture-only benchmark. Never connects to MongoDB or invokes a model server.
const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
const f=require('./phase4d-generation-fixture.cjs');
const {scenario}=require('./phase4d-generation-benchmark.cjs');
const owner=String(f.ownerA);

async function run(name){
 if(['parallel-replan','repeat-replan','two-users-create','concurrent-completion'].includes(name))return scenario(name);
 f.reset();f.resumes[0].summary='Fixture resume';
 if(name!=='cold-create')await f.service.createCareerAutomation(f.input());
 if(name==='resume-change'){f.resumes[0].summary='Updated fixture evidence';f.change(owner,'roadmapEvidenceRevision');}
 f.resetCounters();f.inference.calls.length=0;f.narrativeMetrics.length=0;Object.assign(f.data,{coordReads:0,coordWrites:0,transactions:0});
 const start=performance.now();
 if(name==='cold-create')await f.service.createCareerAutomation(f.input());
 else if(name==='progress-refresh')await f.service.refreshCareerAutomationProgress(owner);
 else await f.service.replanCareerAutomation({userId:owner,preserveCompletedTasks:true});
 return {elapsed:performance.now()-start,reads:f.counters.queries.length+f.data.coordReads,writes:f.counters.writes+f.data.coordWrites,qwenCalls:f.inference.calls.length,transactions:f.data.transactions};
}
async function main(){
 const log=console.log,warn=console.warn;console.log=console.warn=()=>{};
 try{
 const samples=Number(process.env.PHASE4E_SAMPLES||30),scenarios={};
 for(const name of ['cold-create','parallel-replan','repeat-replan','resume-change','progress-refresh','two-users-create','concurrent-completion']){
  const rows=[];
  for(let i=0;i<samples;i++){
   const result=await run(name);const calls=f.inference.calls;
   rows.push({...result,promptBytes:calls.reduce((n,c)=>n+c.promptBytes,0),completionBytes:calls.reduce((n,c)=>n+(c.completionBytes||0),0),promptTokensEstimate:calls.reduce((n,c)=>n+c.promptEstimate,0),completionTokensEstimate:calls.reduce((n,c)=>n+c.completionEstimate,0),hits:name==='repeat-replan'?null:f.narrativeMetrics.at(-1)?.hits??null,misses:name==='repeat-replan'?null:f.narrativeMetrics.at(-1)?.misses??null});
  }
  const times=rows.map(r=>r.elapsed).sort((a,b)=>a-b),{elapsed,...metrics}=rows.at(-1);
  scenarios[name]={...metrics,p50Ms:times[Math.ceil(samples*.5)-1],p95Ms:times[Math.ceil(samples*.95)-1]};
 }
 const output={fixture:true,samples,queryStubDelayMs:2,inferenceStubDelayMs:45,counts:'logical reads/writes; no real driver or model usage',scenarios};
 const label=process.env.PHASE4E_LABEL==='before'?'before':'after';
 fs.writeFileSync(path.resolve(__dirname,`../docs/phase4e/benchmark-${label}.json`),JSON.stringify(output,null,2));log(JSON.stringify(output));
 }finally{console.log=log;console.warn=warn;}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
