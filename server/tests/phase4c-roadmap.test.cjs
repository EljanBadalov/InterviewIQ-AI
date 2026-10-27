const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const f=require('./phase4c-roadmap-fixture.cjs');
const cache=f.load('services/roadmapNarrativeCache');
const narrative=f.load('services/roadmapNarrativeService');
const next=f.load('services/careerNextStepsService');
const owner=String(f.ownerA), other=String(f.ownerB);
const json=value=>JSON.parse(JSON.stringify(value));
const notes=result=>result.roadmap.filter(section=>!section.metadata?.retainedForCompletedTasks).flatMap(section=>section.metadata.roadmapNarrative.nodes);
// Keep historical goldens immutable; B3 intentionally adds assessed learning/frontier behavior.
const crossPageMode=fs.existsSync(path.join(f.root,'services/careerIntelligenceService.js'));
// R1 intentionally removes only the controller's post-commit summary lookup.
const summaryRead=typeof f.load('services/roadmapGenerationMetrics').withGenerationResponseMetrics==='function'?0:1;
const foundationMode=fs.existsSync(path.join(f.root,'services/careerLearningPlanner.js'));
const generativeNotes=result=>notes(result).filter(node=>!node.learning);
const golden=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/phase4ab/golden-before.json')));
async function create(){f.reset();return f.service.createCareerAutomation(f.input());}
async function replan(){return f.service.replanCareerAutomation({userId:owner,preserveCompletedTasks:true});}
function clearCalls(){f.inference.calls.length=0;f.resetCounters();}
const sourceResume=f.clone(f.resumes[0]);
const sourceInterview=f.clone(f.interviews[1]);
test.afterEach(()=>{Object.assign(f.resumes[0],f.clone(sourceResume));Object.assign(f.interviews[1],f.clone(sourceInterview));});

test('cold create: bounded text-only inference and unchanged controller/readiness contract',async()=>{
 f.reset();const response=await f.invoke(f.controller.createAutomation,f.input());
 assert.equal(response.statusCode,201);
 const result=response.body.data.automation;
 assert.deepEqual(Object.keys(response.body).sort(),Object.keys(golden.create.freshRoadmap.body).sort());
 assert.deepEqual(Object.keys(response.body.data).sort(),Object.keys(golden.create.freshRoadmap.body.data).sort());
 assert.deepEqual(Object.keys(result).sort(),Object.keys(golden.create.freshRoadmap.body.data.automation).sort());
 if(!crossPageMode)assert.equal(result.currentReadinessScore,golden.create.legacy.body.data.automation.currentReadinessScore);
 assert.deepEqual(result.roadmap.map(m=>m.category),golden.create.legacy.body.data.automation.roadmap.map(m=>m.category));
 assert.equal(f.counters.queries.length,(foundationMode?8:6)+summaryRead);assert.equal(f.inference.calls.length,1);
 assert.ok(notes(result).length<=18);assert.ok(result.roadmap.every(m=>m.recommendations.length>=2 || (foundationMode && m.category==='ROLE_SKILLS' && m.recommendations.length===0 && m.readinessScore===undefined)));
 const call=f.inference.calls[0];assert.equal(call.maxTokens,1800);assert.equal(call.timeoutMs,300000);assert.equal(call.retries,0);assert.equal(call.temperature,.35);assert.equal(call.topP,.9);
 assert.ok(call.promptBytes<13293);
 if(crossPageMode){const context=await f.goal.buildCareerGoalContext(f.input());assert.equal(result.currentReadinessScore,f.load('services/roadmapPlanningService').calculateReadinessScore(context.data));}
});

test('identical replan and progress refresh reuse all narrative without Qwen',async()=>{
 const initial=await create();const ids=initial.roadmap.map(m=>m.id);
 clearCalls();const result=await replan();
 assert.equal(f.inference.calls.length,0);assert.equal(f.counters.queries.length,foundationMode?8:6);
 assert.deepEqual(result.roadmap.map(m=>m.id),ids);assert.deepEqual(notes(result),notes(initial));
 clearCalls();const response=await f.invoke(f.controller.refreshAutomationProgress);
 assert.equal(response.statusCode,200);assert.equal(f.inference.calls.length,0);assert.equal(f.counters.queries.length,(foundationMode?8:6)+summaryRead);
});

