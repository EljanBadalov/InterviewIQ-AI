// Entirely isolated refresh benchmark: every external request and write is stubbed.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const f = require('./phase3-fixture.cjs');
const directory = path.resolve(__dirname, '../node_modules/.cache/phase3');
const mode = process.env.PHASE3_BASELINE === '1' ? 'before' : 'after';
const originalLog = console.log;
const stages = [];
console.log = (...args) => { for (const value of args) if (value?.timingsMs) stages.push(value.timingsMs); };
let providerCalls = 0, bulkCalls = 0, updateCalls = 0;
f.load('services/externalJobService').fetchGeneralExternalJobs = async () => {
  providerCalls++; await new Promise(resolve => setTimeout(resolve, 5));
  return [f.jobs[0], f.jobs[1]];
};
f.Job.bulkWrite = async () => { bulkCalls++; return { matchedCount: 2, modifiedCount: 0, upsertedCount: 0 }; };
f.Job.updateMany = async () => { updateCalls++; return { modifiedCount: 0 }; };
(async () => {
  f.resetCounters();
  const started = performance.now();
  const results = await Promise.all(Array.from({ length: 8 }, () => f.request(f.jobsController.refreshExternalJobs)));
  assert.ok(results.every(result => result.statusCode === 200));
  const elapsedMs = performance.now() - started;
  const response = JSON.parse(JSON.stringify(results[0].body));
  const golden = path.join(directory, 'refresh-response-before.json');
  if (mode === 'before') fs.writeFileSync(golden, JSON.stringify(response));
  else assert.deepEqual(response, JSON.parse(fs.readFileSync(golden)));
  const output = { fixture: true, realWrites: 0, realExternalRequests: 0, mode, concurrentRequests: 8, elapsedMs, stubbedProviderCalls: providerCalls, stubbedBulkCalls: bulkCalls, stubbedUpdateCalls: updateCalls, queries: f.counters.queries.length, materializedJobs: f.counters.queries.filter(q => q.model === 'jobs').reduce((n,q) => n+q.returned,0), responseBytes: Buffer.byteLength(JSON.stringify(response)), stages };
  fs.writeFileSync(path.join(directory, `refresh-benchmark-${mode}.json`), JSON.stringify(output, null, 2));
  console.log = originalLog; console.log(JSON.stringify(output));
})().catch(error => { console.log = originalLog; console.error(error.message); process.exitCode = 1; });
