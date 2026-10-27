// New assessment cost only; not a substitute for the unchanged legacy matching baseline.
const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
const f=require('./skill-assessment-reader-fixture.cjs');
const {assessSkillEvidence}=f.load('services/skillEvidenceAssessment');
const {loadSkillEvidenceAssessment}=f.load('services/skillEvidenceAssessmentService');
const owner=String(f.ownerA);
const summarize=rows=>{rows.sort((a,b)=>a-b);return {n:rows.length,p50Ms:rows[49],p95Ms:rows[94]};};
(async()=>{
 const pure=[],reader=[];const questions=Array.from({length:6},(_,i)=>({_id:'q'+i,interviewType:'technical',difficulty:'intermediate',tags:['Skill '+i,'Shared technical skill']}));
 const interviews=Array.from({length:200},(_,i)=>({_id:'i'+i,user:owner,status:'completed',interviewType:'technical',answers:questions.map((q,j)=>({question:q._id,score:60+(i+j)%35,evaluationStatus:'completed'}))}));
 let assessment,reads;
 for(let i=0;i<100;i++){
  const started=performance.now();assessment=assessSkillEvidence({userId:owner,requiredSkills:['Unverified requirement'],interviews,questions});pure.push(performance.now()-started);
 }
 for(let i=0;i<100;i++){
  f.reset();const started=performance.now();await loadSkillEvidenceAssessment({userId:owner,requiredSkills:['SQL','Unknown']});reader.push(performance.now()-started);reads=f.state.reads.length;
 }
 const result={fixture:true,pure:{...summarize(pure),interviews:200,answers:1200,skills:assessment.skills.length,dbReads:0},reader:{...summarize(reader),queryStubDelayMs:2,logicalReads:reads},qwenCalls:0,notes:'Only new assessment cost. Pure timings are local CPU; reader timings use mock queries, not MongoDB latency.'};
 fs.writeFileSync(path.resolve(__dirname,'../docs/b2/assessment-cost.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(error=>{console.error(error);process.exitCode=1;});
