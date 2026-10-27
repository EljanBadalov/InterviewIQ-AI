// Comparable in-memory context paths; Qwen is a fixture, never a real model call.
const f=require('./active-career-fixture.cjs');
const goal=f.load('services/careerGoalService');
const cache=f.load('services/roadmapNarrativeCache');
const {performance}=require('node:perf_hooks');
const log=console.log;console.log=()=>{};
async function sample(reuseOnly){
  f.reset();cache.clearRoadmapNarrativeCache();
  const started=performance.now();
  const result=await (reuseOnly?goal.buildCareerGoalChatContext:goal.buildCareerGoalContext)(f.input());
  if(!result.found||f.counters.writes!==0)throw Error('Unexpected context contract or persistence');
  return {ms:performance.now()-started,reads:f.counters.queries.length,qwenStubCalls:f.inference.calls.length};
}
function summary(rows){
  const times=rows.map(row=>row.ms).sort((a,b)=>a-b);
  return {samples:rows.length,p50Ms:times[Math.ceil(times.length*.5)-1],p95Ms:times[Math.ceil(times.length*.95)-1],readCounts:[...new Set(rows.map(row=>row.reads))],qwenStubCallCounts:[...new Set(rows.map(row=>row.qwenStubCalls))],databaseWrites:0};
}
(async()=>{
  for(let i=0;i<4;i++){await sample(false);await sample(true);}
  const before=[],after=[];
  for(let i=0;i<35;i++){
    if(i%2){after.push(await sample(true));before.push(await sample(false));}
    else{before.push(await sample(false));after.push(await sample(true));}
  }
  log(JSON.stringify({conditions:'35 alternating pairs after 4 warmup pairs; same evidence, cold narrative cache; legacy generative context versus read-only chat context; all DB and Qwen operations mocked',before:summary(before),after:summary(after),realInference:0,realDatabaseOperations:0},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
