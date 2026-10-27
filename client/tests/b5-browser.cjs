// Production UI, fully intercepted APIs; no request reaches real user data or inference.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('../../server/node_modules/playwright');
const base=process.env.QUERY_TEST_ORIGIN||'http://127.0.0.1:5176',label=process.env.B5_LABEL||'after';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const src=fs.readFileSync(path.join(__dirname,'cacheFixture.cjs'),'utf8');const progress=vm.runInNewContext('('+src.match(/const progress = (.*);/)[1]+')');
 let role='Backend Developer',revision=1;
 const active=()=>({targetRole:role,roleKey:role.toLowerCase().replaceAll(' ','-'),revision});
 const context=()=>({owner:'route-fixture',activeCareer:active(),evidenceRevision:1,automationRevision:revision,preferencesKey:'preferences'});
 const automation=()=>({_id:'b5-fixture',userId:'route-fixture',__v:revision,status:'active',targetRole:role,careerGoal:'Fixture goal',roadmap:[],tasks:[],jobPreferences:{targetRoles:[role],locations:[],workModes:[],employmentTypes:[],experienceLevels:[]},careerContext:{status:'empty',activeTargetRole:role,generatedForRole:null,evidenceFreshness:'unverified'},settings:{automationEnabled:false},progress:{},jobMatches:[]});
 const f=await require('./cacheFixture.cjs')(browser)(true,{respond:async({endpoint,route,url,send})=>{
  const reply=(data,extra={})=>route.fulfill({json:{success:true,data,careerContext:context(),...extra}});
  if(endpoint==='/career-automation/active-career'){await reply({activeCareer:active()});return true;}
  if(endpoint==='/career-automation/fields'){await send({fields:['Backend Developer','Mobile Developer'].map(name=>({name,slug:name.toLowerCase().replaceAll(' ','-')}))});return true;}
  if(endpoint==='/career-automation'){await reply(automation(),url.searchParams.get('includeSummary')==='true'?{summary:{currentReadinessScore:0}}:{});return true;}
  if(endpoint==='/career-automation/summary'){await reply({currentReadinessScore:0});return true;}
  if(endpoint==='/progress'){await reply({...progress,historyScope:'all-careers',roleSkillProgress:{targetRole:role,roleTitle:role,activeCareer:active(),roleReadiness:null,assessedAverage:null,coveragePercent:0,totalSkills:1,assessedSkills:0,strongSkills:0,priorityGaps:0,strongestSkills:[],focusSkills:[],notAssessedCount:1,skills:[{id:'unknown',name:role==='Backend Developer'?'SQL':'Mobile UI',kind:'core',score:null,status:'not_assessed',evidenceState:'unverified',confidence:null,evidenceCount:0,sources:['resume'],interviewVerified:false,presentInResume:true,reason:'Proficiency is unverified.'}]}});return true;}
  if(endpoint==='/jobs'){await reply({jobs:[],total:0,page:1,totalPages:1,filters:{}});return true;}
  if(endpoint==='/jobs/external/matches'){await reply({jobs:[]});return true;}
  if(endpoint==='/career-automation/job-preferences'){const body=route.request().postDataJSON();assert.equal(body.expectedRevision,revision);role=body.targetRole;revision++;await send({automation:automation(),summary:null,activeCareer:active()});return true;}
  if(['/cs/chat','/career-automation/replan','/jobs/external/refresh'].includes(endpoint))throw Error('Unexpected inference/write');
 }});
 const measurements=[];
 for(const route of ['/dashboard','/dashboard/performance-progress','/dashboard/jobs','/dashboard/career-automation','/dashboard','/dashboard/performance-progress']){
  const before=f.calls.length,start=Date.now();if(!measurements.length)await f.page.goto(base+route);else await f.page.locator(`a.nav-item[href="${route}"]`).first().click();
  if(route.endsWith('performance-progress'))await f.page.getByText(role+' skill mastery',{exact:false}).waitFor();
  else if(route.endsWith('career-automation'))await f.page.getByRole('heading',{name:role,exact:true}).waitFor();
  else if(route.endsWith('jobs'))await f.page.getByRole('heading',{name:/Find jobs that match/}).waitFor();
  else await f.page.locator('.stat-value').first().filter({hasText:'%'}).waitFor({timeout:10000}).catch(async error=>{console.log(JSON.stringify({errors:f.errors,calls:f.calls,body:(await f.page.locator('body').innerText()).slice(0,1200)}));throw error;});
  const visibleMs=Date.now()-start;await f.page.waitForTimeout(350);const calls=f.calls.slice(before).map(({endpoint,search,method})=>({endpoint,search,method}));measurements.push({route,visibleMs,requests:calls.length,calls});
 }
 if(label==='after'){
  assert.equal(f.calls.filter(call=>call.endpoint==='/progress').length,1,'Dashboard and Progress share one fetch');
  assert.equal(f.calls.filter(call=>call.endpoint==='/career-automation/active-career').length,0,'No cold selection waterfall');
  assert.equal(f.calls.filter(call=>call.endpoint==='/career-automation/summary').length,0,'Combined summary');
  const second=await f.context.newPage();await second.goto(base+'/dashboard/performance-progress');await second.getByText('Backend Developer skill mastery',{exact:false}).waitFor();
  await f.page.locator('a.nav-item[href="/dashboard/career-automation"]').first().click();await f.page.getByRole('button',{name:'Job Preferences',exact:true}).click();await f.page.locator('.career-job-preference-field select').first().selectOption('Mobile Developer');await f.page.getByRole('button',{name:'Save Preferences',exact:true}).click();
  await second.getByText('Mobile Developer skill mastery',{exact:false}).waitFor();await second.getByText('Mobile UI',{exact:true}).waitFor();assert.equal(await second.getByText('SQL',{exact:true}).count(),0);
  await f.page.locator('a.nav-item[href="/dashboard/career-assistant"]').first().click();await f.page.getByText('Account career: Mobile Developer.',{exact:false}).waitFor();
  await second.close();
 }
 assert.deepEqual(f.errors,[]);assert.deepEqual(f.unexpected,[]);assert.equal(f.calls.filter(call=>['/cs/chat','/career-automation/replan','/jobs/external/refresh'].includes(call.endpoint)).length,0);
 const output={fixture:true,productionBrowser:true,realBackend:false,realMongo:false,apiDelayMs:120,label,measurements,crossTabTested:label==='after',qwenCalls:0};
 fs.writeFileSync(path.join(__dirname,'../../server/docs/b5/browser-'+label+'.json'),JSON.stringify(output,null,2));await f.context.close();console.log(JSON.stringify(output));
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
