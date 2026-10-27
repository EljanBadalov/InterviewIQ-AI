// Equivalent isolated workloads, with raw samples and real Node serialization behind a mock fetch.
const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
const root=path.resolve(__dirname,'..',process.env.B3_BASELINE_ROOT||'dist');
const serializeGenerate=require(path.join(root,'services/qwenService')).generateQwenJSON;
const f=require('./phase4d-generation-fixture.cjs'),m=f.load('services/roadmapGenerationMetrics');
const q=f.load('services/qwenService'),stub=q.generateQwenJSON;let lastOptions;
q.generateQwenJSON=async options=>{lastOptions=options;return stub(options);};
const log=console.log;console.log=console.warn=console.error=()=>{};
async function measurePayload(options){
 const previousFetch=global.fetch;let body,metrics;
 global.fetch=async(url,request)=>{body=request.body;return new Response(JSON.stringify({response:'{"nodes":[]}',finish_reason:'stop'}));};
 try{await m.withGenerationMetrics('create',()=>serializeGenerate({...options,signal:undefined,deadlineAtMs:undefined}),value=>metrics=value);if(!body)throw Error('Serialization probe did not capture a payload');return {finalPayloadBytes:Buffer.byteLength(body),finalPromptBytes:metrics.counters.finalPromptBytes,finalPromptTokensEstimate:metrics.counters.finalPromptTokensEstimate};}
 finally{global.fetch=previousFetch;}
}
(async()=>{const samples={create:[],replan:[],replay:[]};let payload;
 for(let i=0;i<120;i++){
  f.reset();for(const [name,work] of [['create',()=>f.service.createCareerAutomation(f.input())],['replan',()=>f.service.replanCareerAutomation({userId:String(f.ownerA),preserveCompletedTasks:true})],['replay',()=>f.service.replanCareerAutomation({userId:String(f.ownerA),preserveCompletedTasks:true})]]){
   f.resetCounters();f.inference.calls.length=0;f.narrativeMetrics.length=0;lastOptions=undefined;Object.assign(f.data,{coordReads:0,coordWrites:0});let telemetry;
   const started=performance.now();await m.withGenerationMetrics(name==='create'?'create':'replan',work,value=>telemetry=value);const elapsed=performance.now()-started,n=f.narrativeMetrics.at(-1);
   // Transport serialization is probed once outside timed fixture execution. No network leaves this process.
   if(name==='create'&&!payload)payload=await measurePayload(lastOptions);
   if(i>=20)samples[name].push({ms:elapsed,validationMs:telemetry.stages.validation?.durationMs??0,reads:f.counters.queries.length+f.data.coordReads,writes:f.counters.writes+f.data.coordWrites,qwenStubCalls:f.inference.calls.length,narrativeExecuted:Boolean(n),promptBytesProxy:n?.promptBytes??0,promptTokensEstimate:n?.promptTokensEstimate??0,...(name==='create'?payload:{finalPayloadBytes:0,finalPromptBytes:0,finalPromptTokensEstimate:0}),completionBytes:n?.completionBytes??0,requestedNodes:n?.generatedNodes??0,validNodes:n?.validNodes??0,rejectedNodes:n?.invalidNodes??0,missingNodes:n?.missingNodes??0,fallbackNodes:n?.fallbackNodes??0,deterministicNodes:n?.deterministicNodes??0,cacheHits:n?.hits??null,cacheMisses:n?.misses??null});
  }
 }
 const scenarios={};for(const [name,rows] of Object.entries(samples)){const times=rows.map(r=>r.ms).sort((a,b)=>a-b),validation=rows.map(r=>r.validationMs).sort((a,b)=>a-b);const {ms,validationMs,...counts}=rows.at(-1);scenarios[name]={...counts,p50Ms:times[49],p95Ms:times[94],validationP50Ms:validation[49],validationP95Ms:validation[94]};}
 const result={fixture:true,realQwen:false,realMongo:false,realHttp:false,samples:100,warmup:20,actualTokensAvailable:false,payloadProbe:'Actual Node JSON serialization, mocked fetch, outside latency timer',scenarios};
 const directory=path.join(__dirname,'../docs/phase4/r1-r3');fs.writeFileSync(path.join(directory,'narrative-'+process.env.R123_LABEL+'.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(directory,'raw-narrative-'+process.env.R123_LABEL+'.json'),JSON.stringify(samples));log(JSON.stringify(result));
})().catch(error=>{log(error.message);process.exitCode=1;});
