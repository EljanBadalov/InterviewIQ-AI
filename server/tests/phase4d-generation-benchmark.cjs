// Synthetic comparison: no network, real documents, indexes or live inference.
const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
const before=process.env.PHASE4D_BASELINE==='1';
const f=require(before?'./phase4c-roadmap-fixture.cjs':'./phase4d-generation-fixture.cjs');
const owner=String(f.ownerA);
let hook;
const qwen=f.load('services/qwenService');const generate=qwen.generateQwenJSON;
qwen.generateQwenJSON=async options=>{if(hook)await hook();await new Promise(resolve=>setTimeout(resolve,40));return generate(options);};
const create=who=>f.service.createCareerAutomation(f.input(who));
const replan=()=>f.service.replanCareerAutomation({userId:owner,preserveCompletedTasks:true});
async function scenario(name){
 f.reset();hook=undefined;f.resumes[0].summary='Fixture resume';
 if(name!=='two-users-create')await create();
 if(name==='repeat-replan')await replan();
 if(name==='parallel-replan'||name==='concurrent-completion'){
  f.resumes[0].summary='Changed CV benchmark evidence';if(!before)f.change(owner,'roadmapEvidenceRevision');
 }
 if(name==='concurrent-completion')hook=async()=>{f.store.get(owner).tasks[0].status='completed';if(!before)f.change(owner,'roadmapAutomationRevision');};
 f.resetCounters();f.inference.calls.length=0;
 if(f.data)Object.assign(f.data,{coordQueries:0,coordReads:0,coordWrites:0,transactions:0});
 const started=performance.now();let error;
 try{
  if(name==='parallel-replan')await Promise.all([replan(),replan()]);
  else if(name==='two-users-create')await Promise.all([create(),create(f.ownerB)]);
  else await replan();
 }catch(value){error=value.code||value.name;}
 const elapsed=performance.now()-started;
 const calls=f.inference.calls.length;
 const result={elapsed,automationWriteAttempts:f.counters.writes,qwenCalls:calls,duplicateInference:name==='parallel-replan'?Math.max(0,calls-1):0,reads:f.counters.queries.length+(f.data?.coordReads||0),writes:f.counters.writes+(f.data?.coordWrites||0),transactions:f.data?.transactions||0,error:error||null,completedTasks:name==='concurrent-completion'?f.store.get(owner).tasks.filter(t=>t.status==='completed').length:null};
 result.operations=result.reads+result.writes;return result;
}
async function main(){
 const log=console.log,warn=console.warn;console.log=console.warn=()=>{};
 try{
 const count=Number(process.env.PHASE4D_SAMPLES||30),output={fixture:true,mode:before?'before':'after',samples:count,queryStubDelayMs:2,inferenceStubDelayMs:45,metrics:'logical model reads/writes; transaction wire commands excluded',scenarios:{}};
 for(const name of ['parallel-replan','repeat-replan','two-users-create','concurrent-completion']){
  const rows=[];for(let i=0;i<count;i++)rows.push(await scenario(name));
  const sorted=rows.map(row=>row.elapsed).sort((a,b)=>a-b);const {elapsed,...metrics}=rows.at(-1);output.scenarios[name]={...metrics,p50Ms:sorted[Math.ceil(count*.5)-1],p95Ms:sorted[Math.ceil(count*.95)-1]};
 }
 const folder=path.resolve(__dirname,'../docs/phase4d');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,`benchmark-${output.mode}.json`),JSON.stringify(output,null,2));log(JSON.stringify(output));
 }finally{console.log=log;console.warn=warn;}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={scenario};
