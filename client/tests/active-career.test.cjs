const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const file=path.resolve(__dirname,'../src/pages/dashboard/careerAutomationPage/careerAutomationPage.tsx');
const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let handler;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='handleSaveJobPreferences')handler=node.initializer;ts.forEachChild(node,visit);}visit(source);assert.ok(handler);
const code=ts.transpileModule('export const run = '+handler.getText(source)+';', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function fixture(overrides={}){
 const writes=[];const context={exports:{},console:{error(){}},targetRoleInput:'Mobile Developer',buildSelectedLocation:()=>'',careerFields:[{name:'Mobile Developer'}],workModeInput:'any',automation:{__v:7},preferenceFlight:{current:false},preferenceVersion:{current:0},updateCareerJobPreferences:async payload=>{writes.push(['request',payload]);return {automation:{targetRole:'Canonical Mobile Developer',__v:8},summary:{targetRole:'Canonical Mobile Developer'}};},refreshExternalCareerJobs:async()=>{throw new Error('Unexpected refresh');},replanCareerAutomation:async()=>{throw new Error('Unexpected generation');},...overrides};
 for(const name of ['setPreferencesMessage','setPreferencesMessageType','setPreferencesSaving','setJobsError','setAutomation','setSummary','setExternalJobs','setJobPreferencesOpen'])context[name]=value=>writes.push([name,value]);
 vm.runInNewContext(code,context);return {context,writes,run:context.exports.run};
}
test('save sends expected revision, accepts canonical response and does not refresh jobs',async()=>{
 const f=fixture();await f.run();const payload=f.writes.find(w=>w[0]==='request')[1];assert.equal(payload.expectedRevision,7);assert.equal(payload.targetRole,'Mobile Developer');
 assert.equal(f.writes.find(w=>w[0]==='setAutomation')[1].targetRole,'Canonical Mobile Developer');assert.equal(f.context.preferenceFlight.current,false);assert.ok(f.writes.some(w=>w[0]==='setExternalJobs'&&w[1].length===0));
});
test('first selection explicitly expects no record',async()=>{const f=fixture({automation:null});await f.run();assert.equal(f.writes.find(w=>w[0]==='request')[1].expectedRevision,null);});
test('parallel clicks share only one save request',async()=>{
 let resolve,calls=0;const f=fixture({updateCareerJobPreferences:()=>{calls++;return new Promise(r=>resolve=r);}});
 const pending=f.run();await f.run();assert.equal(calls,1);resolve({automation:{targetRole:'Mobile Developer'},summary:null});await pending;assert.equal(f.context.preferenceFlight.current,false);
});
test('unmounted or superseded handler cannot apply a late response',async()=>{
 let resolve;const f=fixture({updateCareerJobPreferences:()=>new Promise(r=>resolve=r)});const pending=f.run();f.context.preferenceVersion.current++;resolve({automation:{targetRole:'Old response'},summary:null});await pending;assert.equal(f.writes.filter(w=>w[0]==='setAutomation').length,0);
});
test('409 displays a reload message without retrying the stale mutation',async()=>{
 let calls=0;const f=fixture({updateCareerJobPreferences:async()=>{calls++;throw {response:{status:409}};}});await f.run();assert.equal(calls,1);assert.ok(f.writes.some(w=>w[0]==='setPreferencesMessage'&&w[1]?.includes('Reload')));assert.equal(f.writes.filter(w=>w[0]==='setAutomation').length,0);
});
test('invalid catalog choice never sends a request',async()=>{const f=fixture({targetRoleInput:'Unknown'});await f.run();assert.equal(f.writes.filter(w=>w[0]==='request').length,0);});