test('persisted metadata survives process-cache eviction and cloned document hydration',async()=>{
 const initial=await create();cache.clearRoadmapNarrativeCache();clearCalls();
 const result=await replan();assert.equal(f.inference.calls.length,0);assert.deepEqual(notes(result),notes(initial));
});

test('single skill evidence change regenerates only affected nodes in one batch',async()=>{
 const initial=await create();const old=notes(initial);f.resumes[0].skillsDetected.push('API Testing');clearCalls();
 const result=await replan();const changed=notes(result).filter(n=>!old.some(o=>o.id===n.id&&o.version===n.version));
 assert.equal(f.inference.calls.length,1);assert.ok(changed.length>0&&changed.length<notes(result).length);
 assert.equal(f.inference.calls[0].nodes,changed.length);
 for(const current of notes(result).filter(n=>old.some(o=>o.id===n.id&&o.version===n.version)))assert.deepEqual(current,old.find(o=>o.id===current.id));
 assert.deepEqual(result.roadmap.map(m=>m.id),initial.roadmap.map(m=>m.id));
});

for(const kind of ['resume','interview'])test(`${kind} content revision invalidates its category, without unrelated AI generation`,async()=>{
 const initial=await create();
 if(kind==='resume')f.resumes[0].summary='Updated evidence about backend delivery';
 else f.interviews[1].finalReport.summary='Updated interview evidence';
 clearCalls();const result=await replan();const old=notes(initial);const changed=notes(result).filter(n=>!old.some(o=>o.id===n.id&&o.version===n.version));
 assert.equal(f.inference.calls.length,1);assert.ok(changed.length>0);assert.ok(changed.length<notes(result).length);
 const category=kind==='resume'?'CV':'INTERVIEW';const allowed=result.roadmap.find(m=>m.category===category).metadata.roadmapNarrative.nodes.map(n=>n.id);
 assert.ok(changed.every(n=>allowed.includes(n.id)));
});

test('target role change invalidates narrative but retains public IDs and completed links',async()=>{
 const initial=await create();f.store.get(owner).targetRole='Frontend Developer';clearCalls();
 const result=await replan();assert.equal(f.inference.calls.length,1);assert.equal(f.inference.calls[0].nodes,generativeNotes(result).length);
 for(const m of result.roadmap){const old=initial.roadmap.find(o=>o.category===m.category);if(old){if(!crossPageMode || m.metadata?.retainedForCompletedTasks)assert.equal(m.id,old.id);else assert.notEqual(m.id,old.id,'A different career receives a distinct current milestone');}}
 assert.ok(!notes(result).some(n=>notes(initial).some(o=>o.id===n.id)));
});

test('knowledge revision invalidates every node; topic content invalidates only dependent nodes',async()=>{
 await create();const version=f.role.sourceVersion;
 try{f.role.sourceVersion='fixture-v2';clearCalls();let result=await replan();assert.equal(f.inference.calls[0].nodes,generativeNotes(result).length);
 const old=notes(result);f.role.role.topics[0].subtopics.push('Query plans');clearCalls();result=await replan();
 const changed=notes(result).filter(n=>!old.some(o=>o.id===n.id&&o.version===n.version));if(foundationMode){assert.equal(changed.length,0,'The edited SQL topic is outside the bounded active frontier');assert.equal(f.inference.calls.length,0);}else{assert.ok(changed.length>0&&changed.length<notes(result).length);assert.equal(f.inference.calls[0].nodes,changed.length);}
 }finally{f.role.sourceVersion=version;f.role.role.topics[0].subtopics=[];}
});

