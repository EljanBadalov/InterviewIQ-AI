// Identical controller workloads with in-memory persistence/inference, never server startup.
const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
const f=require('./phase4d-generation-fixture.cjs');const log=console.log;console.log=console.warn=console.error=()=>{};
(async()=>{const scenarios={};for(const name of (process.env.R123_SCENARIOS?process.env.R123_SCENARIOS.split(','):['create','replan','progress-refresh'])){
 const rows=[];for(let i=0;i<120;i++){f.reset();if(name!=='create')await f.service.createCareerAutomation(f.input());f.resetCounters();f.inference.calls.length=0;Object.assign(f.data,{coordReads:0,coordWrites:0,transactions:0});
 const handler=name==='create'?f.controller.createAutomation:name==='replan'?f.controller.replanAutomation:f.controller.refreshAutomationProgress;
 const start=performance.now();const response=await f.invoke(handler,name==='create'?f.input():{preserveCompletedTasks:true});if(![200,201].includes(response.statusCode))throw Error('Controller fixture failed');
 if(i>=20)rows.push({ms:performance.now()-start,reads:f.counters.queries.length+f.data.coordReads,automationReads:f.counters.queries.filter(q=>q.model==='automations').length,writes:f.counters.writes+f.data.coordWrites,qwenCalls:f.inference.calls.length,body:response.body});}
 fs.writeFileSync(path.join(__dirname,'../docs/phase4/r1-r3/samples-'+(process.env.R123_LABEL||'after')+'-'+name+'.json'),JSON.stringify(rows.map(({body,...row})=>row)));
 const times=rows.map(row=>row.ms).sort((a,b)=>a-b),last=rows.at(-1);scenarios[name]={p50Ms:times[49],p95Ms:times[94],reads:last.reads,automationReads:last.automationReads,writes:last.writes,qwenStubCalls:last.qwenCalls};
 fs.writeFileSync(path.join(__dirname,'../docs/phase4/r1-r3/contract-'+(process.env.R123_LABEL||'after')+'-'+name+'.json'),JSON.stringify(last.body,null,2));
 }const result={fixture:true,realMongo:false,realQwen:false,realHttp:false,samples:100,warmup:20,nominalQueryDelayMs:2,nominalInferenceDelayMs:45,scenarios};fs.writeFileSync(path.join(__dirname,'../docs/phase4/r1-r3/benchmark-'+(process.env.R123_LABEL||'after')+'.json'),JSON.stringify(result,null,2));log(JSON.stringify(result));})().catch(error=>{log(error.message);process.exitCode=1;});
