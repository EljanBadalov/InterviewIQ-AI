const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {QueryClient,queryOptions}=require('@tanstack/react-query');
function harness(){
 let owner='owner-a',epoch=0;const resets=[];
 const auth={accountId:()=>owner,sessionEpoch:()=>epoch,sessionSnapshot:()=>JSON.stringify([owner,epoch]),onSessionReset:f=>{resets.push(f);},subscribeSession:()=>()=>{}};
 function mod(file,dependencies={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:name=>dependencies[name]??require(name),URL,console});return exports;}
 const store=mod('query/careerContextStore.ts',{'./authScope':auth});const policy=mod('query/queryPolicy.ts');
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});let get=async()=>({data:{success:true}});
 const queries=mod('query/apiQueries.ts',{'./authScope':auth,'./careerContextStore':store,'./queryPolicy':policy,'./queryClient':{queryClient:client},'../api/apiClient':{get:(...args)=>get(...args)}});
 const context=(role='Backend Developer',v=1,e=1,a=1)=>({owner,activeCareer:{targetRole:role,roleKey:null,revision:v},evidenceRevision:e,automationRevision:a,preferencesKey:'preferences'});
 return {store,policy,client,queries,context,setGet:f=>{get=f;},switchAccount:value=>{epoch++;owner=value;resets.forEach(f=>f());client.clear();}};
}
test('all dependent pages share canonical career scopes without requiring selection GET',async()=>{
 const f=harness();f.store.acceptCareerContext(f.context());const a=f.queries.apiQueryOptions('/progress'),b=f.queries.apiQueryOptions('/progress');assert.deepEqual(a.queryKey,b.queryKey);
 let calls=0;f.setGet(async()=>{calls++;return {data:{success:true,careerContext:f.context(),data:{score:null}}};});
 await Promise.all([f.client.fetchQuery(a),f.client.fetchQuery(b)]);assert.equal(calls,1);await f.queries.readApi('/progress');assert.equal(calls,1);f.client.clear();
});
test('cold hydration seeds confirmed cache before context publication and avoids double fetch',async()=>{
 const f=harness();let calls=0,seeded=false;f.setGet(async()=>{calls++;return {data:{success:true,careerContext:f.context(),data:{}}};});
 f.store.subscribeCareer(()=>{seeded=Boolean(f.client.getQueryData(f.queries.apiQueryOptions('/progress').queryKey));});
 await f.client.fetchQuery(f.queries.apiQueryOptions('/progress'));assert.equal(seeded,true);
 await f.client.fetchQuery(f.queries.apiQueryOptions('/progress'));assert.equal(calls,1);f.client.clear();
});
test('career switch and A-B-A reject old resource responses even when role repeats',async()=>{
 const f=harness();f.store.acceptCareerContext(f.context());let finish;
 f.setGet(()=>new Promise(resolve=>finish=resolve));const old=f.queries.apiQueryOptions('/progress');const pending=old.queryFn({signal:new AbortController().signal});
 f.store.invalidateCareer(['progress','roadmap']);f.store.acceptCareerContext(f.context('Mobile Developer',2,1,2));f.store.invalidateCareer(['progress','roadmap']);f.store.acceptCareerContext(f.context('Backend Developer',3,1,3));
 finish({data:{success:true,careerContext:f.context('Backend Developer',1,1,1)}});await assert.rejects(pending,/dependencies changed/);assert.notDeepEqual(old.queryKey,f.queries.apiQueryOptions('/progress').queryKey);f.client.clear();
});
test('older career/evidence revisions and foreign owners cannot publish context',()=>{
 const f=harness();f.store.acceptCareerContext(f.context('Mobile Developer',3,4,5));
 for(const next of [f.context('Backend Developer',2,4,5),f.context('Backend Developer',3,4,5),f.context('Mobile Developer',3,3,5),f.context('Mobile Developer',-1,4,5),f.context('',4,4,5),{...f.context(),owner:'other'}])assert.equal(f.store.acceptCareerContext(next),false);
 assert.equal(f.store.activeCareer().targetRole,'Mobile Developer');
});
test('task revisions do not invalidate Progress, evidence and role changes do',()=>{
 const f=harness();f.store.acceptCareerContext(f.context());const key=f.store.careerScope('/progress');f.store.acceptCareerContext(f.context('Backend Developer',2,1,2));assert.equal(f.store.careerScope('/progress'),key);
 f.store.acceptCareerContext(f.context('Backend Developer',2,2,2));assert.notEqual(f.store.careerScope('/progress'),key);
});
test('CV and interview writes invalidate evidence views, job location leaves Progress untouched',()=>{
 const f=harness();f.store.acceptCareerContext(f.context());const before=f.store.careerScope('/progress'),jobs=f.store.careerScope('/jobs');
 const preferences=f.policy.mutationGroups('/career-automation/job-preferences',{locations:['Baku']});assert.equal(preferences.includes('progress'),false);f.store.invalidateCareer(preferences);assert.equal(f.store.careerScope('/progress'),before);assert.notEqual(f.store.careerScope('/jobs'),jobs);
 for(const path of ['/resume/analyze','/interviews/id/answer','/skills'])assert.ok(f.policy.mutationGroups(path).includes('progress'));
 assert.equal(f.policy.mutationGroups('/career-automation/tasks/task',{status:'completed'}).includes('progress'),false);
});
test('logout and account switching clear context and old owner cannot restore it',()=>{
 const f=harness(),previous=f.context();f.store.acceptCareerContext(previous);f.switchAccount('owner-b');assert.equal(f.store.activeCareer(),undefined);assert.equal(f.store.acceptCareerContext(previous),false);assert.ok(f.queries.apiQueryOptions('/progress').queryKey.includes('owner-b'));f.client.clear();
});
test('raw interview and conversation history are not career scoped',()=>{const f=harness();assert.equal(f.store.careerScope('/cs/conversations'),undefined);assert.equal(f.store.careerScope('/interviews'),undefined);assert.equal(f.policy.mutationGroups('/career-automation/job-preferences',{targetRole:'SQL'}).includes('chat'),false);});
