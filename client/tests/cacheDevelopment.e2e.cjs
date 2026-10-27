// Run against Vite development mode to distinguish StrictMode aborts from duplicates.
const assert = require("node:assert/strict");
const { chromium } = require("../../server/node_modules/playwright");
process.env.QUERY_TEST_ORIGIN = "http://127.0.0.1:5180";
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const test = await require("./cacheFixture.cjs")(browser)();
    const completed = [], canceled = [];
    test.page.on("response", response => {
      if (response.url().includes("/api/v1/")) completed.push(new URL(response.url()).pathname);
    });
    test.page.on("requestfailed", request => {
      if (request.url().includes("/api/v1/")) canceled.push(new URL(request.url()).pathname);
    });
    await test.page.goto(process.env.QUERY_TEST_ORIGIN + "/dashboard/career-automation");
    await test.page.getByRole("heading", { name: "Backend Developer", exact: true }).waitFor();
    await test.page.waitForTimeout(600);
    for (const endpoint of ["career-automation", "career-automation/summary", "jobs/external/matches"]) {
      assert.equal(completed.filter(path => path === "/api/v1/" + endpoint).length, 1, endpoint);
    }
    await test.page.locator('a.nav-item[href="/dashboard/jobs"]').click();
    await test.page.locator(".jobs-hero").waitFor();
    await test.page.waitForTimeout(600);
    assert.equal(completed.filter(path => path === "/api/v1/jobs").length, 1);
    await test.page.locator('a.nav-item[href="/dashboard/career-automation"]').click();
    await test.page.getByRole("heading", { name: "Backend Developer", exact: true }).waitFor();
    await test.page.waitForTimeout(300);
    assert.equal(completed.length, 4);
    await test.page.evaluate(async () => {
      const harness = await import("/tests/queryObservers.tsx");
      await harness.verifyParallelObservers();
    });
    assert.equal(completed.filter(path => path === "/api/v1/resume/history").length, 1);
    assert.deepEqual(test.errors, []);
    console.log(JSON.stringify({ result: "PASS StrictMode: one completed read per query, fresh-cache reuse and two parallel React observers share one request", completedRequests: completed.length, canceledAttempts: canceled.length, interceptedAttempts: test.calls.length }));
    await test.context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
