const fs=require('node:fs');
const path=require('node:path');
const {performance}=require('node:perf_hooks');
const f=require('./phase4-roadmap-fixture.cjs');
const {scenario}=require('./phase4-roadmap-benchmark.cjs');
const mode=process.env.PHASE4_BASELINE==='1'?'before':'after';
const trace=[];
for(const [moduleName,method,label] of [
 ['careerGoalService','buildCareerGoalContext','goal-total'],['careerNextStepsService','buildCareerNextStepsContext','next-steps'],
 ['careerContextService','resolveResumeContext','resume'],['careerInterviewContextService','resolveCareerInterviewContext','interview'],
 ['careerProgressService','buildCareerProgressContext','progress'],['careerSkillProfileService','buildCareerSkillProfile','skill-profile'],
 ['careerKnowledgeService','buildCareerKnowledgeContext','knowledge'],['careerJobContextService','getCareerJobMatches','job-matches'],
]){
 const module=f.load(`services/${moduleName}`),original=module[method];
 module[method]=async(...args)=>{const started=performance.now();try{return await original(...args);}finally{trace.push({stage:label,durationMs:performance.now()-started});}};
}
(async()=>{
 const output={fixture:true,mode,samplesPerOperation:1,operations:{}};
 for(const name of ['create','replan','progress-refresh']){
  trace.length=0;
  const result=await scenario(name);
  output.operations[name]={elapsedMs:result.elapsedMs,queryCount:result.queries,qwen:result.qwen,stages:[...trace]};
 }
 fs.writeFileSync(path.resolve(__dirname,`../node_modules/.cache/phase4ab/stages-${mode}.json`),JSON.stringify(output,null,2));
 process.stdout.write(JSON.stringify(output)+'\n');
})().catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
