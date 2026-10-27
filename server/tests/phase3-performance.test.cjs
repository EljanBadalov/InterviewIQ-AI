const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const f = require('./phase3-fixture.cjs');
const { request, jobsController, dashboard, load, ownerA, ownerB, resumes, jobs, resetCounters, counters, matching, Job } = f;
const profileService = load('services/careerSkillProfileService');
const cache = load('services/jobMatchCache');
const originalLog = console.log;
console.log = () => {};
test.after(() => { console.log = originalLog; });
const profile = () => profileService.buildCareerSkillProfile({ userId: ownerA });

test('protected controllers reject anonymous requests before database reads', async () => {
  for (const handler of [jobsController.getJobs, jobsController.getJobById, jobsController.getJobMatch, jobsController.refreshExternalJobs, jobsController.getExternalJobMatches, dashboard.getDashboardStatsController]) {
    resetCounters();
    assert.equal((await request(handler, {}, null)).statusCode, 401);
    assert.equal(counters.queries.length, 0);
  }
});
test('default jobs read only the requested page and reuse the owned resume', async () => {
  resetCounters();
  const result = await request(jobsController.getJobs, { page: '2', limit: '7' });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.data.jobs.length, 7);
  assert.equal(counters.queries.filter(q => q.model === 'resumes').length, 1);
  assert.equal(counters.queries.filter(q => q.model === 'jobs' && !q.count).reduce((n,q) => n + q.returned, 0), 7);
  const p = await profile();
  for (const item of result.body.data.jobs) {
    const expected = matching.calculateJobMatch(p, item, {targetRole:'Backend Developer',preferredExperienceLevels:['junior']});
    for (const key of ['matchScore', 'matchLevel', 'matchedSkills', 'missingSkills']) assert.deepEqual(item.match[key], expected[key]);
  }
});
test('out-of-range page clamps to the last page without changing totals', async () => {
  const { data } = (await request(jobsController.getJobs, { page: '99999', limit: '7' })).body;
  assert.equal(data.page, Math.ceil(data.total / 7));
  assert.equal(data.hasNextPage, false);
  assert.equal(data.jobs.length, data.total % 7 || 7);
});
test('match filtering retains full-pool scoring and newest-first ordering', async () => {
  const p = await profile();
  const expected = [...jobs].sort((a,b) => b.postedAt - a.postedAt || b.createdAt - a.createdAt)
    .filter(job => matching.calculateJobMatch(p, job, {targetRole:'Backend Developer',preferredExperienceLevels:['junior']}).matchLevel === 'good');
  const { data } = (await request(jobsController.getJobs, { matchLevel: 'good', limit: '7' })).body;
  assert.equal(data.total, expected.length);
  assert.deepEqual(data.jobs.map(j => String(j._id)), expected.slice(0,7).map(j => String(j._id)));
});
test('missing evidence preserves unfiltered pagination and null matches', async () => {
  const original = resumes[0].skillsDetected;
  resumes[0].skillsDetected = [];
  try {
    const result = await request(jobsController.getJobs, { matchLevel: 'good', limit: '3' });
    assert.equal(result.body.hasCareerProfile, false);
    assert.equal(result.body.data.total, jobs.length);
    assert.ok(result.body.data.jobs.every(job => job.match === null));
  } finally { resumes[0].skillsDetected = original; }
});
test('dashboard totals are user-scoped and preserve rounding and recent fields', async () => {
  resetCounters();
  const a = await request(dashboard.getDashboardStatsController);
  assert.deepEqual(a.body.data.stats, { totalInterviews: 3, completedInterviews: 2, inProgressInterviews: 1, averageScore: 76, bestScore: 80 });
  assert.equal(counters.queries.length, 2);
  const b = await request(dashboard.getDashboardStatsController, {}, ownerB);
  assert.equal(b.body.data.stats.averageScore, 99);
  assert.equal(b.body.data.recentInterviews.length, 1);
  assert.equal(a.body.data.recentInterviews[0].answers, undefined);
});
test('preloaded resume is reused only for its owner and selected resume', async () => {
  resetCounters();
  const own = await profileService.buildCareerSkillProfile({ userId: ownerA, resumeAnalysisId: resumes[0]._id, preloadedLatestResume: resumes[0] });
  assert.equal(counters.queries.filter(q => q.model === 'resumes').length, 0);
  resetCounters();
  const foreign = await profileService.buildCareerSkillProfile({ userId: ownerA, preloadedLatestResume: resumes[1] });
  assert.equal(foreign.userId, String(ownerA));
  assert.equal(foreign.resumeAnalysisId, own.resumeAnalysisId);
  assert.equal(counters.queries.filter(q => q.model === 'resumes').length, 1);
});
test('content cache preserves scoring, isolates users and refreshes after source changes', async () => {
  cache.clearJobMatchCache();
  const p = await profile(), job = jobs[0];
  const match = matching.createCachedJobMatcher(p, {});
  const first = match(job);
  assert.deepEqual(first, matching.calculateJobMatch(p, job, {}));
  first.matchedSkills.push('mutation');
  assert.ok(!match(job).matchedSkills.includes('mutation'));
  assert.equal(cache.getJobMatchCacheStats().hits, 1);
  matching.createCachedJobMatcher({ ...p, generatedAt: new Date() }, {})(job);
  assert.equal(cache.getJobMatchCacheStats().hits, 2);
  matching.createCachedJobMatcher({ ...p, userId: String(ownerB) }, {})(job);
  assert.equal(cache.getJobMatchCacheStats().misses, 2);
  for (const updated of [{ ...job, title: 'Designer' }, { ...job, skills: ['Design'] }, { ...job, keywords: ['CSS'] }, { ...job, experienceLevel: 'senior' }]) {
    assert.deepEqual(match(updated), matching.calculateJobMatch(p, updated, {}));
  }
  const updatedProfile = { ...p, skills: [], totalSkills: 0 };
  assert.deepEqual(matching.createCachedJobMatcher(updatedProfile, {})(job), matching.calculateJobMatch(updatedProfile, job, {}));
  matching.createCachedJobMatcher(p, { targetRole: 'Designer' })(job);
  assert.equal(cache.getJobMatchCacheStats().misses, 8);
});
test('cache expires and stays within entry and byte limits', async () => {
  cache.clearJobMatchCache();
  const p = await profile();
  const match = matching.createCachedJobMatcher(p, {});
  match(jobs[0]);
  const realNow = Date.now;
  try { Date.now = () => realNow() + 61000; match(jobs[0]); } finally { Date.now = realNow; }
  assert.equal(cache.getJobMatchCacheStats().misses, 2);
  for (let i=0; i<2100; i++) match({ ...jobs[0], _id: f.id(10000+i) });
  const stats = cache.getJobMatchCacheStats();
  assert.equal(stats.entries, stats.maxEntries);
  assert.ok(stats.bytes <= stats.maxBytes);
});
test('single-flight joins identical work, isolates keys and permits retry after failure', async () => {
  const share = load('services/singleFlight').createSingleFlight();
  let runs = 0, release;
  const work = () => { runs++; return new Promise(resolve => { release = resolve; }); };
  const a = share('a', work), b = share('a', work);
  assert.equal(a, b);
  await Promise.resolve(); release('done');
  assert.deepEqual(await Promise.all([a,b]), ['done','done']); assert.equal(runs, 1);
  await assert.rejects(share('a', async () => { throw new Error('fixture failure'); }));
  assert.equal(await share('a', async () => 'retried'), 'retried');
  assert.deepEqual(await Promise.all([share('a', async () => 'a'), share('b', async () => 'b')]), ['a','b']);
});
test('catalog refresh deduplicates concurrent provider and bulk work, clears failed operations', async () => {
  const external = load('services/externalJobService');
  const aggregation = load('services/jobAggregationService');
  const originalFetch = external.fetchGeneralExternalJobs, originalBulk = Job.bulkWrite, originalUpdate = Job.updateMany;
  let fetches = 0, bulks = 0, updates = 0;
  external.fetchGeneralExternalJobs = async () => { fetches++; await new Promise(r => setTimeout(r, 5)); return [jobs[0], jobs[1]]; };
  Job.bulkWrite = async (ops, options) => { bulks++; assert.equal(options.ordered, false); assert.equal(ops.length, 2); assert.ok(ops.every(op => op.updateOne.upsert)); return { matchedCount: 2, modifiedCount: 0, upsertedCount: 0 }; };
  Job.updateMany = async () => { updates++; return { modifiedCount: 0 }; };
  try {
    const results = await Promise.all(Array.from({ length: 8 }, () => aggregation.refreshSharedJobCatalog()));
    assert.equal(fetches, 1); assert.equal(bulks, 1); assert.equal(updates, 3);
    assert.ok(results.every(r => r.stored === 2));
    const before = updates;
    external.fetchGeneralExternalJobs = async () => [];
    await assert.rejects(aggregation.refreshSharedJobCatalog(), /zero accepted/);
    assert.equal(updates, before);
    external.fetchGeneralExternalJobs = async () => { throw new Error('Provider unavailable'); };
    await assert.rejects(aggregation.refreshSharedJobCatalog(), /Provider unavailable/);
    assert.equal(updates, before);
    external.fetchGeneralExternalJobs = async () => [jobs[0]];
    Job.bulkWrite = async () => { throw new Error('Fixture bulk failure'); };
    const errorLog = console.error; console.error = () => {};
    try { await assert.rejects(aggregation.refreshSharedJobCatalog(), /Fixture bulk failure/); } finally { console.error = errorLog; }
    assert.equal(updates, before);
    Job.bulkWrite = async () => ({ matchedCount: 1 });
    assert.equal((await aggregation.refreshSharedJobCatalog()).stored, 1);
  } finally { external.fetchGeneralExternalJobs = originalFetch; Job.bulkWrite = originalBulk; Job.updateMany = originalUpdate; }
});
test('per-user refresh joins ranking reads and keeps different accounts separate', async () => {
  const aggregation = load('services/jobAggregationService');
  resetCounters();
  const a = aggregation.refreshGeneralExternalJobsForUser(String(ownerA));
  const b = aggregation.refreshGeneralExternalJobsForUser(String(ownerA));
  assert.equal(a,b);
  const [one, two] = await Promise.all([a,b]);
  assert.deepEqual(one,two);
  assert.equal(counters.queries.filter(q => q.model === 'jobs').length, 1);
  const other = await aggregation.refreshGeneralExternalJobsForUser(String(ownerB));
  assert.notDeepEqual(one.jobs.map(j => j.matchScore), other.jobs.map(j => j.matchScore));
});