test('incomplete optional evidence disables reuse and never publishes reusable fallback revisions',async()=>{
 await create();const original=f.Interview.find;f.Interview.find=()=>{throw new Error('Fixture source failure');};clearCalls();
 try{const result=await replan();assert.equal(f.inference.calls.length,0);assert.ok(notes(result).every(n=>n.version==='incomplete-source'&&!n.ai));assert.ok(result.roadmap.some(m=>m.metadata.roadmapNarrative.lastGood));}
 finally{f.Interview.find=original;}
});

for(const mode of ['unavailable','timeout','jsonerror','invalid','malicious'])test(`${mode}: safe fallback retains completed state, IDs and last good narrative`,async()=>{
 const initial=await create();const stored=f.store.get(owner);stored.roadmap[0].status='completed';stored.roadmap[0].completedAt=new Date('2026-10-01');
 stored.tasks[0].status='completed';stored.tasks[0].completedAt=new Date('2026-10-01');const done=json(stored.tasks[0]);
 f.resumes[0].summary='Changed source requires fresh CV narrative';
 clearCalls();if(mode==='unavailable')f.inference.fail=true;else f.inference.mode=mode;
 const result=await replan();assert.equal(f.inference.calls.length,1);assert.deepEqual(json(result.tasks.find(t=>t.id===done.id)),done);
 assert.equal(result.roadmap[0].status,'completed');assert.equal(new Date(result.roadmap[0].completedAt).toISOString(),'2026-10-01T00:00:00.000Z');
 assert.deepEqual(result.roadmap.map(m=>m.id),initial.roadmap.map(m=>m.id));
 const cv=result.roadmap.find(m=>m.category==='CV');assert.ok(cv.metadata.roadmapNarrative.nodes.every(n=>!n.ai));assert.ok(cv.metadata.roadmapNarrative.lastGood);
 assert.ok(cv.recommendations.every(r=>!r.action.startsWith('Current:')));
 f.inference.fail=false;f.inference.mode=undefined;clearCalls();await replan();assert.equal(f.inference.calls.length,1,'Fallback is never a negative cache hit');
});

test('partial valid output caches valid text and retries only missing nodes',async()=>{
 f.reset();f.inference.mode='partial';const result=await f.service.createCareerAutomation(f.input());assert.equal(generativeNotes(result).filter(n=>!n.ai).length,1);
 f.inference.mode=undefined;clearCalls();await replan();assert.equal(f.inference.calls[0].nodes,1);
});

test('owner isolation: identical inputs never use another account cache or metadata',async()=>{
 await create();clearCalls();const result=await f.service.createCareerAutomation(f.input(f.ownerB));assert.equal(String(result.userId),other);assert.equal(f.inference.calls.length,1);
 assert.notEqual(f.store.get(owner).roadmap[0].metadata.roadmapNarrative.owner,f.store.get(other).roadmap[0].metadata.roadmapNarrative.owner);
 cache.clearRoadmapNarrativeCache();f.store.get(owner).roadmap.forEach(m=>m.metadata.roadmapNarrative.owner='foreign');clearCalls();await replan();assert.equal(f.inference.calls.length,1);
 await assert.rejects(f.goal.buildCareerGoalContext(f.input(),{userId:other,targetRole:'Backend Developer',roadmap:[]}),/owner mismatch/);
});

test('controllers enforce JWT identity; body userId cannot choose another owner',async()=>{
 for(const handler of [f.controller.createAutomation,f.controller.replanAutomation,f.controller.refreshAutomationProgress]){
 f.reset();const response=await f.invoke(handler,{},null);assert.equal(response.statusCode,401);assert.equal(f.counters.queries.length,0);assert.equal(f.inference.calls.length,0);}
 f.reset();const response=await f.invoke(f.controller.createAutomation,{...f.input(),userId:other},f.ownerA);assert.equal(response.statusCode,201);assert.equal(response.body.data.automation.userId,owner);assert.ok(!f.store.has(other));
});

