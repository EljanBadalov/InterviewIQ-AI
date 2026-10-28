const test=require('node:test'),assert=require('node:assert/strict');
const f=require('./skill-assessment-reader-fixture.cjs');
const {loadSkillEvidenceAssessment}=f.load('services/skillEvidenceAssessmentService');
const {withRoadmapEvidence}=f.load('services/roadmapEvidenceScope');
const owner=String(f.ownerA),other=String(f.ownerB);
const load=extra=>loadSkillEvidenceAssessment({userId:owner,requiredSkills:['SQL','Docker'],...extra});
test('owned bulk read uses eligible completed sessions and four narrow queries',async()=>{
 f.reset();const result=await load();const sql=result.skills.find(s=>s.normalizedName==='sql');assert.equal(sql.state,'verified_gap');assert.equal(sql.score,25);assert.equal(sql.independentAssessmentCount,2);assert.equal(result.skills.find(s=>s.normalizedName==='docker').score,null);
 assert.equal(f.state.reads.length,4);const completed=f.state.reads.find(r=>r.name==='interviews');assert.equal(String(completed.filter.user),owner);assert.equal(completed.filter.status,'completed');
 for(const read of f.state.reads){assert.equal(read.read,'primary');assert.equal(read.concern,'majority');assert.equal(read.maxTimeMS,5000);assert.ok(!/answerText|rawText|fileName|note|averageScore/.test(read.projection));}
 const question=f.state.reads.find(r=>r.name==='questions');assert.equal(question.filter._id.$in.length,1);
 for(const text of ['PRIVATE CV','PRIVATE FILE','PRIVATE NOTE','PRIVATE ANSWER','PRIVATE QUESTION CONTENT'])assert.equal(JSON.stringify(result).includes(text),false);
});
test('same-owner snapshot reuse shares raw reads but retains separate requirement sets',async()=>{
 f.reset();const [a,b]=await withRoadmapEvidence(owner,()=>Promise.all([load(),load({requiredSkills:['Custom Role Skill']})]));assert.equal(f.state.reads.length,4);assert.ok(b.skills.some(s=>s.name==='Custom Role Skill'));assert.equal(a.skills.some(s=>s.name==='Custom Role Skill'),false);
});
test('fresh requests see updated assessments rather than a persistent stale cache',async()=>{
 f.reset();const a=await load();f.rows.interviews[0].answers[0].score=95;const b=await load();assert.notEqual(a.evidenceVersion,b.evidenceVersion);assert.equal(f.state.reads.length,8);
});
test('different users remain isolated even when read concurrently',async()=>{
 f.reset();const [a,b]=await Promise.all([load(),load({userId:other})]);assert.equal(a.skills.find(s=>s.normalizedName==='sql').state,'verified_gap');assert.equal(b.skills.find(s=>s.normalizedName==='sql').state,'verified_proficiency');assert.notEqual(a.evidenceVersion,b.evidenceVersion);
});
test('foreign returned records and a cross-owner scope fail closed',async()=>{
 f.reset();f.state.injectForeign=true;await assert.rejects(load(),/owner mismatch/);
 f.reset();await assert.rejects(withRoadmapEvidence(owner,()=>load({userId:other})),/owner mismatch/);
});
test('source read failure is not silently converted to no evidence',async()=>{
 f.reset();f.state.fail='interviews';await assert.rejects(load(),/unavailable/);
});
test('no eligible question references avoids a needless catalog query',async()=>{
 f.reset();f.rows.interviews=[];const result=await load();assert.equal(f.state.reads.length,3);assert.equal(result.skills.find(s=>s.normalizedName==='sql').score,null);
});
test('invalid owner or active resume reference fails before reading',async()=>{
 f.reset();await assert.rejects(load({userId:'bad'}),/valid/);await assert.rejects(load({resumeAnalysisId:'bad'}),/valid/);assert.equal(f.state.reads.length,0);
});
test('a foreign selected resume is never used as this users skill evidence',async()=>{
 f.reset();const result=await load({resumeAnalysisId:String(f.id(901))});assert.equal(result.skills.some(s=>s.normalizedName==='docker'&&s.claimSources.includes('resume')),false);
});
test('the explicit profile facade calls assessment without changing legacy profile shapes',async()=>{
 f.reset();const result=await f.load('services/careerSkillProfileService').buildCareerSkillEvidenceAssessment({userId:owner,requiredSkills:['SQL']});assert.equal(result.policyVersion,'skill-evidence-v1');assert.equal(f.state.reads.length,4);
});
test('new interview evaluations reject missing/defaulted scores before persistence',async()=>{
 const qwen=f.load('services/qwenService'),original=qwen.generateQwenJSON,originalDefault=qwen.default.generateQwenJSON;
 const evaluate=f.load('services/interviewEvaluationService').evaluateInterviewAnswer;
 const input={category:'backend',difficulty:'beginner',interviewType:'technical',question:'Fixture question',answer:'Fixture answer'};
 const valid={score:90,technicalAccuracy:95,completeness:85,communication:80};
 try{
  for(const key of Object.keys(valid))for(const value of [undefined,null,'95',NaN,Infinity,-1,101]){
   qwen.generateQwenJSON=qwen.default.generateQwenJSON=async()=>({success:true,data:{...valid,[key]:value}});
   await assert.rejects(evaluate(input),error=>error.code===(value===undefined?'EVALUATION_REQUIRED_FIELDS_MISSING':'EVALUATION_SCORE_INVALID'));
  }
  qwen.generateQwenJSON=qwen.default.generateQwenJSON=async()=>({success:true,data:{...valid,strengths:[],weaknesses:['For the question, include a concrete explanation of the tested concept.'],feedback:'For Fixture question, the excerpt "Fixture answer" needs a concrete explanation to support this evaluation.',improvedAnswer:'For Fixture question, explain the tested concept clearly and include a small relevant example with its expected behavior.',answerEvidence:['Fixture answer'],assessmentBasis:{questionQuote:'Fixture question',strengths:[],weaknesses:['question']}}});const result=await evaluate(input);
  for(const key of Object.keys(valid))assert.equal(result[key],valid[key]);
 }finally{qwen.generateQwenJSON=original;qwen.default.generateQwenJSON=originalDefault;}
});
