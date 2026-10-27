const test=require('node:test'),assert=require('node:assert/strict');
const f=require('./phase4d-generation-fixture.cjs');
const owner=String(f.ownerA),other=String(f.ownerB),json=value=>JSON.parse(JSON.stringify(value));
const create=()=>f.service.createCareerAutomation(f.input());
const replan=()=>f.service.replanCareerAutomation({userId:owner,preserveCompletedTasks:true});
async function seed(){f.reset();await create();f.inference.calls.length=0;f.resetCounters();f.data.coordQueries=0;}

test('two parallel cold creates share one inference and one atomic commit',async()=>{
 f.reset();f.data.delayInference=30;const [a,b]=await Promise.all([create(),create()]);
 assert.equal(f.inference.calls.length,1);assert.equal(f.data.transactions,1);assert.equal(String(a._id),String(b._id));assert.notEqual(a,b);
 assert.equal(f.accounts.get(owner).roadmapGeneration.status,'completed');assert.equal(f.store.size,1);
});
test('identical create and repeated replan are durable idempotent operations',async()=>{
 await seed();const previous=json(f.store.get(owner));await create();assert.equal(f.inference.calls.length,0);assert.equal(f.counters.writes,0);assert.deepEqual(json(f.store.get(owner)),previous);
 await replan();const writes=f.counters.writes;await replan();assert.equal(f.counters.writes,writes);assert.equal(f.inference.calls.length,0);
});
test('two parallel replans after evidence change issue only one inference',async()=>{
 await seed();f.change(owner,'roadmapEvidenceRevision');f.resumes[0].summary='Changed CV evidence';f.data.delayInference=30;
 try{const [a,b]=await Promise.all([replan(),replan()]);assert.equal(f.inference.calls.length,1);assert.equal(f.counters.writes,1);assert.equal(String(a._id),String(b._id));}
 finally{f.resumes[0].summary='Fixture resume';}
});
test('different users generate independently and never share ownership',async()=>{
 f.reset();const [a,b]=await Promise.all([create(),f.service.createCareerAutomation(f.input(f.ownerB))]);assert.equal(f.inference.calls.length,2);assert.equal(String(a.userId),owner);assert.equal(String(b.userId),other);assert.equal(f.store.size,2);
});
for(const kind of ['CV','interview','skill','target-role','completed-task'])test(`concurrent ${kind} change rejects the old generation commit`,async()=>{
 await seed();f.change(owner,'roadmapEvidenceRevision');f.resumes[0].summary='New evidence before generation';let changed;
 f.data.onInference=async()=>{
  if(['CV','interview','skill'].includes(kind))f.change(owner,'roadmapEvidenceRevision');
  else{f.change(owner,'roadmapAutomationRevision');if(kind==='target-role')f.store.get(owner).targetRole='Frontend Developer';else f.store.get(owner).tasks[0].status='completed';}
  changed=json(f.store.get(owner));
 };
 try{await assert.rejects(replan(),error=>error.code==='GENERATION_COMMIT_CONFLICT');assert.deepEqual(json(f.store.get(owner)),changed);assert.equal(f.accounts.get(owner).roadmapGeneration.status,'failed');}
 finally{f.resumes[0].summary='Fixture resume';}
});
for(const mode of ['timeout','invalid','jsonerror','unavailable'])test(`${mode}: existing fallback semantics and completion links survive`,async()=>{
 await seed();f.change(owner,'roadmapEvidenceRevision');f.resumes[0].summary='Changed CV evidence';if(mode==='unavailable')f.inference.fail=true;else f.inference.mode=mode;
 const stored=f.store.get(owner);stored.tasks[0].status='completed';stored.tasks[0].completedAt=new Date();f.change(owner,'roadmapAutomationRevision');const done=json(stored.tasks[0]);
 try{const result=await replan();assert.deepEqual(json(result.tasks.find(t=>t.id===done.id)),done);const status=await f.coordination.getRoadmapGenerationStatus(owner);assert.equal(status.status,'completed');assert.equal(status.degraded,true);assert.ok(!JSON.stringify(status).includes('token'));}
 finally{f.resumes[0].summary='Fixture resume';}
});
test('database write failure rolls back roadmap and job completion together',async()=>{
 await seed();const old=json(f.store.get(owner));f.data.failCommit=true;
 await assert.rejects(replan(),error=>error.code==='GENERATION_FAILED');assert.deepEqual(json(f.store.get(owner)),old);assert.equal(f.accounts.get(owner).roadmapGeneration.status,'failed');
});
test('transaction conflict cannot publish a staged roadmap or completed status',async()=>{
 await seed();const old=json(f.store.get(owner));f.data.beforeCommit=async()=>f.change(owner,'roadmapAutomationRevision');
 await assert.rejects(replan(),error=>error.code==='GENERATION_COMMIT_CONFLICT');assert.deepEqual(json(f.store.get(owner)),old);assert.equal(f.accounts.get(owner).roadmapGeneration.status,'failed');
});
test('restart recovery marks stale leases failed, fences old workers, and enforces cooldown',async()=>{
 await seed();const row=f.accounts.get(owner),job=row.roadmapGeneration;job.status='running';job.leaseUntil=new Date(Date.now()-1000);job.deadline=new Date(Date.now()+10000);f.change(owner,'roadmapAutomationRevision');
 await f.coordination.recoverStaleRoadmapGenerations();assert.equal(row.roadmapGeneration.status,'failed');const status=await f.coordination.getRoadmapGenerationStatus(owner);assert.equal(status.errorCode,'GENERATION_LEASE_EXPIRED');await assert.rejects(replan(),error=>error.code==='GENERATION_RECOVERY_COOLDOWN');assert.equal(f.inference.calls.length,0);
 job.deadline=new Date(Date.now()-1);await replan();assert.notEqual(f.accounts.get(owner).roadmapGeneration.token,job.token);
 assert.equal(await f.coordination.roadmapGenerationStore.heartbeat(owner,job),false);
});
test('status is owner-scoped and does not expose revisions, hash, lease or evidence',async()=>{
 await seed();const status=await f.coordination.getRoadmapGenerationStatus(owner);assert.equal(status.status,'completed');assert.deepEqual(await f.coordination.getRoadmapGenerationStatus(other),{status:'idle'});
 for(const key of ['token','inputHash','evidenceRevision','automationRevision','leaseUntil'])assert.equal(status[key],undefined);
 const response=await f.invoke(f.controller.getGenerationStatus,{},null);assert.equal(response.statusCode,401);
});
test('progress refresh reuses cached narratives and then replays without another save',async()=>{
 await seed();await f.service.refreshCareerAutomationProgress(owner);const writes=f.counters.writes;await f.service.refreshCareerAutomationProgress(owner);assert.equal(f.inference.calls.length,0);assert.equal(f.counters.writes,writes);
});

