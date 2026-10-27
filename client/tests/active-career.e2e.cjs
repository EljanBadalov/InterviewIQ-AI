// Isolated browser contexts; all backend APIs are intercepted, never forwarded.
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('../../server/node_modules/playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 let stored=null,patches=0;
 const test=await require('./cacheFixture.cjs')(browser)(true,{respond:async({route,endpoint,send})=>{
  if(endpoint==='/career-automation/fields'){await send({fields:[{slug:'mobile-developer',name:'Mobile Developer',category:'technology'}]});return true;}
  if(endpoint==='/career-automation'||endpoint==='/career-automation/summary'){
   if(!stored)await route.fulfill({status:404,json:{success:false,message:'Career automation was not found.'}});else await send(stored);return true;
  }
  if(endpoint==='/career-automation/job-preferences'){
   patches++;const body=route.request().postDataJSON();assert.equal(body.expectedRevision,null);
   stored={_id:'isolated-shell',__v:0,targetRole:'Mobile Developer',careerGoal:'Explore Mobile Developer',roadmap:[],tasks:[],jobMatches:[],jobPreferences:{targetRoles:['Mobile Developer'],locations:[],workModes:[]}};
   await send({automation:stored,summary:{targetRole:'Mobile Developer'}});return true;
  }
  if(['/jobs/external/refresh','/career-automation/replan'].includes(endpoint))throw new Error('Unexpected generation or job refresh');
 }});
 await test.page.goto('http://127.0.0.1:5176/dashboard/career-automation');
 await test.page.getByRole('button',{name:'Save target career',exact:true}).waitFor();
 await test.page.locator('.career-job-preference-field select').selectOption('Mobile Developer');
 await test.page.screenshot({path:path.resolve(__dirname,'../node_modules/.cache/route-loading-qa/b1-first-career.png'),animations:'disabled'});
 await test.page.getByRole('button',{name:'Save target career',exact:true}).click();
 await test.page.getByRole('heading',{name:'Mobile Developer',exact:true}).waitFor();
 assert.equal(patches,1);assert.ok((await test.page.locator('.career-readiness-pill').innerText()).includes('Not assessed'));
 assert.equal(test.calls.filter(c=>c.method==='POST').length,0);
 assert.equal([...test.scripts].some(p=>/\/lib-/.test(p)),false,'First selection must not eagerly load country-state-city');
 assert.deepEqual(test.errors,[]);assert.deepEqual(test.unexpected,[]);
 await test.context.close();console.log('PASS first career selection, server revision, no inferred readiness, no Refresh Jobs/Qwen and deferred location chunk');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