test('existing create/rebuild preserves completed tasks and legacy milestone IDs',async()=>{
 f.reset();const seed=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/phase4ab/seed-before.json')));seed.tasks[0].status='completed';seed.tasks[0].completedAt=new Date('2026-10-01');const done=json(seed.tasks[0]);f.store.set(owner,seed);
 const result=await f.service.createCareerAutomation(f.input());assert.deepEqual(json(result.tasks.find(t=>t.id===done.id)),done);
 for(const old of seed.roadmap){const current=result.roadmap.find(m=>m.category===old.category);assert.equal(current.id,old.id);}
 assert.ok(result.tasks.filter(t=>t.status!=='completed').every(t=>!t.roadmapMilestoneId||result.roadmap.some(m=>m.id===t.roadmapMilestoneId)));
});

test('Career Assistant goal/next steps contracts remain compatible and use stored narrative',async()=>{
 await create();clearCalls();const goal=await f.goal.buildCareerGoalContext(f.input());assert.ok(goal.found);assert.ok(goal.data.resume&&goal.data.interview&&goal.data.jobMatches&&goal.data.progress);assert.equal(f.inference.calls.length,0);
 const metrics=narrative.getRoadmapNarrativeMetrics(goal.data.milestones);assert.ok(metrics.hits>0);assert.equal(metrics.misses,0);
 const response=await next.buildCareerNextStepsContext({...f.input(),contextIntent:'CAREER_AUTOMATION'});assert.ok(response.found);assert.ok(response.data.steps.length>0);assert.equal(f.counters.writes,0);
});

test('historical completed section is retained but excluded from new pending steps',async()=>{
 const initial=await create();const old=json(initial.roadmap[0]);old.id='legacy-completed';old.category='LEGACY';old.status='completed';
 const decorated=narrative.decorateRoadmapNarratives(json(initial.roadmap),[],[old],['legacy-completed']);assert.ok(decorated.some(m=>m.id===old.id&&m.metadata.retainedForCompletedTasks));
 const response=await next.buildCareerNextStepsContext(f.input(),{userId:owner,roadmap:decorated});assert.ok(!response.data.steps.some(s=>s.roadmapMilestoneId==='legacy-completed'));
});

test('cache clones payloads, isolates owners/versions and bounds LRU/expiry',()=>{
 cache.clearRoadmapNarrativeCache();const text={whyItMatters:'Evidence supports this step.',action:'Build a documented example.',proofOfCompletion:'Keep the working result.'};
 cache.putNarrativeText(owner,'node','new',text);cache.putNarrativeText(owner,'node','old',{...text,action:'Older version example.'});text.action='Mutation';
 const value=cache.getNarrativeText(owner,'node','new');assert.equal(value.action,'Build a documented example.');value.action='Changed';assert.notEqual(cache.getNarrativeText(owner,'node','new').action,'Changed');assert.equal(cache.getNarrativeText(other,'node','new'),undefined);
 for(let i=0;i<2100;i++)cache.putNarrativeText(owner,`node-${i}`,'v',text);const stats=cache.getRoadmapNarrativeCacheStats();assert.ok(stats.entries<=stats.maxEntries&&stats.estimatedBytes<=stats.maxBytes);assert.equal(cache.getNarrativeText(owner,'node','new'),undefined);
 const now=Date.now;try{Date.now=()=>now()+16*60000;assert.equal(cache.getNarrativeText(owner,'node-2099','v'),undefined);}finally{Date.now=now;}
});

test('pure scoring and structural planner fingerprints remain byte-for-byte unchanged',()=>{
 const ts=require('../../client/node_modules/typescript'),{createHash}=require('node:crypto');const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/phase4ab/planner-fingerprints.json')));
 for(const name of ['roadmapPlanningService','roadmapAutomationPlanner']){const file=path.join(__dirname,`../src/services/${name}.ts`);const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 for(const node of source.statements.filter(n=>!ts.isImportDeclaration(n))){const label=ts.isVariableStatement(node)?node.declarationList.declarations[0].name.getText(source):node.name?.getText(source);assert.equal(createHash('sha256').update(node.getText(source).replace(/^export /,'').replace(/\r\n/g,'\n')).digest('hex'),expected[name][label]);}}
});

