const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {QueryClient}=require('@tanstack/react-query');
function moduleFile(file,globals={}){const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;const context={exports:{},...globals};vm.runInNewContext(code,context);return context.exports;}
const policy=moduleFile('query/careerSelectionPolicy.ts');
test('older or contradictory career mutation replies cannot replace the authoritative selection',()=>{
 const current={targetRole:'Mobile Developer',roleKey:'mobile-developer',revision:4};assert.equal(policy.canApplyCareerSelection(current,{targetRole:'Backend Developer',roleKey:'backend-developer',revision:3}),false);assert.equal(policy.canApplyCareerSelection(current,{targetRole:'Backend Developer',roleKey:'backend-developer',revision:4}),false);assert.equal(policy.canApplyCareerSelection(current,{targetRole:'Data Analyst',roleKey:'data-analyst',revision:5}),true);
});
function expression(file,name,globals){const source=ts.createSourceFile(file,fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let found;function walk(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name)found=n.getText(source);if(ts.isVariableDeclaration(n)&&n.name.getText(source)===name)found='export const '+name+'='+n.initializer.getText(source);ts.forEachChild(n,walk);}walk(source);assert.ok(found,name);const code=ts.transpileModule(found,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;const context={exports:{},...globals};vm.runInNewContext(code,context);return context.exports[name];}
const queryPolicy=moduleFile('query/queryPolicy.ts',{URL});
test('late old-career query results cannot overwrite a new-career cache entry',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});let finishOld;let calls=0;
 const options=expression('query/apiQueries.ts','apiQueryOptions',{...queryPolicy,careerRequestToken:()=> 'stable',careerScope:()=>undefined,acceptCareerContext:()=>true,sessionSnapshot:()=>JSON.stringify(['owner',1]),accountId:()=> 'owner',sessionEpoch:()=>1,queryOptions:x=>x,apiClient:{get:()=>++calls===1?new Promise(r=>finishOld=r):Promise.resolve({data:{role:'Mobile Developer'}})}});
 const old=options('/progress',undefined,'backend:1'),fresh=options('/progress',undefined,'mobile:2');assert.notDeepEqual(old.queryKey,fresh.queryKey);
 const pending=client.fetchQuery(old);const result=await client.fetchQuery(fresh);finishOld({data:{role:'Backend Developer'}});await pending;
 assert.equal(result.role,'Mobile Developer');assert.equal(client.getQueryData(fresh.queryKey).role,'Mobile Developer');client.clear();
});
const nodeBuilder=expression('pages/dashboard/careerAutomationPage/careerAutomationPage.tsx','buildSkillNodesFromRoadmap',{uniqueStrings:xs=>[...new Set(xs)],roadmapCategoryToStatus:()=> 'priority'});
function roadmap(state,score,context='current'){return {careerContext:{status:context},roadmap:[{id:'saved',category:'CORE_SKILLS',title:'Foundation',status:'not_started',readinessScore:88,recommendations:[{title:'Git',whatToLearn:['Branches'],evidence:[]}],metadata:{roadmapNarrative:{nodes:[{learning:{state,score}}]}}}]};}
test('skill nodes use verified per-node evidence and never the section average',()=>{assert.equal(nodeBuilder(roadmap('unverified',null))[0].score,undefined);assert.equal(nodeBuilder(roadmap('partial_evidence',85))[0].score,undefined);assert.equal(nodeBuilder(roadmap('verified_proficiency',95))[0].score,95);});
test('historical or unverifiable roadmap percentages are hidden even if they contain old scores',()=>{assert.equal(nodeBuilder(roadmap('verified_proficiency',95,'stale'))[0].score,undefined);assert.equal(nodeBuilder(roadmap('verified_proficiency',95,'unverified'))[0].score,undefined);});

test('historical retained milestones do not become current skill nodes',()=>{
 const saved=roadmap('verified_proficiency',95);saved.roadmap[0].metadata.retainedForCompletedTasks=true;assert.equal(nodeBuilder(saved).length,0);
});