test('progress projects analytics fields without answer text or final reports', async () => {
  resetCounters();
  const result = await request(f.progress.getProgressController);
  assert.equal(result.statusCode, 200);
  const query = counters.queries.find(q => q.model === 'interviews');
  assert.ok(query.projection.includes('answers.weaknesses'));
  assert.ok(!query.projection.includes('answerText'));
  assert.ok(!query.projection.includes('finalReport'));
  assert.ok(query.bytes < 3000);
  assert.equal(result.body.data.completedInterviewsCount, 2);
  assert.ok(!JSON.stringify(result.body).includes('fixture private answer'));
});
test('selected owned resume and foreign resume fallback preserve ownership', async () => {
  const older = { ...resumes[0], _id: f.id(999), skillsDetected: ['Python'], createdAt: new Date('2025-01-01') };
  resumes.push(older);
  try {
    const selected = await profileService.buildCareerSkillProfile({ userId: ownerA, resumeAnalysisId: older._id, preloadedLatestResume: resumes[0] });
    assert.equal(selected.resumeAnalysisId, String(older._id));
    assert.equal(selected.totalSkills, 1);
    const foreign = await profileService.buildCareerSkillProfile({ userId: ownerA, resumeAnalysisId: resumes[1]._id, preloadedLatestResume: resumes[0] });
    assert.equal(foreign.resumeAnalysisId, String(resumes[0]._id));
  } finally { resumes.pop(); }
});

test('legacy fractional and infinite pagination never reaches MongoDB skip/limit', async () => {
  for (const query of [{ page: 'Infinity', limit: '3' }, { page: '1.5', limit: '2.5' }, { page: '10000000000000000', limit: '18' }]) {
    const { body, statusCode } = await request(jobsController.getJobs, query);
    assert.equal(statusCode, 200);
    assert.ok(body.data.jobs.length <= Number(query.limit));
    assert.equal(body.data.total, jobs.length);
  }
});
