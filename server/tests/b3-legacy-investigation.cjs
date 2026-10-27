// Alternating isolated build controls separate timer waits from profile/matching work.
const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks'),{spawnSync}=require('node:child_process'),crypto=require('node:crypto');
const q=(rows,key,p)=>[...rows].map(r=>r[key]).sort((a,b)=>a-b)[Math.ceil(rows.length*p)-1];
if(process.argv.includes('--child')){
 const f=require('./skill-assessment-fixture.cjs'),profileService=f.load('services/careerSkillProfileService');
 let waits=[];const exec=f.Query.prototype.exec;f.Query.prototype.exec=async function(){const start=performance.now();try{return await exec.call(this);}finally{waits.push(performance.now()-start);}};
 (async()=>{const rows=[];let profile,match;
  for(let i=0;i<120;i++){waits=[];f.resetCounters();const start=performance.now();profile=await profileService.buildCareerSkillProfile({userId:f.user});const afterProfile=performance.now();match=f.matching.calculateJobMatch(profile,f.jobs[0],{targetRole:'Backend Developer'});const end=performance.now();if(i>=20)rows.push({elapsed:end-start,queryCriticalWait:Math.max(...waits),residualWork:Math.max(0,end-start-Math.max(...waits)),matching:end-afterProfile,reads:f.counters.queries.length});}
  const {generatedAt,...stable}=profile;const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
  console.log(JSON.stringify({rows,profileDigest:hash(stable),matchDigest:hash(match)}));
 })().catch(e=>{console.error(e);process.exitCode=1;});
}else{
 const batches=[];
 for(let round=0;round<3;round++)for(const mode of round%2?['after','before']:['before','after']){
  const result=spawnSync(process.execPath,['--preserve-symlinks','--preserve-symlinks-main',__filename,'--child'],{encoding:'utf8',env:{...process.env,B3_BASELINE_ROOT:mode==='before'?'node_modules/.cache/b3/baseline-dist':''}});
  if(result.status!==0)throw new Error(result.stderr);batches.push({round,mode,...JSON.parse(result.stdout)});
 }
 const aggregate={};for(const mode of ['before','after']){const rows=batches.filter(b=>b.mode===mode).flatMap(b=>b.rows);aggregate[mode]={samples:rows.length,reads:rows[0].reads,p50Ms:q(rows,'elapsed',.5),p95Ms:q(rows,'elapsed',.95),queryCriticalWaitP50Ms:q(rows,'queryCriticalWait',.5),queryCriticalWaitP95Ms:q(rows,'queryCriticalWait',.95),residualWorkP50Ms:q(rows,'residualWork',.5),residualWorkP95Ms:q(rows,'residualWork',.95),matchingP50Ms:q(rows,'matching',.5),matchingP95Ms:q(rows,'matching',.95)};}
 const output={fixture:true,queryStubDelayMs:2,warmupPerProcess:20,samplesPerProcess:100,order:batches.map(b=>b.mode),aggregate,batches:batches.map(b=>({...b,p50Ms:q(b.rows,'elapsed',.5),p95Ms:q(b.rows,'elapsed',.95)}))};
 fs.writeFileSync(path.resolve(__dirname,'../docs/b3/legacy-investigation.json'),JSON.stringify(output,null,2));console.log(JSON.stringify(aggregate));
}
