const test=require('node:test'),assert=require('node:assert/strict');
const q=require('../dist/services/qwenService'),m=require('../dist/services/roadmapGenerationMetrics');
const fetch=global.fetch;test.after(()=>global.fetch=fetch);
const messages=[{role:'system',content:'Use supplied facts only.'},{role:'user',content:'Synthetic fixture content'}];
test('transport reports final payload bytes, usage, finish reason and sanitized proxy durations',async()=>{
 let body,observed;global.fetch=async(url,options)=>{body=options.body;return new Response(JSON.stringify({response:'{"nodes":[]}',finish_reason:'length',usage:{prompt_tokens:100,completion_tokens:20},timings_ms:{queue_wait:12.5,inference_roundtrip:25,readiness:1}}));};
 const result=await m.withGenerationMetrics('create',()=>q.generateQwenJSON({messages,timeoutMs:300000,retries:0}),value=>observed=value);
 assert.equal(result.finishReason,'length');assert.equal(result.usage.promptTokens,100);assert.equal(observed.counters.finalPayloadBytes,Buffer.byteLength(body));assert.ok(observed.counters.finalPromptBytes>Buffer.byteLength(messages[1].content));assert.equal(observed.counters.qwenTruncated,1);assert.equal(observed.stages['proxy.queue'].durationMs,12.5);assert.equal(observed.stages['proxy.inference'].durationMs,25);
 const data=JSON.parse(body);assert.ok(data.deadline_unix_ms>Date.now());assert.ok(data.request_budget_ms<=300000);assert.equal(data.temperature,.6);assert.equal(JSON.stringify(observed).includes('Synthetic fixture content'),false);
});
test('already expired or aborted requests never call fetch',async()=>{
 let calls=0;global.fetch=async()=>{calls++;throw Error('Unexpected fetch');};
 assert.equal((await q.generateQwenJSON({messages,deadlineAtMs:Date.now()-1,retries:0})).success,false);
 const abort=new AbortController();abort.abort();assert.equal((await q.generateQwenJSON({messages,signal:abort.signal,retries:0})).success,false);assert.equal(calls,0);
});
test('external abort and remaining deadline stop transport without retry',async()=>{
 let calls=0;global.fetch=async(url,options)=>{calls++;return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));};
 const abort=new AbortController();const pending=q.generateQwenJSON({messages,signal:abort.signal,retries:3});setTimeout(()=>abort.abort(),10);assert.equal((await pending).success,false);assert.equal(calls,1);
 const expired=await q.generateQwenJSON({messages,deadlineAtMs:Date.now()+10,retries:0});assert.equal(expired.success,false);assert.equal(calls,2);
});
test('upstream bodies and arbitrary finish reasons are never logged',async()=>{
 const logs=[],oldLog=console.log,oldWarn=console.warn;console.log=console.warn=(...args)=>logs.push(args.join(' '));
 try{global.fetch=async()=>new Response('PRIVATE_FIXTURE_SECRET',{status:502});await q.generateQwenJSON({messages,retries:0});assert.equal(logs.join(' ').includes('PRIVATE_FIXTURE_SECRET'),false);assert.equal(q.normalizeQwenFinishReason('PRIVATE_FIXTURE_SECRET'),'unknown');}finally{console.log=oldLog;console.warn=oldWarn;}
});