test('independent server instance joins the durable running job without invoking its worker',async()=>{
 await seed();f.change(owner,'roadmapEvidenceRevision');f.resumes[0].summary='Instance coordination CV';f.data.delayInference=80;
 let start;const started=new Promise(resolve=>start=resolve);f.data.onInference=async()=>start();
 const leader=replan();await started;
 const second=f.coordination.createRoadmapGenerationCoordinator();let duplicate=0;
 try{const follower=second(owner,'replan',{userId:owner,preserveCompletedTasks:true},async()=>{duplicate++;throw new Error('Unexpected duplicate worker');});const [a,b]=await Promise.all([leader,follower]);assert.equal(duplicate,0);assert.equal(f.inference.calls.length,1);assert.equal(String(a._id),String(b._id));}
 finally{f.resumes[0].summary='Fixture resume';}
});

test('fresh process instance replays the completed job from database state',async()=>{
 await seed();const fresh=f.coordination.createRoadmapGenerationCoordinator();const result=await fresh(owner,'create',f.input(),async()=>{throw new Error('Unexpected replay work');});assert.equal(String(result.userId),owner);assert.equal(f.inference.calls.length,0);assert.equal(f.counters.writes,0);
});

test('source write and revision fence commit atomically, or both roll back',async()=>{
 await seed();const {installRoadmapWriteGuard}=f.load('services/roadmapWriteGuard');
 class Query{async exec(){return {};}}
 class Model{constructor(user){this.user=user;}get(key){return this[key];}$session(){return null;}async save(options){assert.ok(options.session.inTransaction());return this;}async $save(options){return this.save(options);}}
 Model.Query=Query;Model.insertMany=async rows=>rows;Model.bulkWrite=async()=>({});installRoadmapWriteGuard(Model,'user','roadmapEvidenceRevision');
 const previous=f.accounts.get(owner).roadmapEvidenceRevision;await new Model(owner).save();assert.equal(f.accounts.get(owner).roadmapEvidenceRevision,previous+1);
 f.data.failCommit=true;await assert.rejects(new Model(owner).save(),/database write failed/);assert.equal(f.accounts.get(owner).roadmapEvidenceRevision,previous+1);
});