test('skill profile revision invalidates dependent narrative without changing scoring functions',async()=>{
 await create();const find=f.UserSkillProfile.findOne;
 f.UserSkillProfile.findOne=filter=>new f.Query('skills',[{user:f.ownerA,skills:[{name:'SQL',normalizedName:'sql',confidence:.95,level:'advanced',evidenceCount:3,averageScore:90,sources:['project'],evidence:[{source:'project',score:90,recordedAt:new Date()}],lastEvaluatedAt:new Date()}]}],filter,true);
 try{clearCalls();const result=await replan();assert.equal(f.inference.calls.length,1);assert.ok(f.inference.calls[0].nodes>0&&f.inference.calls[0].nodes<notes(result).length);}finally{f.UserSkillProfile.findOne=find;}
});

test('failed persistence preserves the previously saved roadmap and completed data',async()=>{
 await create();const previous=json(f.store.get(owner));const save=f.Automation.prototype.save;f.resumes[0].summary='New summary';
 f.Automation.prototype.save=async()=>{throw new Error('Fixture save failed');};
 try{await assert.rejects(replan(),/save failed/);assert.deepEqual(json(f.store.get(owner)),previous);}finally{f.Automation.prototype.save=save;}
});

test('AI cannot control priority, topics, status, readiness, dates or public IDs',async()=>{
 const normal=json(await create());f.reset();f.inference.mode='malicious';const fallback=json(await f.service.createCareerAutomation(f.input()));
 const structure=result=>({readiness:result.currentReadinessScore,milestones:result.roadmap.map(m=>({id:m.id,category:m.category,title:m.title,status:m.status,start:m.startDay,end:m.endDay,readiness:m.readinessScore,recs:m.recommendations.map(r=>({title:r.title,priority:r.priority,topics:r.whatToLearn,source:r.source,evidence:r.evidence}))}))});
 assert.deepEqual(structure(fallback),structure(normal));assert.ok(fallback.roadmap.every(m=>m.generatedBy==='fallback'));
});

test('changed job evidence invalidates job-search text without a refresh-jobs operation',async()=>{
 const initial=await create();const context=await f.goal.buildCareerGoalContext(f.input());
 const job=f.jobs.find(item=>String(item._id)===context.data.jobMatches.bestMatch.id);assert.ok(job);const previous={title:job.title,updatedAt:job.updatedAt};
 try{job.title='Backend Developer updated evidence';job.updatedAt=new Date();f.matching.clearJobMatchCache();clearCalls();const result=await replan();
 const changed=notes(result).filter(n=>!notes(initial).some(o=>o.id===n.id&&o.version===n.version));const jobNodes=result.roadmap.find(m=>m.category==='JOB_SEARCH').metadata.roadmapNarrative.nodes;
 assert.ok(changed.length>0);assert.ok(changed.every(n=>jobNodes.some(j=>j.id===n.id)));assert.equal(f.inference.calls.length,1);assert.equal(f.counters.external,0);assert.equal(f.counters.writes,1);
 }finally{Object.assign(job,previous);}
});

test('narrative prompt excludes account IDs, filenames and raw CV/interview answers',async()=>{
 await create();assert.equal(f.inference.calls[0].privateSourceIncluded,false);
});

test('disabled automatic replan does not read sources, generate AI or write data',async()=>{
 await create();f.store.get(owner).settings.automaticReplanningEnabled=false;clearCalls();
 await replan();assert.equal(f.inference.calls.length,0);assert.equal(f.counters.writes,0);assert.equal(f.counters.queries.length,1);
});

