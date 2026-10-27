const test=require('node:test'),assert=require('node:assert/strict');
const f=require('./active-career-fixture.cjs');
const career=f.load('services/activeCareerService');
const owner=String(f.ownerA),other=String(f.ownerB),json=value=>JSON.parse(JSON.stringify(value));
const patch=(body,who=f.ownerA)=>f.invoke(f.controller.updateJobPreferences,body,who);

test('Frontend to Mobile selection persists the catalog title and preserves history',async()=>{
 await f.seed();let row=f.store.get(owner);row.targetRole='Frontend Developer';row.jobPreferences.targetRoles=['Frontend Developer'];row.tasks[0].status='completed';
 const before=json(row),result=await patch({targetRole:'mobile-developer',expectedRevision:row.__v});
 assert.equal(result.statusCode,200);const updated=f.store.get(owner);
 assert.equal(updated.targetRole,'Mobile Developer');assert.deepEqual(updated.jobPreferences.targetRoles,['Mobile Developer']);
 for(const key of ['roadmap','tasks','progress','settings','careerGoal','activeResumeId'])assert.deepEqual(json(updated[key]),json(before[key]),key);
 assert.equal(result.body.data.activeCareer.roleKey,'mobile-developer');assert.ok(result.body.data.activeCareer.revision>before.__v);
 assert.equal(f.inference.calls.length,0);
});
test('resolver uses the owned canonical career rather than stale preference roles',async()=>{
 await f.seed();f.store.get(owner).jobPreferences.targetRoles=['Mobile Developer'];
 const result=await career.resolveActiveCareer(owner);assert.equal(result.targetRole,'Backend Developer');assert.equal(result.roleKey,'backend-developer');
 const filter=f.counters.queries.at(-1).filter;assert.equal(String(filter.userId),owner);
});
test('unselected and inactive careers return null without assigning interview history',async()=>{
 f.reset();assert.equal(await career.resolveActiveCareer(owner),null);
 await f.seed();f.store.get(owner).status='archived';assert.equal(await career.resolveActiveCareer(owner),null);
});
test('legacy catalog mismatch is exposed without rewriting the stored career',async()=>{
 await f.seed();f.store.get(owner).targetRole='Legacy Career';const result=await career.resolveActiveCareer(owner);
 assert.equal(result.targetRole,'Legacy Career');assert.equal(result.catalogResolved,false);assert.equal(result.roleKey,null);assert.equal(f.counters.writes,0);
});
test('unknown career selections are rejected instead of inventing catalog entries',async()=>{
 await f.seed();const before=json(f.store.get(owner));const result=await patch({targetRole:'Unlisted career'});
 assert.equal(result.statusCode,400);assert.deepEqual(json(f.store.get(owner)),before);assert.equal(f.counters.writes,0);
});
test('catalog resolver supports dynamically supplied non-mobile career entries',async()=>{
 await f.seed();const seed=require('node:fs').readFileSync(require('node:path').resolve(__dirname,'../src/scripts/seedCareerKnowledgeIT.ts'),'utf8');const supported=[...seed.matchAll(/const \w+\s*=\s*makeRole\(\{\s*title:\s*"([^"]+)"/g)].map(match=>match[1]);assert.equal(supported.length,15);for(const name of supported)if(!f.names.includes(name))f.names.push(name);for(const targetRole of f.names){const result=await patch({targetRole});assert.equal(result.statusCode,200);assert.equal(result.body.data.automation.targetRole,targetRole);}
});
test('stale revision returns 409 and preserves the newer selection',async()=>{
 await f.seed();const revision=f.store.get(owner).__v;await patch({targetRole:'Mobile Developer',expectedRevision:revision});const saved=json(f.store.get(owner));
 const result=await patch({targetRole:'Frontend Developer',expectedRevision:revision});assert.equal(result.statusCode,409);assert.equal(result.body.code,'CAREER_REVISION_CONFLICT');assert.deepEqual(json(f.store.get(owner)),saved);
});
test('legacy documents without __v accept revision zero and remain fenced',async()=>{
 await f.seed();delete f.store.get(owner).__v;const result=await patch({targetRole:'Mobile Developer',expectedRevision:0});assert.equal(result.statusCode,200);assert.equal(f.store.get(owner).__v,1);
});
test('old callers may omit expectedRevision while invalid revision inputs fail',async()=>{
 await f.seed();assert.equal((await patch({targetRole:'Mobile Developer'})).statusCode,200);
 for(const expectedRevision of ['1',-1,1.5,{},Number.MAX_SAFE_INTEGER+1])assert.equal((await patch({targetRole:'Frontend Developer',expectedRevision})).statusCode,400);
});
test('first selection creates a minimal shell without roadmap, tasks, inferred scores or AI',async()=>{
 f.reset();const result=await patch({targetRole:'Mobile Developer',expectedRevision:null});assert.equal(result.statusCode,200);const row=f.store.get(owner);
 assert.deepEqual(row.roadmap,[]);assert.deepEqual(row.tasks,[]);assert.deepEqual(row.jobMatches,[]);assert.equal(row.currentReadinessScore,undefined);assert.equal(row.settings.automationEnabled,false);assert.equal(row.settings.jobSearchEnabled,false);assert.equal(f.inference.calls.length,0);
});
test('two parallel first selections cannot create duplicate owner records',async()=>{
 f.reset();const results=await Promise.all([patch({targetRole:'Mobile Developer',expectedRevision:null}),patch({targetRole:'Frontend Developer',expectedRevision:null})]);
 assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,409]);assert.equal(f.store.size,1);
});
test('two parallel existing selections allow only one fenced save',async()=>{
 await f.seed();const expectedRevision=f.store.get(owner).__v;
 const results=await Promise.all([patch({targetRole:'Mobile Developer',expectedRevision}),patch({targetRole:'Frontend Developer',expectedRevision})]);
 assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,409]);assert.equal(f.counters.writes,1);
});
test('forged body owner cannot select another users career',async()=>{
 await f.seed();const result=await patch({userId:other,targetRole:'Mobile Developer'});assert.equal(result.statusCode,200);assert.equal(f.store.get(owner).targetRole,'Mobile Developer');assert.equal(f.store.has(other),false);
});
test('read and write reject a foreign prepared or returned document',async()=>{
 await f.seed();const doc=await f.service.getCareerAutomation(owner);
 await assert.rejects(career.resolveActiveCareer(other,doc),e=>e.httpStatus===403);
 await assert.rejects(f.service.getCareerAutomationSummary(other,new Date(),doc),/owner mismatch/);
 const find=f.Automation.findOne;f.Automation.findOne=()=>({read(){return this;},readConcern(){return this;},maxTimeMS(){return Promise.resolve(doc);}});
 try{await assert.rejects(career.prepareCareerSelection(other,'Mobile Developer',undefined),e=>e.httpStatus===403);}finally{f.Automation.findOne=find;}
});
test('inactive records are preserved, never replaced by a new shell',async()=>{
 await f.seed();f.store.get(owner).status='archived';const before=json(f.store.get(owner));assert.equal((await patch({targetRole:'Mobile Developer'})).statusCode,409);assert.deepEqual(json(f.store.get(owner)),before);
});
test('read endpoint is additive, owned and contains no generation recovery state',async()=>{
 await f.seed();const result=await f.invoke(f.controller.getActiveCareer,{},f.ownerA);assert.equal(result.statusCode,200);assert.equal(result.body.data.activeCareer.targetRole,'Backend Developer');assert.equal(f.counters.writes,0);assert.equal(f.inference.calls.length,0);
 assert.equal((await f.invoke(f.controller.getActiveCareer,{},null)).statusCode,401);
});
test('preferences without role still preserve the response shape and use one automation read',async()=>{
 await f.seed();const result=await patch({locations:['Baku'],workModes:['remote']});assert.equal(result.statusCode,200);
 assert.deepEqual(Object.keys(result.body.data).sort(),['automation','summary']);assert.equal(f.counters.queries.filter(q=>q.model==='automations').length,1);assert.equal(f.state.fieldReads,0);
});
test('career selection during generation preserves the new role and rejects the old commit',async()=>{
 await f.seed();f.resumes[0].summary='Changed fixture evidence for generation';f.change(owner,'roadmapEvidenceRevision');
 f.data.onInference=async()=>{const result=await patch({targetRole:'Mobile Developer',expectedRevision:f.store.get(owner).__v});assert.equal(result.statusCode,200);};
 try{await assert.rejects(f.service.replanCareerAutomation({userId:owner,preserveCompletedTasks:true}),e=>e.code==='GENERATION_COMMIT_CONFLICT');assert.equal(f.store.get(owner).targetRole,'Mobile Developer');}
 finally{f.resumes[0].summary='Fixture resume';f.data.onInference=undefined;}
});
test('different owners can select careers concurrently without sharing state',async()=>{
 await f.seed();const results=await Promise.all([patch({targetRole:'Mobile Developer',expectedRevision:f.store.get(owner).__v}),patch({targetRole:'Data Analyst',expectedRevision:null},f.ownerB)]);
 assert.deepEqual(results.map(r=>r.statusCode),[200,200]);assert.equal(f.store.get(owner).targetRole,'Mobile Developer');assert.equal(f.store.get(other).targetRole,'Data Analyst');
});
test('persistence errors do not expose raw private error details',async()=>{
 await f.seed();const save=f.Automation.prototype.save;f.Automation.prototype.save=async()=>{throw new Error('fixture-private-secret');};
 try{const result=await patch({targetRole:'Mobile Developer'});assert.equal(result.statusCode,500);assert.equal(JSON.stringify(result.body).includes('fixture-private-secret'),false);}finally{f.Automation.prototype.save=save;}
});