test('coordination fields remain hidden in normal User projections and no new schema indexes exist',()=>{
 for(const field of ['roadmapGeneration','roadmapEvidenceRevision','roadmapAutomationRevision'])assert.equal(f.User.schema.path(field).options.select,false);
 assert.ok(!f.User.schema.indexes().some(([fields])=>Object.keys(fields).some(field=>field.startsWith('roadmap'))));
});

test('absolute operation timeout fences a late worker from writing its draft',async()=>{
 await seed();const original=setTimeout;const deadlines=[];
 global.setTimeout=(fn,ms,...args)=>{if(ms>300000){deadlines.push(()=>fn(...args));return original(()=>{},ms);}return original(fn,ms,...args);};
 const runner=f.coordination.createRoadmapGenerationCoordinator();
 try{
  await assert.rejects(runner(owner,'replan',{userId:owner,reason:'deadline fixture'},async()=>{
   // Expire only after the worker starts, not while preflight is still reading.
   await new Promise(resolve=>original(resolve,0));for(const expire of deadlines)expire();
   await new Promise(resolve=>original(resolve,20));const document=await f.service.getCareerAutomation(owner);
   await f.coordination.saveGeneratedAutomation(document);return document;
  }),error=>error.code==='GENERATION_DEADLINE_EXCEEDED');
  await new Promise(resolve=>original(resolve,50));assert.equal(f.counters.writes,0);assert.equal(f.accounts.get(owner).roadmapGeneration.status,'failed');
 }finally{global.setTimeout=original;}
});

test('heartbeat rejection prevents commit even when inference returns valid text',async()=>{
 await seed();f.change(owner,'roadmapEvidenceRevision');f.resumes[0].summary='Heartbeat changed evidence';f.data.delayInference=50;f.data.failHeartbeat=true;
 const original=setInterval;global.setInterval=(fn,ms,...args)=>original(fn,ms===15000?2:ms,...args);
 const old=json(f.store.get(owner));
 try{await assert.rejects(replan(),error=>error.code==='GENERATION_LEASE_LOST');assert.deepEqual(json(f.store.get(owner)),old);}
 finally{global.setInterval=original;f.resumes[0].summary='Fixture resume';}
});

test('normal completion is replayed, but a degraded fallback can be retried to recover missing narrative',async()=>{
 await seed();f.change(owner,'roadmapEvidenceRevision');f.resumes[0].summary='Changed evidence for recovery';f.inference.fail=true;
 try{await replan();f.inference.calls.length=0;f.inference.fail=false;const result=await replan();assert.equal(f.inference.calls.length,1);assert.equal(f.accounts.get(owner).roadmapGeneration.degraded,false);assert.ok(result.roadmap.length);}
 finally{f.resumes[0].summary='Fixture resume';}
});

