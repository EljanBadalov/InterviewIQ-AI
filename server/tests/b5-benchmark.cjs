// Isolated comparison: never imports server startup or connects to a database.
const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
const f=require('./phase3-fixture.cjs');
f.load('services/qwenService').generateChatCompletion=async()=>{throw Error('Unexpected Qwen call');};
if(process.env.B5_HISTORY_COUNT){const count=Number(process.env.B5_HISTORY_COUNT),original=f.interviews[0];f.interviews.splice(0,f.interviews.length,...Array.from({length:count},(_,i)=>({_id:f.id(10000+i),user:f.ownerA,status:'completed',overallScore:71,category:'backend',difficulty:'beginner',interviewType:'technical',createdAt:original.createdAt,completedAt:original.completedAt,answers:original.answers.map(({answerText,...answer})=>({...answer}))})));}
const createMatcher=f.matching.createCachedJobMatcher;
f.matching.createCachedJobMatcher=(...args)=>{const match=createMatcher(...args);return job=>{const start=performance.now();try{return match(job);}finally{f.counters.matchingMs+=performance.now()-start;}};};
const report=console.log;console.log=console.warn=()=>{};
(async()=>{const scenarios={};for(const [name,handler] of [['progress',f.progress.getProgressController],['jobs',f.jobsController.getJobs]]){
 const rows=[];for(let i=0;i<120;i++){f.resetCounters();const start=performance.now();const r=await f.request(handler,{limit:'18'});if(r.statusCode!==200)throw Error('Fixture request failed');
 if(i>=20) rows.push({ms:performance.now()-start,reads:f.counters.queries.length,writes:f.counters.writes,matchingMs:f.counters.matchingMs,bytes:f.counters.queries.reduce((total,q)=>total+(q.bytes||0),0),queries:f.counters.queries.map(q=>q.model),body:r.body});}
 const times=rows.map(r=>r.ms).sort((a,b)=>a-b);
 scenarios[name]={p50Ms:times[49],p95Ms:times[94],reads:rows.at(-1).reads,writes:rows.at(-1).writes,queries:rows.at(-1).queries,materializedBytes:rows.at(-1).bytes,matchingCpuP50Ms:rows.map(row=>row.matchingMs).sort((a,b)=>a-b)[49]};
 if(name==='progress')fs.writeFileSync(path.join(__dirname,'../docs/b5/progress-'+(process.env.B5_LABEL||'after')+'-contract.json'),JSON.stringify(rows.at(-1).body,null,2));
 }const result={fixture:true,realHttp:false,realMongo:false,samples:100,warmup:20,nominalQueryDelayMs:2,qwenCalls:0,note:'Auth, catalog and knowledge costs are not represented. Windows actual waits may exceed 2ms.',scenarios};
 fs.writeFileSync(path.join(__dirname,'../docs/b5/benchmark-'+(process.env.B5_LABEL||'after')+'.json'),JSON.stringify(result,null,2));report(JSON.stringify(result));
})().catch(e=>{report(e);process.exitCode=1;});
