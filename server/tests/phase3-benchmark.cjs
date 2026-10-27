// Controlled fixture benchmark. These measurements are not production latency.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
const fixture = require("./phase3-fixture.cjs");
const { request, counters, resetCounters, jobsController, dashboard, progress, matching } = fixture;
const originalLog = console.log, originalWarn = console.warn;
console.log = () => {}; console.warn = () => {};
const mode = process.env.PHASE3_BASELINE === "1" ? "before" : "after";
const directory = path.resolve(__dirname, "../node_modules/.cache/phase3");
const percentile = (values, percent) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * percent) - 1];
(async () => {
  const samples = Number(process.env.PHASE3_SAMPLES || 20);
  const output = { mode, fixture: true, jobs: fixture.jobs.length, simulatedQueryDelayMs: 2, samples, scenarios: {} };
  for (const [name, handler, query] of [["jobs-default", jobsController.getJobs, { page: "1", limit: "18" }], ["jobs-match-filter", jobsController.getJobs, { page: "1", limit: "18", matchLevel: "good" }], ["dashboard", dashboard.getDashboardStatsController, {}], ["progress", progress.getProgressController, {}]]) {
    const elapsed = [], queries = [], documents = [], matchingMs = [], databaseBytes = [];
    const cpuStart = process.cpuUsage(), memoryStart = process.memoryUsage().heapUsed;
    let body;
    for (let index = 0; index < samples; index++) {
      resetCounters();
      const start = performance.now();
      const result = await request(handler, query);
      elapsed.push(performance.now() - start);
      assert.equal(result.statusCode, 200);
      queries.push(counters.queries.length);
      documents.push(counters.queries.filter(query => query.model === "jobs").reduce((sum, query) => sum + query.returned, 0));
      matchingMs.push(counters.matchingMs);
      databaseBytes.push(counters.queries.reduce((n,q) => n + (q.bytes || 0), 0));
      body = result.body;
    }
    const serializeStart = performance.now();
    const json = JSON.stringify(body);
    const cpu = process.cpuUsage(cpuStart);
    output.scenarios[name] = { p50Ms: percentile(elapsed, 0.5), p95Ms: percentile(elapsed, 0.95), minMs: Math.min(...elapsed), maxMs: Math.max(...elapsed), queriesPerRequest: queries[0], fixtureDatabaseBytes: databaseBytes[0], jobsMaterializedPerRequest: documents[0], meanMatchingMs: matchingMs.reduce((a, b) => a + b, 0) / samples, responseBytes: Buffer.byteLength(json), serializationMs: performance.now() - serializeStart, cpuUserMs: cpu.user / 1000, cpuSystemMs: cpu.system / 1000, heapDeltaBytes: process.memoryUsage().heapUsed - memoryStart };
  }
  resetCounters();
  const concurrencyStart = performance.now();
  await Promise.all(Array.from({ length: 8 }, () => request(jobsController.getJobs, { page: "1", limit: "18" })));
  output.concurrentEightJobs = { elapsedMs: performance.now() - concurrencyStart, queries: counters.queries.length, jobsMaterialized: counters.queries.filter(query => query.model === "jobs").reduce((sum, query) => sum + query.returned, 0) };
  if (matching.getJobMatchCacheStats) output.matchCache = matching.getJobMatchCacheStats();
  const golden = {};
  for (const query of [{ page: "1", limit: "18" }, { page: "2", limit: "7" }, { page: "9999", limit: "3" }, { search: "[Backend]" }, { search: "developer", remoteType: "remote", employmentType: "full-time,contract" }, { market: "azerbaijan", minimumSalary: "2000" }, { matchLevel: "good" }, { matchLevel: "low", experienceLevel: "junior" }]) {
    golden[JSON.stringify(query)] = JSON.parse(JSON.stringify((await request(jobsController.getJobs, query)).body));
  }
  golden.dashboard = JSON.parse(JSON.stringify((await request(dashboard.getDashboardStatsController)).body));
  golden.progress = JSON.parse(JSON.stringify((await request(progress.getProgressController)).body));
  golden.jobDetails = JSON.parse(JSON.stringify((await request(jobsController.getJobById, {}, fixture.ownerA, { jobId: String(fixture.jobs[0]._id) })).body));
  golden.jobMatch = JSON.parse(JSON.stringify((await request(jobsController.getJobMatch, {}, fixture.ownerA, { jobId: String(fixture.jobs[0]._id) })).body));
  const goldenFile = path.join(directory, "response-before.json");
  if (mode === "before") fs.writeFileSync(goldenFile, JSON.stringify(golden));
  else {
    // Match detail responses intentionally contain a newly generated timestamp.
    const stable = value => JSON.parse(JSON.stringify(value, (key, item) => key === 'generatedAt' ? '<request timestamp>' : item));
    assert.deepEqual(stable(golden), stable(JSON.parse(fs.readFileSync(goldenFile))), "Response semantics changed");
  }
  fs.writeFileSync(path.join(directory, `benchmark-${mode}.json`), JSON.stringify(output, null, 2));
  console.log = originalLog; console.warn = originalWarn;
  console.log(JSON.stringify(output));
})().catch(error => { console.log = originalLog; console.warn = originalWarn; console.error(error.message); process.exitCode = 1; });