test('different input while another operation runs is rejected without extra inference',async()=>{
 await seed();f.change(owner,'roadmapEvidenceRevision');f.resumes[0].summary='Concurrent operation source';f.data.delayInference=50;let notify;const started=new Promise(resolve=>notify=resolve);f.data.onInference=async()=>notify();
 const leader=replan();await started;
 try{await assert.rejects(f.service.refreshCareerAutomationProgress(owner),error=>error.code==='GENERATION_ALREADY_RUNNING');await leader;assert.equal(f.inference.calls.length,1);}
 finally{f.resumes[0].summary='Fixture resume';}
});

test('global CareerKnowledge version change invalidates a durable completed replay',async()=>{
 await seed();await replan();f.inference.calls.length=0;const previous=f.role.sourceVersion;
 try{f.role.sourceVersion='fixture-v2';await replan();assert.equal(f.inference.calls.length,1);}
 finally{f.role.sourceVersion=previous;}
});

test('ordinary automation saves carry a document version predicate and increment version',async()=>{
 await seed();const {installRoadmapWriteGuard}=f.load('services/roadmapWriteGuard');
 class Query{async exec(){return {};}}
 let storedVersion=0;
 class Model{
  constructor(){this.userId=owner;this.__v=0;this.isNew=false;}get(key){return this[key];}$session(){return null;}increment(){this.incremented=true;}
  async save(){assert.equal(String(this.$where.userId),owner);assert.equal(this.$where.__v,this.__v);assert.equal(this.incremented,true);if(this.__v!==storedVersion)throw Object.assign(new Error('Old task draft'),{name:'VersionError'});storedVersion++;return this;}
 }
 Model.prototype.$save=Model.prototype.save;Model.Query=Query;Model.insertMany=async rows=>rows;Model.bulkWrite=async()=>({});installRoadmapWriteGuard(Model,'userId','roadmapAutomationRevision');
 const a=new Model(),b=new Model();await a.save();await assert.rejects(b.save(),{name:'VersionError'});assert.equal(storedVersion,1);
});

test('per-operation durable receipt survives an intervening progress refresh',async()=>{
 await seed();await replan();await f.service.refreshCareerAutomationProgress(owner);f.resetCounters();f.inference.calls.length=0;
 await replan();assert.equal(f.counters.writes,0);assert.equal(f.inference.calls.length,0);assert.ok(f.accounts.get(owner).roadmapGeneration.receipts.replan);
});

test('explicit create after target-role edit is not mistaken for an old idempotent replay',async()=>{
 await seed();f.store.get(owner).targetRole='Frontend Developer';f.change(owner,'roadmapAutomationRevision');
 const result=await create();assert.equal(result.targetRole,'Backend Developer');assert.equal(f.counters.writes,1);
});

test('all application-owned evidence models install the shared revision guard',()=>{
 for(const model of [f.ResumeAnalysis,f.Interview,f.UserSkillProfile,f.Automation])assert.equal(model[Symbol.for('interviewiq.roadmapWriteGuard')],true);
});

test('preflight database failure returns a safe service-unavailable response without inference',async()=>{
 f.reset();const find=f.User.findById;f.User.findById=()=>{throw new Error('fixture-private-database-detail');};
 try{const response=await f.invoke(f.controller.createAutomation,f.input());assert.equal(response.statusCode,503);assert.ok(!JSON.stringify(response.body).includes('fixture-private'));assert.equal(f.inference.calls.length,0);assert.equal(f.store.size,0);}
 finally{f.User.findById=find;}
});

test('status endpoint ignores a forged body userId and returns the authenticated account state',async()=>{
 await seed();const response=await f.invoke(f.controller.getGenerationStatus,{userId:owner},f.ownerB);assert.equal(response.statusCode,200);assert.deepEqual(response.body.data,{status:'idle'});
});

