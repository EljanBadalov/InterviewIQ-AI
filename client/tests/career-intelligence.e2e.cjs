// Production frontend with isolated accounts and fully intercepted APIs; never forwards backend traffic.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('../../server/node_modules/playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const fixtureSource=fs.readFileSync(path.join(__dirname,'cacheFixture.cjs'),'utf8');const baseProgress=vm.runInNewContext('('+fixtureSource.match(/const progress = (.*);/)[1]+')');
 let role='Backend Developer',revision=1,patches=0;
 const active=()=>({targetRole:role,roleKey:role.toLowerCase().replaceAll(' ','-'),revision});
 const automation=()=>({_id:'b4-fixture',__v:revision,userId:'route-fixture',status:'active',targetRole:role,careerGoal:'Fixture career goal',roadmapDurationDays:90,currentReadinessScore:88,jobPreferences:{targetRoles:[role],locations:[],workModes:[],employmentTypes:[],experienceLevels:[]},settings:{automationEnabled:false},tasks:[],progress:{},jobMatches:[],careerContext:{status:role==='Backend Developer'?'current':'stale',generatedForRole:'Backend Developer',activeTargetRole:role},roadmap:[{id:'saved-core',order:1,category:'CORE_SKILLS',title:'Saved foundations',description:'Saved learning guidance',status:'not_started',relatedSkills:['Git'],recommendations:[{title:'Git',whatToLearn:['Branches','Merge conflicts'],action:'Resolve a sample merge conflict.',proofOfCompletion:'Pass a merge and revert check.',priority:'high',evidence:['Proficiency is unverified.']}],metadata:{roadmapNarrative:{nodes:[{learning:{state:'unverified',score:null}}]}}}]});
 const fixture=await require('./cacheFixture.cjs')(browser)(true,{respond:async({endpoint,route,send})=>{
  if(endpoint==='/career-automation/active-career'){await send({activeCareer:active()});return true;}
  if(endpoint==='/career-automation/fields'){await send({fields:['Backend Developer','Mobile Developer'].map(name=>({name,slug:name.toLowerCase().replaceAll(' ','-')}))});return true;}
  if(endpoint==='/career-automation'){await send(automation());return true;}
  if(endpoint==='/career-automation/summary'){await send(null);return true;}
  if(endpoint==='/career-automation/job-preferences'){const body=route.request().postDataJSON();assert.equal(body.expectedRevision,revision);role=body.targetRole;revision++;patches++;await send({automation:automation(),summary:null,activeCareer:active()});return true;}
  if(endpoint==='/progress'){const name=role==='Mobile Developer'?'Mobile UI':'SQL';await send({...baseProgress,historyScope:'all-careers',roleSkillProgress:{targetRole:role,roleTitle:role,activeCareer:active(),roleReadiness:null,assessedAverage:null,coveragePercent:0,totalSkills:1,assessedSkills:0,strongSkills:0,priorityGaps:0,strongestSkills:[],focusSkills:[],notAssessedCount:1,skills:[{id:'unknown',name,kind:'core',score:null,status:'not_assessed',evidenceState:'unverified',confidence:null,evidenceCount:0,sources:['resume'],interviewVerified:false,presentInResume:true,reason:'Proficiency is unverified; a CV mention does not verify mastery.'}]}});return true;}
  if(endpoint==='/jobs/external/refresh'||endpoint==='/career-automation/replan'||endpoint==='/cs/chat')throw Error('Unexpected inference or generation action');
 }});
 const {page}=fixture;await page.goto('http://127.0.0.1:5176/dashboard/career-automation');await page.getByRole('heading',{name:'Backend Developer',exact:true}).waitFor();
 await page.getByRole('button',{name:'Job Preferences',exact:true}).click();await page.locator('#career-job-preferences-title').waitFor();
 await page.locator('.career-job-preference-field select').first().selectOption('Mobile Developer');await page.getByRole('button',{name:'Save Preferences',exact:true}).click();
 await page.getByText('Saved roadmap for Backend Developer.',{exact:false}).waitFor();assert.equal(patches,1);assert.ok((await page.locator('.career-readiness-pill').innerText()).includes('Not assessed'));
 await page.goto('http://127.0.0.1:5176/dashboard/performance-progress');await page.getByText('Mobile Developer skill mastery',{exact:false}).waitFor();await page.getByText('Mobile UI',{exact:true}).waitFor();assert.ok((await page.locator('.performance-role-skill-card').innerText()).includes('Unverified'));
 await page.goto('http://127.0.0.1:5176/dashboard/jobs');await page.getByRole('heading',{name:/Find jobs that match/}).waitFor();assert.ok((await page.getByRole('heading',{name:/Find jobs that match/}).innerText()).includes('Mobile Developer'));
 await page.goto('http://127.0.0.1:5176/dashboard/career-assistant');await page.getByPlaceholder('Ask InterviewIQ about your career...').waitFor();
 assert.equal(fixture.calls.filter(c=>c.endpoint==='/cs/chat').length,0);assert.deepEqual(fixture.errors,[]);assert.deepEqual(fixture.unexpected,[]);
 await page.screenshot({path:path.resolve(__dirname,'../../server/docs/b4/b4-browser.png'),animations:'disabled'});
 await fixture.context.close();console.log('PASS career switching, saved-roadmap warning, unknown evidence, active Jobs context, direct navigation, Assistant history and no automatic generation; all backend APIs intercepted');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