test('immutable 4A/4B golden structural fields and public nested response shapes remain compatible',async()=>{
 f.reset();const response=await f.invoke(f.controller.createAutomation,f.input());const current=response.body.data.automation,old=golden.create.freshRoadmap.body.data.automation;
 for(const field of ['userId','status','targetRole','careerGoal','roadmapDurationDays','activeResumeId','currentReadinessScore','jobPreferences','settings','createdAt','updatedAt']){if(crossPageMode&&field==='currentReadinessScore')continue;assert.deepEqual(current[field],old[field],field);}
 const expectedGoal=crossPageMode?(await f.goal.buildCareerGoalContext(f.input())).data:undefined;
 if(expectedGoal)assert.equal(current.currentReadinessScore,f.load('services/roadmapPlanningService').calculateReadinessScore(expectedGoal));
 for(const milestone of current.roadmap){const previous=old.roadmap.find(m=>m.category===milestone.category);
 assert.deepEqual(Object.keys(milestone).sort(),Object.keys(previous).filter(key=>!(foundationMode&&key==='readinessScore'&&milestone.readinessScore===undefined)).sort());
 for(const field of ['order','category','readinessScore','status','targetDate','relatedSkills','generatedBy','generatedAt']){
 if(foundationMode&&['CORE_SKILLS','ROLE_SKILLS','PROJECTS'].includes(milestone.category)&&['readinessScore','relatedSkills','generatedBy'].includes(field))continue;
 if(expectedGoal&&milestone.category==='JOB_SEARCH'&&field==='readinessScore'){assert.equal(milestone[field],expectedGoal.jobMatches.bestMatch.match.matchScore);continue;}
 assert.deepEqual(milestone[field],previous[field],`${milestone.category}.${field}`);
 }
 if(foundationMode&&['CORE_SKILLS','ROLE_SKILLS','PROJECTS'].includes(milestone.category)){assert.equal(milestone.readinessScore,undefined);assert.equal(milestone.generatedBy,'fallback');}
 for(const rec of milestone.recommendations)assert.deepEqual(Object.keys(rec).sort(),Object.keys(previous.recommendations[0]).sort());
 }
 const allowed=new Set(old.tasks.flatMap(task=>Object.keys(task)));
 for(const task of current.tasks){assert.ok(Object.keys(task).every(key=>allowed.has(key)));for(const key of ['id','category','priority','title','description','status'])assert.equal(typeof task[key],'string');}
});

test('interview answer and resume revision timestamps invalidate the relevant persisted text',async()=>{
 await create();f.interviews[1].answers[0].answerText='A changed private answer';clearCalls();let result=await replan();assert.equal(f.inference.calls[0].nodes,result.roadmap.find(m=>m.category==='INTERVIEW').metadata.roadmapNarrative.nodes.length);assert.equal(f.inference.calls[0].privateSourceIncluded,false);
 f.resumes[0].updatedAt=new Date();clearCalls();result=await replan();assert.equal(f.inference.calls[0].nodes,result.roadmap.find(m=>m.category==='CV').metadata.roadmapNarrative.nodes.length);
});

test('reactivated historical category returns to active next steps',async()=>{
 const initial=json(await create());const previous=json(initial.roadmap);previous[0].metadata.retainedForCompletedTasks=true;
 const result=narrative.decorateRoadmapNarratives(initial.roadmap,[],previous);assert.equal(result[0].metadata.retainedForCompletedTasks,undefined);
});

test('byte-identical synthetic evidence still cannot share narrative across owners',async()=>{
 f.reset();const context=await f.goal.buildCareerGoalContext(f.input());cache.clearRoadmapNarrativeCache();clearCalls();
 const common={...context.data,sourceComplete:true};
 const a=await narrative.generateRoadmapNarratives({...common,userId:owner,previous:{userId:owner,targetRole:common.targetRole,roadmap:[]}});
 const b=await narrative.generateRoadmapNarratives({...common,userId:other,previous:{userId:other,targetRole:common.targetRole,roadmap:[]}});
 assert.equal(f.inference.calls.length,2);assert.equal(narrative.getRoadmapNarrativeMetrics(a).hits,0);assert.equal(narrative.getRoadmapNarrativeMetrics(b).hits,0);
});

test('persisted narrative metadata conforms to the existing Mongoose model',async()=>{
 const result=await create();await result.validate();
 const roundtrip=f.Automation.hydrate(json(result.toObject()));await roundtrip.validate();assert.deepEqual(notes(roundtrip),notes(result));
});
