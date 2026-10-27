const test=require('node:test'),assert=require('node:assert/strict');
const {assessSkillEvidence,SKILL_ASSESSMENT_POLICY}=require('../dist/services/skillEvidenceAssessment');
const owner='owner-a',other='owner-b';
const question=(id='q1',tags=['SQL'],extra={})=>({_id:id,tags,interviewType:'technical',difficulty:'beginner',updatedAt:'2026-01-01',...extra});
const interview=(id='i1',score=95,extra={})=>({_id:id,user:owner,status:'completed',interviewType:'technical',completedAt:'2026-02-01',answers:[{question:'q1',score,evaluationStatus:'completed'}],...extra});
const snapshot=extra=>({userId:owner,requiredSkills:['SQL'],interviews:[],questions:[question()],...extra});
const result=extra=>assessSkillEvidence(snapshot(extra));
const sql=extra=>result(extra).skills.find(s=>s.normalizedName==='sql');

test('no evidence is unverified with a null measured score',()=>{const row=sql();assert.equal(row.state,'unverified');assert.equal(row.score,null);assert.equal(row.independentAssessmentCount,0);});
test('resume mentions are partial claims, never mastery or a fabricated 68%',()=>{const row=sql({resume:{_id:'r1',user:owner,skillsDetected:['SQL'],overallScore:100}});assert.equal(row.state,'partial_evidence');assert.equal(row.score,null);});
test('CV missingSkills and a skill absent from CV do not establish a gap',()=>{assert.equal(sql({resume:{user:owner,skillsDetected:[],missingSkills:['SQL']}}).state,'unverified');});
test('stored profile scores, confidence, source labels and verification flags cannot authenticate mastery',()=>{
 for(const source of ['manual','quiz','project','resume','technical-question','mock-interview']){const row=sql({profile:{user:owner,skills:[{name:'SQL',averageScore:100,confidence:1,verified:true,evidence:[{source,sourceId:'unresolved',score:99}]}]}});assert.equal(row.state,'partial_evidence');assert.equal(row.score,null);}
});
test('one eligible strong interview verifies only the declared assessed skills',()=>{const row=sql({interviews:[interview()]});assert.equal(row.state,'verified_proficiency');assert.equal(row.score,95);assert.deepEqual(row.assessments[0].levels,['beginner']);});
test('one low measurement remains partial rather than a verified gap',()=>{const row=sql({interviews:[interview('i1',10)]});assert.equal(row.state,'partial_evidence');assert.equal(row.score,10);});
test('two consistently low completed sessions establish a measured skill gap',()=>{const row=sql({interviews:[interview('i1',10),interview('i2',30)]});assert.equal(row.state,'verified_gap');assert.equal(row.score,20);});
test('resume presence cannot raise a verified low assessment to a legacy score floor',()=>{const row=sql({resume:{user:owner,skillsDetected:['SQL']},interviews:[interview('i1',10),interview('i2',30)]});assert.equal(row.state,'verified_gap');assert.equal(row.score,20);});
test('repeated good assessments meet the published proficiency policy',()=>{assert.equal(sql({interviews:[interview('i1',80),interview('i2',85)]}).state,'verified_proficiency');assert.equal(SKILL_ASSESSMENT_POLICY.strongSingle,90);});
test('conflicting strong and weak results are explicitly partial',()=>{const row=sql({interviews:[interview('i1',99),interview('i2',10)]});assert.equal(row.state,'partial_evidence');assert.equal(row.reason,'conflicting_results');});
test('in-progress, cancelled and failed evaluations are not eligible',()=>{
 for(const status of ['in_progress','cancelled'])assert.equal(sql({interviews:[interview('i1',99,{status})]}).score,null);
 for(const evaluationStatus of ['pending','failed'])assert.equal(sql({interviews:[interview('i1',99,{answers:[{question:'q1',score:99,evaluationStatus}]})]}).score,null);
});
test('behavioral grades and missing question references cannot verify technical skill',()=>{
 assert.equal(sql({interviews:[interview()],questions:[question('q1',['SQL'],{interviewType:'behavioral'})]}).score,null);
 assert.equal(sql({interviews:[interview()],questions:[]}).score,null);
});
test('behavioral-context grades cannot authenticate technical proficiency even with technical question tags',()=>{assert.equal(sql({interviews:[interview('i1',94,{interviewType:'behavioral',overallScore:1})]}).score,null);});
test('invalid numeric inputs are rejected, including invalid technical accuracy',()=>{
 for(const score of [NaN,Infinity,-1,101,'95',null,undefined])assert.equal(sql({interviews:[interview('i1',0,{answers:[{question:'q1',score,evaluationStatus:'completed'}]})]}).score,null);
 for(const technicalAccuracy of [NaN,Infinity,-1,101,'95',null])assert.equal(sql({interviews:[interview('i1',95,{answers:[{question:'q1',score:95,technicalAccuracy,evaluationStatus:'completed'}]})]}).score,null);
});
test('an actual zero is measured and does not mean missing evidence',()=>{const row=sql({interviews:[interview('i1',0),interview('i2',0)]});assert.equal(row.score,0);assert.equal(row.state,'verified_gap');});
test('technical weighting agrees with the valid legacy per-question formula',()=>{assert.equal(sql({interviews:[interview('i1',50,{answers:[{question:'q1',score:50,technicalAccuracy:100,evaluationStatus:'completed'}]})]}).score,80);});
test('exact duplicate answers, interview snapshots and question rows do not change the result',()=>{
 const one=interview();const a=result({interviews:[one]});const b=result({interviews:[one,structuredClone(one)],questions:[question(),question()]});assert.deepEqual(a,b);
});
test('rolling averages are replaced by one deterministic arithmetic mean per session',()=>{
 const answers=[20,60,100].map((score,i)=>({question:'q'+i,score,evaluationStatus:'completed'}));const questions=answers.map(a=>question(a.question));
 const a=result({interviews:[interview('i1',0,{answers})],questions});const b=result({interviews:[interview('i1',0,{answers:[...answers].reverse()})],questions:[...questions].reverse()});
 assert.equal(a.skills[0].score,60);assert.equal(a.skills[0].independentAssessmentCount,1);assert.equal(a.skills[0].eligibleAnswerCount,3);assert.deepEqual(a,b);
});
test('many questions in one interview do not impersonate independent assessments',()=>{
 const answers=Array.from({length:8},(_,i)=>({question:'q'+i,score:80,evaluationStatus:'completed'}));const row=sql({interviews:[interview('i1',0,{answers})],questions:answers.map(a=>question(a.question))});assert.equal(row.state,'partial_evidence');assert.equal(row.independentAssessmentCount,1);
});
test('session weighting is independent of how many questions one session contains',()=>{
 const questions=[question('q1'),question('q2'),question('q3')];const rows=[interview('i1',90,{answers:['q1','q2','q3'].map(question=>({question,score:90,evaluationStatus:'completed'}))}),interview('i2',50)];assert.equal(sql({interviews:rows,questions}).score,70);
});
test('legacy aggregates never add a second sample or override source answers',()=>{
 const source={interviews:[interview('i1',20),interview('i2',30)]};const expected=sql(source);
 const actual=sql({...source,profile:{user:owner,skills:[{name:'SQL',averageScore:99,confidence:1,evidence:[{source:'technical-question',sourceId:'i1',score:99},{source:'technical-question',sourceId:'i1',score:99}]}]}});
 assert.equal(actual.score,expected.score);assert.equal(actual.independentAssessmentCount,2);assert.equal(actual.state,'verified_gap');
});
test('conflicting duplicate answers block the affected skill/session instead of choosing a high score',()=>{
 const answers=[{question:'q1',score:99,evaluationStatus:'completed'},{question:'q1',score:10,evaluationStatus:'completed'},{question:'q2',score:99,evaluationStatus:'completed'}];
 const row=sql({interviews:[interview('i1',0,{answers})],questions:[question(),question('q2')]});assert.equal(row.score,null);assert.equal(row.independentAssessmentCount,0);assert.equal(row.state,'partial_evidence');
});
test('alias duplicates count once, while related technologies are not inherited',()=>{
 const data=result({requiredSkills:['JavaScript','React','C#','C++'],questions:[question('q1',['JS','JavaScript','backend','advanced'])],interviews:[interview()]});
 assert.equal(data.skills.find(s=>s.normalizedName==='javascript').eligibleAnswerCount,1);assert.equal(data.skills.find(s=>s.normalizedName==='react').score,null);assert.notEqual(data.skills.find(s=>s.normalizedName==='c#').normalizedName,data.skills.find(s=>s.normalizedName==='c++').normalizedName);assert.equal(data.skills.some(s=>s.normalizedName==='advanced'),false);
});
test('arbitrary supported career skills work without a Mobile-specific whitelist',()=>{
 const name='Custom Scientific Instrument Calibration';const data=result({requiredSkills:[name],questions:[question('q1',[name])],interviews:[interview()]});assert.equal(data.skills.find(s=>s.normalizedName===name.toLowerCase()).state,'verified_proficiency');
});
test('all source containers enforce owner isolation',()=>{
 for(const value of [{resume:{user:other,skillsDetected:['SQL']}},{profile:{user:other,skills:[]}},{interviews:[interview('i1',99,{user:other})]}])assert.throws(()=>result(value),/owner mismatch/);
});
test('duplicate catalog or status snapshots that disagree fail closed',()=>{
 assert.throws(()=>result({questions:[question(),question('q1',['React'])]}),/Conflicting/);
 assert.throws(()=>result({interviews:[interview(),interview('i1',99,{status:'cancelled'})]}),/Conflicting/);
});
test('question metadata edited after completion is not used as historical skill proof',()=>{assert.equal(sql({questions:[question('q1',['SQL'],{updatedAt:'2026-03-01'})],interviews:[interview()]}).score,null);});
test('input snapshots remain immutable and raw user text never enters output',()=>{
 const input=snapshot({resume:{user:owner,skillsDetected:['SQL'],rawText:'PRIVATE CV'},interviews:[{...interview(),answers:[{question:'q1',score:95,evaluationStatus:'completed',answerText:'PRIVATE ANSWER'}]}],profile:{user:owner,skills:[{name:'SQL',evidence:[{source:'manual',note:'PRIVATE NOTE'}]}]}});const before=structuredClone(input);const output=assessSkillEvidence(input);assert.deepEqual(input,before);for(const text of ['PRIVATE CV','PRIVATE ANSWER','PRIVATE NOTE'])assert.equal(JSON.stringify(output).includes(text),false);
});
test('evidence versions are stable for reordered sources and invalidate on measured changes',()=>{
 const rows=[interview('i1',80),interview('i2',90)];const a=result({interviews:rows}),b=result({interviews:[...rows].reverse()});assert.equal(a.evidenceVersion,b.evidenceVersion);assert.notEqual(a.evidenceVersion,result({interviews:[interview('i1',60),rows[1]]}).evidenceVersion);
});
test('assessment identity preserves the published source policy',()=>{assert.equal(result().policyVersion,'skill-evidence-v1');assert.ok(Object.isFrozen(SKILL_ASSESSMENT_POLICY));});
test('skill names cannot inherit properties from the alias map prototype',()=>{
 const data=result({requiredSkills:['constructor','__proto__','toString']});assert.equal(data.skills.length,3);assert.ok(data.skills.every(row=>typeof row.name==='string'&&row.score===null));
});
test('non-array question tags fail closed rather than becoming evidence',()=>{assert.equal(sql({interviews:[interview()],questions:[question('q1',null)]}).score,null);});
test('assessment remains role-agnostic across all fifteen existing seed specializations',()=>{
 const source=require('node:fs').readFileSync(require('node:path').resolve(__dirname,'../src/scripts/seedCareerKnowledgeIT.ts'),'utf8');
 const blocks=source.split(/const \w+\s*=\s*makeRole\(\{/).slice(1);assert.equal(blocks.length,15);
 for(const block of blocks){const topic=block.match(/topics:\s*\[\s*topic\(\{\s*name:\s*"([^"]+)"/)[1];const data=result({requiredSkills:[topic,'Unverified foundation'],questions:[question('q1',[topic])],interviews:[interview()]});const measured=data.skills.find(s=>s.normalizedName===require('../dist/services/skillEvidenceIdentity').getCanonicalSkillName(topic));assert.equal(measured.state,'verified_proficiency',topic);assert.equal(data.skills.find(s=>s.normalizedName==='unverified foundation').score,null);}
});
test('normalization artifacts and aliases do not create duplicate mastery samples',()=>{
 const data=result({requiredSkills:['SQL','_SQL_'],questions:[question('q1',['SQL','_SQL_','_advanced_'])],interviews:[interview()]});assert.equal(data.skills.length,1);assert.equal(data.skills[0].normalizedName,'sql');assert.equal(data.skills[0].eligibleAnswerCount,1);
});
