const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const f=require('./phase3-fixture.cjs');
const claims=f.load('services/skillEvidenceAssessmentService'),intel=f.load('services/careerIntelligenceService');
test('B5.2 Progress contract equals frozen B4, including history, null scores and IDs',async()=>{
 const result=await f.request(f.progress.getProgressController);
 const before=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/b5/progress-before-contract.json')));
 const body=JSON.parse(JSON.stringify(result.body));assert.equal(body.careerContext.owner,String(f.ownerA));delete body.careerContext;assert.deepEqual(body,before);assert.equal(f.counters.writes,0);
});
test('prepared claim owner and resume selector cannot cross account or selector boundaries',async()=>{
 const frame=await claims.loadAssessmentClaims(String(f.ownerA));
 await assert.rejects(claims.loadSkillEvidenceAssessment({userId:String(f.ownerB),preparedClaims:frame}),/owner/);
 await assert.rejects(claims.loadSkillEvidenceAssessment({userId:String(f.ownerA),resumeAnalysisId:String(f.resumes[0]._id),preparedClaims:frame}),/selector/);
 frame.resume.user=f.ownerB;
 await assert.rejects(claims.loadSkillEvidenceAssessment({userId:String(f.ownerA),preparedClaims:frame}),/owner/);
});
test('prepared snapshots in one operation do not reuse different source identities',async()=>{
 const scope=f.load('services/roadmapEvidenceScope'),owner=String(f.ownerA);
 await scope.withRoadmapEvidence(owner,async()=>{
 const a={owner,resume:null,profile:null},b={owner,resume:{user:f.ownerA,skillsDetected:['SQL']},profile:null};
 const input={userId:owner,reuseRoadmapSources:true,preparedAssessment:{interviews:[],questions:[]}};
 const first=await claims.loadSkillEvidenceAssessment({...input,preparedClaims:a}),second=await claims.loadSkillEvidenceAssessment({...input,preparedClaims:b});
 assert.notEqual(first.evidenceVersion,second.evidenceVersion);assert.ok(second.skills.some(s=>s.name==='SQL'));
 });
});
test('parallel Progress accounts retain ownership and do not write or infer',async()=>{
 const rows=await Promise.all([f.ownerA,f.ownerB].map(owner=>f.request(f.progress.getProgressController,{},owner)));
 assert.equal(rows[0].body.data.completedInterviewsCount,2);assert.equal(rows[1].body.data.completedInterviewsCount,1);assert.equal(f.counters.writes,0);
});

test('roadmap evidence freshness is never inferred from current career identity',()=>{
 const {roadmapReadFreshness}=f.load('services/careerReadContextService'),owner=String(f.ownerA);
 const sections=[{id:'keep',metadata:{roadmapNarrative:{sourceStamp:{owner,evidenceRevision:4,policy:'career-read-provenance-v1'}}}}];
 assert.equal(roadmapReadFreshness(sections,owner,4).evidenceFreshness,'current');assert.equal(roadmapReadFreshness(sections,owner,5).evidenceFreshness,'stale');assert.equal(roadmapReadFreshness([{id:'legacy'}],owner,4).evidenceFreshness,'unverified');assert.equal(roadmapReadFreshness(sections,String(f.ownerB),4).evidenceFreshness,'unverified');assert.equal(roadmapReadFreshness(sections,owner,4).freshness,'unverified');assert.equal(sections[0].id,'keep');
});
test('career envelopes reject foreign automation documents',()=>{const {careerReadContext}=f.load('services/careerReadContextService');assert.throws(()=>careerReadContext(String(f.ownerA),{},null,{userId:f.ownerB}),/owner mismatch/);});

test('question reads start while the independent knowledge lookup is still pending',async()=>{
 const knowledge=f.load('services/careerKnowledgeService'),original=knowledge.buildCareerKnowledgeContext,Question=f.load('models/Question').Question,find=Question.find;
 let release,questionStarted=false;
 knowledge.buildCareerKnowledgeContext=()=>new Promise(resolve=>release=()=>resolve({found:false,topics:[],strongTopics:[],priorityTopics:[],coreSkills:[],roleSkills:[],tools:[],interviewTopics:[],practicalScenarios:[]}));
 Question.find=filter=>{questionStarted=true;return find(filter);};
 try{const pending=f.request(f.progress.getProgressController);await new Promise(resolve=>setTimeout(resolve,60));assert.equal(questionStarted,true);release();await pending;}finally{release?.();knowledge.buildCareerKnowledgeContext=original;Question.find=find;}
});
test('no active career does not read CV/profile or trigger knowledge/generation',async()=>{
 const original=f.Automation.findOne;f.Automation.findOne=filter=>new f.Query('automations',[],filter,true);f.resetCounters();
 try{const result=await f.request(f.progress.getProgressController);assert.equal(result.body.data.roleSkillProgress,null);assert.equal(f.counters.queries.some(q=>['resumes','skills'].includes(q.model)),false);assert.equal(f.counters.writes,0);}finally{f.Automation.findOne=original;}
});
