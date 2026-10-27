const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const f = require('./phase4-roadmap-fixture.cjs');
const originalLog = console.log, originalWarn = console.warn;
console.log = console.warn = () => {};
const mode = process.env.PHASE4_BASELINE === '1' ? 'before' : 'after';
const directory = path.resolve(__dirname,'../node_modules/.cache/phase4ab');
const json = value => JSON.parse(JSON.stringify(value));
const percent = (values,p) => [...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];
fs.mkdirSync(directory,{recursive:true});
const fixtures = path.resolve(__dirname,'fixtures/phase4ab');
const seedFile = path.join(mode === 'before' ? directory : fixtures,'seed-before.json');
async function scenario(name) {
  f.reset();
  if (name !== 'create') {
    if (mode === 'before' && !fs.existsSync(seedFile)) {
      await f.service.createCareerAutomation(f.input());
      fs.writeFileSync(seedFile, JSON.stringify(f.store.get(String(f.ownerA))));
    }
    f.store.set(String(f.ownerA), JSON.parse(fs.readFileSync(seedFile)));
    const previous = f.store.get(String(f.ownerA));
    previous.roadmap[0].status='completed'; previous.roadmap[0].completedAt=new Date('2026-10-01');
    previous.tasks[0].status='completed'; previous.tasks[0].completedAt=new Date('2026-10-01');
  }
  f.matching.clearJobMatchCache?.();
  f.resetCounters(); f.inference.calls.length=0;
  const start = performance.now();
  const result = name.startsWith('create') ? await f.invoke(f.controller.createAutomation,f.input()) : name === 'replan' ? await f.invoke(f.controller.replanAutomation,{preserveCompletedTasks:true}) : await f.invoke(f.controller.refreshAutomationProgress);
  assert.equal(result.statusCode,name.startsWith('create') ? 201 : 200, JSON.stringify(result.body));
  const measured = { response: result, elapsedMs:performance.now()-start, queries:f.counters.queries.length, writes:f.counters.writes, sources:f.counters.queries.map(q=>q.model), qwen:json(f.inference.calls) };
  return measured;
}
async function expectedFreshResponse(name, measured) {
  if(name === 'progress-refresh') return measured.response;
  const Module = require('node:module');
  const file = path.join(f.root,'services/careerAutomationService.js');
  const copy = new Module(file, module); copy.filename=file; copy.paths=Module._nodeModulePaths(path.dirname(file));
  copy._compile(fs.readFileSync(file,'utf8') + '\nexports.fixturePlanner={buildTasksFromNextSteps,refreshStoredProgress};',file);
  const stored = f.store.get(String(f.ownerA));
  const next = await f.load('services/careerNextStepsService').buildCareerNextStepsContext({ ...f.input(), contextIntent:'CAREER_AUTOMATION', userMessage:name.startsWith('create') ? 'Build a personalized career roadmap and practical action plan.' : 'Re-evaluate my current progress and update my career action plan.' });
  const tasks = copy.exports.fixturePlanner.buildTasksFromNextSteps({ steps:next.data.steps, roadmap:stored.roadmap, settings:stored.settings, startedAt:new Date() });
  const completed = name === 'replan' ? stored.tasks.filter(task=>task.status==='completed') : [];
  stored.tasks=[...completed,...tasks.filter(task=>!completed.some(done=>done.id===task.id))];
  copy.exports.fixturePlanner.refreshStoredProgress(stored);
  const output = json(measured.response);
  output.body.data.automation=json(await f.service.getCareerAutomation(String(f.ownerA)));
  output.body.data.summary=json(await f.service.getCareerAutomationSummary(String(f.ownerA)));
  return output;
}
async function main(){
  const samples=Number(process.env.PHASE4_SAMPLES||20), output={fixture:true,mode,samples,queryDelayMs:2,qwenStubDelayMs:5,scenarios:{}}, golden={};
  for (const name of ['create','replan','progress-refresh']) {
    const values=[]; let last;
    for(let i=0;i<samples;i++){last=await scenario(name);values.push(last.elapsedMs);}
    golden[name]=mode === 'before' ? { legacy:last.response, freshRoadmap:await expectedFreshResponse(name,last) } : json(last.response);
    output.scenarios[name]={p50Ms:percent(values,.5),p95Ms:percent(values,.95),queries:last.queries,writes:last.writes,sourceQueries:last.sources,qwen:last.qwen,responseBytes:Buffer.byteLength(JSON.stringify(last.response.body))};
  }
  const file=path.join(directory,'golden-before.json');
  if(mode==='before') fs.writeFileSync(file,JSON.stringify(golden,null,2));
  else { const expected=JSON.parse(fs.readFileSync(path.join(fixtures,'golden-before.json'))); for(const name of Object.keys(golden)) assert.deepEqual(golden[name],expected[name].freshRoadmap, `${name}: response contract differs from legacy planner with fresh roadmap`); }
  fs.writeFileSync(path.join(directory,`benchmark-${mode}.json`),JSON.stringify(output,null,2));
  console.log=originalLog;console.warn=originalWarn;console.log(JSON.stringify(output));
}
module.exports={scenario,expectedFreshResponse};
if(require.main === module) main().catch(e=>{console.log=originalLog;console.warn=originalWarn;console.error(e);process.exitCode=1;});