test('full coordinated controllers retain successful response contracts and public milestone IDs',async()=>{
 f.reset();const golden=require('./fixtures/phase4ab/golden-before.json');
 const created=await f.invoke(f.controller.createAutomation,f.input());assert.equal(created.statusCode,201);assert.equal(created.body.success,true);assert.deepEqual(Object.keys(created.body.data).sort(),['automation','summary']);
 const old=golden.create.freshRoadmap.body.data.automation;
 const crossPageMode=require('node:fs').existsSync(require('node:path').join(f.root,'services/careerIntelligenceService.js'));
 for(const field of ['userId','targetRole','careerGoal','roadmapDurationDays','currentReadinessScore','settings','jobPreferences','createdAt']){if(crossPageMode&&field==='currentReadinessScore')continue;assert.deepEqual(created.body.data.automation[field],old[field]);}
 if(crossPageMode){const context=await f.goal.buildCareerGoalContext(f.input());assert.equal(created.body.data.automation.currentReadinessScore,f.load('services/roadmapPlanningService').calculateReadinessScore(context.data));}
 const ids=created.body.data.automation.roadmap.map(item=>item.id);
 for(const handler of [f.controller.replanAutomation,f.controller.refreshAutomationProgress]){
  const response=await f.invoke(handler);assert.equal(response.statusCode,200);assert.equal(response.body.success,true);assert.deepEqual(response.body.data.automation.roadmap.map(item=>item.id),ids);assert.ok(response.body.data.automation.tasks.length>0);assert.ok(response.body.data.summary);
  assert.equal(response.body.data.automation.roadmapGeneration,undefined);
 }
});

test('recovery cannot overwrite a lease renewed after its stale read',async()=>{
 await seed();const row=f.accounts.get(owner);row.roadmapGeneration.status='running';row.roadmapGeneration.leaseUntil=new Date(Date.now()-1);
 const expire=f.coordination.roadmapGenerationStore.expire;
 f.coordination.roadmapGenerationStore.expire=async(owner,job)=>{row.roadmapGeneration.leaseUntil=new Date(Date.now()+60000);return expire(owner,job);};
 try{await f.coordination.getRoadmapGenerationStatus(owner);assert.equal(row.roadmapGeneration.status,'running');}
 finally{f.coordination.roadmapGenerationStore.expire=expire;}
});

test('simultaneous independent instances acquire exactly one durable first-create claim',async()=>{
 f.reset();const first=f.coordination.createRoadmapGenerationCoordinator(),second=f.coordination.createRoadmapGenerationCoordinator();let workers=0;
 const work=async()=>{workers++;await new Promise(resolve=>setTimeout(resolve,20));return f.coordination.saveGeneratedAutomation(new f.Automation(f.input()));};
 const [a,b]=await Promise.all([first(owner,'create',f.input(),work),second(owner,'create',f.input(),work)]);
 assert.equal(workers,1);assert.equal(f.data.transactions,1);assert.equal(String(a._id),String(b._id));
});

test('failed error-status persistence is recovered from the lease after the database returns',async()=>{
 await seed();const old=json(f.store.get(owner));const update=f.User.updateOne;f.data.failCommit=true;
 f.User.updateOne=async(filter,change,options)=>{if(change.$set?.['roadmapGeneration.status']==='failed')throw new Error('Fixture unavailable error status write');return update(filter,change,options);};
 try{await assert.rejects(replan(),error=>error.code==='GENERATION_FAILED');assert.equal(f.accounts.get(owner).roadmapGeneration.status,'running');assert.deepEqual(json(f.store.get(owner)),old);}
 finally{f.User.updateOne=update;f.data.failCommit=false;}
 f.accounts.get(owner).roadmapGeneration.leaseUntil=new Date(Date.now()-1);
 assert.equal((await f.coordination.getRoadmapGenerationStatus(owner)).status,'failed');
});

test('a request timed out during preflight cannot start inference after the read finally returns',async()=>{
 f.reset();const read=f.coordination.roadmapGenerationStore.read,timeout=setTimeout;
 f.coordination.roadmapGenerationStore.read=async(...args)=>{await new Promise(resolve=>timeout(resolve,40));return read(...args);};
 global.setTimeout=(fn,ms,...args)=>timeout(fn,ms>300000?10:ms,...args);
 try{await assert.rejects(create(),error=>error.code==='GENERATION_DEADLINE_EXCEEDED');await new Promise(resolve=>timeout(resolve,60));assert.equal(f.inference.calls.length,0);assert.equal(f.store.size,0);assert.equal(f.accounts.get(owner).roadmapGeneration,undefined);}
 finally{f.coordination.roadmapGenerationStore.read=read;global.setTimeout=timeout;}
});

