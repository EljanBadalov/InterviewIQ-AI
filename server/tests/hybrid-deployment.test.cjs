const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {aiProxyRequestOptions}=require('../dist/config/aiProxyTransport');
test('legacy loopback needs no secret and refuses redirects',()=>{
 const result=aiProxyRequestOptions('http://127.0.0.1:8000',{});assert.equal(result.redirect,'error');assert.deepEqual(result.headers,{'Content-Type':'application/json'});
});
test('hybrid transport carries server-only Access pair and origin token',()=>{
 const source={QWEN_REQUIRE_SECURE_PROXY:'true',CF_ACCESS_CLIENT_ID:'fixture-id',CF_ACCESS_CLIENT_SECRET:'fixture-secret',QWEN_PROXY_API_KEY:'fixture-origin-key'};
 const result=aiProxyRequestOptions('https://ai.example.com',source);
 assert.equal(result.headers['CF-Access-Client-Id'],'fixture-id');assert.equal(result.headers['CF-Access-Client-Secret'],'fixture-secret');assert.equal(result.headers.Authorization,'Bearer fixture-origin-key');assert.equal(result.redirect,'error');
});
for(const [url,env] of [
 ['http://remote.example.com',{CF_ACCESS_CLIENT_ID:'id',CF_ACCESS_CLIENT_SECRET:'secret'}],
 ['https://ai.example.com',{CF_ACCESS_CLIENT_ID:'id'}],
 ['https://ai.example.com',{QWEN_REQUIRE_SECURE_PROXY:'true'}],
 ['https://user:password@ai.example.com',{}],
 ['http://remote.example.com',{QWEN_PROXY_API_KEY:'key'}],
 ['http://localhost:8000',{QWEN_REQUIRE_SECURE_PROXY:'true',CF_ACCESS_CLIENT_ID:'id',CF_ACCESS_CLIENT_SECRET:'secret',QWEN_PROXY_API_KEY:'key'}],
 ['https://temporary.trycloudflare.com',{QWEN_REQUIRE_SECURE_PROXY:'true',CF_ACCESS_CLIENT_ID:'id',CF_ACCESS_CLIENT_SECRET:'secret',QWEN_PROXY_API_KEY:'key'}],
])test('invalid cloud credential destination fails closed: '+url,()=>{
 assert.throws(()=>aiProxyRequestOptions(url,env),error=>error.message==='Invalid AI proxy security configuration');
});
test('startup is non-mutating by default and Docker preserves ONNX locale',()=>{
 const root=path.join(__dirname,'..');const startup=fs.readFileSync(path.join(root,'src/server.ts'),'utf8');
 assert.ok(startup.includes("process.env.ENABLE_STARTUP_RECOVERY === 'true'"));
 const safety=fs.readFileSync(path.join(root,'src/config/mongoSafety.ts'),'utf8');assert.ok(safety.includes("mongoose.set('autoIndex', false)"));assert.ok(safety.includes("mongoose.set('autoCreate', false)"));
 const docker=fs.readFileSync(path.join(root,'Dockerfile'),'utf8');assert.ok(docker.includes('locale-gen'));assert.ok(docker.includes('USER node'));
});
test('real bridge sends credentials only in headers and disables redirect following',async()=>{
 const names=['QWEN_SERVICE_URL','QWEN_REQUIRE_SECURE_PROXY','CF_ACCESS_CLIENT_ID','CF_ACCESS_CLIENT_SECRET','QWEN_PROXY_API_KEY'];
 const previous=Object.fromEntries(names.map(k=>[k,process.env[k]])),fetch=global.fetch;
 try{
  Object.assign(process.env,{QWEN_SERVICE_URL:'https://ai.example.com',QWEN_REQUIRE_SECURE_PROXY:'true',CF_ACCESS_CLIENT_ID:'fixture-id',CF_ACCESS_CLIENT_SECRET:'fixture-secret',QWEN_PROXY_API_KEY:'fixture-origin-key'});
  let calls=0;global.fetch=async(url,options)=>{
   calls++;assert.equal(url,'https://ai.example.com/generate');assert.equal(options.redirect,'error');
   assert.equal(options.headers['CF-Access-Client-Secret'],'fixture-secret');assert.equal(options.headers.Authorization,'Bearer fixture-origin-key');
   assert.ok(!options.body.includes('fixture-secret'));assert.ok(!options.body.includes('fixture-origin-key'));
   return new Response(JSON.stringify({response:'{"ok":true}',finish_reason:'stop'}));
  };
  const qwen=require('../dist/services/qwenService');
  assert.equal((await qwen.generateQwenJSON({messages:[{role:'user',content:'Synthetic fixture'}],retries:0})).success,true);assert.equal(calls,1);
  process.env.QWEN_SERVICE_URL='http://localhost:8000';calls=0;
  assert.equal((await qwen.generateQwenJSON({messages:[{role:'user',content:'Synthetic fixture'}],retries:0})).success,false);assert.equal(calls,0);
 }finally{
  global.fetch=fetch;for(const name of names)if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];
 }
});
