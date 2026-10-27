const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks'),crypto=require('node:crypto');
const f=require('./skill-assessment-fixture.cjs'),service=f.load('services/careerSkillProfileService');
(async()=>{const rows=[];let profile,match;for(let i=0;i<100;i++){f.resetCounters();const start=performance.now();profile=await service.buildCareerSkillProfile({userId:f.user});match=f.matching.calculateJobMatch(profile,f.jobs[0],{targetRole:'Backend Developer'});rows.push({ms:performance.now()-start,reads:f.counters.queries.length});}
const times=rows.map(r=>r.ms).sort((a,b)=>a-b);const {generatedAt,...stable}=profile;
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const result={fixture:true,samples:100,queryStubDelayMs:2,path:'legacy profile + matching',reads:rows.at(-1).reads,qwenCalls:0,p50Ms:times[49],p95Ms:times[94],profileDigest:digest(stable),matchDigest:digest(match),source:'existing fixture profile, same data and runner before/after'};
const label=process.env.B3_BASELINE==='1'?'before':'after';fs.writeFileSync(path.resolve(__dirname,`../docs/b3/legacy-${label}.json`),JSON.stringify(result,null,2));console.log(JSON.stringify(result));})().catch(e=>{console.error(e);process.exitCode=1;});