test('claims and status writes require majority acknowledgement; commit uses transaction concern',async()=>{
 f.reset();const update=f.User.updateOne;const options=[];
 f.User.updateOne=async(filter,change,settings)=>{options.push(settings);return update(filter,change,settings);};
 try{await create();assert.ok(options.filter(option=>!option.session).length>=2);for(const option of options.filter(option=>!option.session)){assert.equal(option.writeConcern.w,'majority');assert.equal(option.writeConcern.wtimeoutMS,10000);}for(const option of options.filter(option=>option.session))assert.equal(option.writeConcern,undefined);}
 finally{f.User.updateOne=update;}
});

test('an old receipt cannot replay another role roadmap after configuration changes back',async()=>{
 await seed();await replan();const original=f.clone(f.store.get(owner));
 await f.service.createCareerAutomation({...f.input(),targetRole:'Frontend Developer'});
 const row=f.store.get(owner);
 for(const key of ['targetRole','careerGoal','targetDate','roadmapDurationDays','activeResumeId','activeInterviewId','settings','jobPreferences','status'])row[key]=original[key];
 f.change(owner,'roadmapAutomationRevision');f.resetCounters();
 const result=await replan();assert.equal(f.counters.writes,1);
 assert.equal(result.roadmap[0].metadata.roadmapNarrative.nodes[0].id,original.roadmap[0].metadata.roadmapNarrative.nodes[0].id);
});

test('committed-evidence read concern is scoped to generation and does not override transaction snapshots',async()=>{
 const {installRoadmapReadGuard,withGenerationReads}=f.load('services/roadmapWriteGuard');
 class Query{
  constructor(session){this.op='findOne';this.options={session};}getOptions(){return this.options;}read(value){this.options.readPreference=value;return this;}readConcern(value){this.options.readConcern=value;return this;}async exec(){return this.options.readConcern;}
 }
 const Model={Query,aggregate(){return {options:{},read(value){this.options.readPreference=value;return this;},readConcern(value){this.options.readConcern=value;return this;},async exec(){return this.options.readConcern;}};}};
 installRoadmapReadGuard(Model);
 assert.equal(await new Query().exec(),undefined);
 const committed=new Query();assert.equal(await withGenerationReads(owner,()=>committed.exec()),'majority');assert.equal(committed.options.readPreference,'primary');
 assert.equal(await withGenerationReads(owner,()=>new Query({inTransaction:()=>true}).exec()),undefined);
 assert.equal(await withGenerationReads(owner,()=>Model.aggregate().exec()),'majority');
 assert.equal(await Model.aggregate().exec(),undefined);
});

test('expired evidence reads cannot dispatch Qwen when the worker resumes later',{timeout:5000},async()=>{
 f.reset();const exec=f.Query.prototype.exec,active=f.coordination.assertGenerationActive,timeout=setTimeout;const deadlines=[];let expired=false,notify;
 const checked=new Promise(resolve=>notify=resolve);
 global.setTimeout=(fn,ms,...args)=>{if(ms>300000){deadlines.push(()=>fn(...args));return timeout(()=>{},ms);}return timeout(fn,ms,...args);};
 f.Query.prototype.exec=async function(...args){
  if(this.model==='resumes'&&!expired){expired=true;await new Promise(resolve=>timeout(resolve,0));for(const expire of deadlines)expire();await new Promise(resolve=>timeout(resolve,20));}
  return exec.apply(this,args);
 };
 f.coordination.assertGenerationActive=(...args)=>{try{return active(...args);}finally{notify();}};
 try{await assert.rejects(create(),error=>error.code==='GENERATION_DEADLINE_EXCEEDED');await checked;assert.equal(f.inference.calls.length,0);assert.equal(f.store.size,0);}
 finally{f.Query.prototype.exec=exec;f.coordination.assertGenerationActive=active;global.setTimeout=timeout;}
});
