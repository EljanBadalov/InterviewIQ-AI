// Real application timing paths with isolated in-memory persistence and inference.
const fs=require('node:fs'),path=require('node:path');
const f=require('./phase4d-generation-fixture.cjs');
require('./phase4d-generation-benchmark.cjs');
const metrics=f.load('services/roadmapGenerationMetrics');
(async()=>{
 const log=console.log,warn=console.warn;console.log=console.warn=()=>{};
 try{
  const rows=[];
  for(let i=0;i<30;i++){
   f.reset();f.resumes[0].summary='Fixture resume';
   await metrics.withGenerationMetrics('create',()=>f.service.createCareerAutomation(f.input()),value=>rows.push(value));
  }
  const distribution=values=>{values.sort((a,b)=>a-b);return {n:values.length,p50Ms:values[Math.ceil(values.length*.5)-1],p95Ms:values[Math.ceil(values.length*.95)-1]};};
  const stages={};
  for(const key of new Set(rows.flatMap(row=>Object.keys(row.stages))))stages[key]=distribution(rows.map(row=>row.stages[key]?.durationMs).filter(value=>value!==undefined));
  const output={fixture:true,samples:30,notes:'Stage durations overlap. Mocked model execution bypasses production Query.exec; database.model and real Qwen JSON parse are not sampled here.',total:distribution(rows.map(row=>row.totalMs)),stages,counters:rows.at(-1).counters};
  fs.writeFileSync(path.resolve(__dirname,'../docs/phase4e/stage-benchmark.json'),JSON.stringify(output,null,2));log(JSON.stringify(output));
 }finally{console.log=log;console.warn=warn;}
})().catch(error=>{console.error(error);process.exitCode=1;});
