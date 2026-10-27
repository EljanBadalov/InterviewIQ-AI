const test=require('node:test'),assert=require('node:assert/strict');
const f=require('./phase3-fixture.cjs'),owner=String(f.ownerA);
const intelligence=f.load('services/careerIntelligenceService'),Question=f.load('models/Question').Question;
let selected='Mobile Developer',version=1,preferences={targetRoles:['Backend Developer'],locations:[],workModes:[],employmentTypes:[],experienceLevels:[],minimumMatchScore:0};
const rows=f.clone(f.interviews),resumeRows=f.clone(f.resumes),originalQuery=Question.find;
f.Automation.findOne=filter=>new f.Query('automations',[{_id:f.id(500),userId:f.ownerA,status:'active',__v:version,targetRole:selected,jobPreferences:preferences,jobMatches:f.jobs.slice(0,3).map(job=>({jobId:job._id,matchScore:99}))}],filter,true);
f.load('services/qwenService').generateQwenJSON=async()=>{throw new Error('Unexpected inference in B4 navigation');};
f.load('services/progressInsightService').generateProgressInsights=async()=>{throw new Error('Unexpected progress inference');};
test.beforeEach(()=>{selected='Mobile Developer';version=1;f.resetCounters();f.interviews.splice(0,f.interviews.length,...f.clone(rows));f.resumes.splice(0,f.resumes.length,...f.clone(resumeRows));Question.find=originalQuery;});
test('Progress uses the active career, retains all-career history, and never displays CV mentions as proficiency',async()=>{
 let result=await f.request(f.progress.getProgressController);assert.equal(result.statusCode,200);let data=result.body.data;
 assert.equal(data.roleSkillProgress.targetRole,'Mobile Developer');assert.equal(data.historyScope,'all-careers');assert.ok(data.roleSkillProgress.skills.every(s=>s.score===null));assert.equal(data.roleSkillProgress.roleReadiness,null);
 const history=data.scoreProgression;selected='Data Analyst';version++;
 result=await f.request(f.progress.getProgressController);assert.equal(result.body.data.roleSkillProgress.targetRole,'Data Analyst');assert.deepEqual(result.body.data.scoreProgression,history);
 assert.ok(result.body.data.roleSkillProgress.skills.some(s=>s.name==='SQL'));assert.ok(!result.body.data.roleSkillProgress.skills.some(s=>s.name==='Mobile UI'));
});
test('no-interview user receives relevant unverified skills without automatic generation',async()=>{
 f.interviews.length=0;const result=await f.request(f.progress.getProgressController);assert.equal(result.statusCode,200);assert.ok(result.body.data.roleSkillProgress.skills.length>0);assert.ok(result.body.data.roleSkillProgress.skills.every(s=>s.score===null));assert.equal(f.counters.writes,0);
});
test('eligible direct assessment verifies only the assessed skill and scope',async()=>{
 selected='Data Analyst';const q=f.id(800);Question.find=filter=>new f.Query('questions',[{_id:q,tags:['SQL'],difficulty:'beginner',interviewType:'technical',updatedAt:new Date('2024-01-01')}],filter);
 f.interviews.splice(0,f.interviews.length,{_id:f.id(99),user:f.ownerA,status:'completed',category:'Unrelated historical category',interviewType:'technical',difficulty:'beginner',overallScore:95,completedAt:new Date('2026-01-01'),answers:[{question:q,evaluationStatus:'completed',score:95,technicalAccuracy:95,weaknesses:[]}]});
 const result=await f.request(f.progress.getProgressController);assert.equal(result.statusCode,200);const sql=result.body.data.roleSkillProgress.skills.find(s=>s.name==='SQL');assert.equal(sql.score,95);assert.equal(sql.evidenceState,'verified_proficiency');assert.equal(result.body.data.roleSkillProgress.roleReadiness,null);
});
test('prepared evidence rejects foreign records without issuing writes',async()=>{
 await assert.rejects(intelligence.buildActiveRoleProgress(owner,{interviews:[{_id:f.id(88),user:f.ownerB,status:'completed',interviewType:'technical',answers:[]}],questions:[]}),/owner mismatch/);assert.equal(f.counters.writes,0);
});
test('role defaults preserve conversation-specific topics, preferences and tracking metadata',()=>{
 const active={targetRole:'Mobile Developer',roleKey:'mobile-developer',revision:2};
 const original={targetRole:'Data Analyst',metadata:{careerSubject:'SQL',recommendedTopics:['joins']}};
 const result=intelligence.conversationCareerContext(original,active);assert.equal(result.targetRole,'Data Analyst');assert.equal(result.metadata.activeCareer.targetRole,'Mobile Developer');assert.deepEqual(original.metadata,{careerSubject:'SQL',recommendedTopics:['joins']});assert.equal(intelligence.conversationCareerContext({},active).targetRole,'Mobile Developer');
});
test('current active role overrides obsolete job target preferences without changing scoring mathematics',async()=>{
 selected='Frontend Developer';const result=await f.request(f.jobsController.getJobs,{limit:'3'});assert.equal(result.statusCode,200);
 const profile=await f.load('services/careerSkillProfileService').buildCareerSkillProfile({userId:owner});
 for(const row of result.body.data.jobs){const expected=f.matching.calculateJobMatch(profile,row,{targetRole:'Frontend Developer',preferredExperienceLevels:[]});for(const key of Object.keys(row.match))assert.deepEqual(row.match[key],expected[key]);}
});
test('external saved candidates are read-only, recalculated and labelled as saved history',async()=>{
 selected='Backend Developer';let writes=0;const save=f.Automation.prototype.save;f.Automation.prototype.save=async()=>{writes++;throw Error('Navigation write');};
 try{const result=await f.request(f.jobsController.getExternalJobMatches);assert.equal(result.statusCode,200);assert.equal(writes,0);assert.equal(result.body.data.matchContext.catalogRefreshed,false);assert.equal(result.body.data.matchContext.targetRole,'Backend Developer');assert.equal(result.body.data.matchContext.candidateSource,'saved-history');}finally{f.Automation.prototype.save=save;}
});
test('historical candidates respect current location, work mode and employment preferences',()=>{
 const {matchesCareerPreferences}=f.load('services/careerMatchPreferences');const job={location:'Baku, Azerbaijan',remoteType:'remote',employmentType:'full-time',experienceLevel:'junior'};
 assert.equal(matchesCareerPreferences(job,{locations:['Baku Azerbaijan'],workModes:['remote']}),true);assert.equal(matchesCareerPreferences(job,{locations:['London']}),false);assert.equal(matchesCareerPreferences(job,{workModes:['onsite']}),false);assert.equal(matchesCareerPreferences(job,{employmentTypes:['contract']}),false);
});
test('parallel users cannot receive each other’s active career or evidence',async()=>{
 const a=intelligence.buildActiveRoleProgress(owner,{interviews:[],questions:[]});const b=intelligence.buildActiveRoleProgress(String(f.ownerB),{interviews:[],questions:[]});const results=await Promise.all([a,b]);assert.ok(results[0]);assert.equal(results[1],null);assert.equal(f.counters.writes,0);
});

test('CV-job ranking applies the requested role and keeps legacy two-argument behavior',()=>{
 const matcher=f.load('services/jobMatchingService');
 for(const options of [undefined,{targetRole:'Mobile Developer'}]){
  const ranked=matcher.rankJobsForResume(f.resumes[0],f.jobs.slice(0,10),options);
  for(const item of ranked)assert.deepEqual(item.match,matcher.calculateJobMatch(f.resumes[0],item.job,options || {}));
  if(options)assert.ok(ranked.some(item=>item.match.breakdown.roleRelevance!==matcher.calculateJobMatch(f.resumes[0],item.job,{}).breakdown.roleRelevance));
 }
});
