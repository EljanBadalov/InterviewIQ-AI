// Production navigation measurements using a fixed 120 ms API fixture.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("../../server/node_modules/playwright");
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const test = await require("./cacheFixture.cjs")(browser)();
    const measurements = [];
    for (const route of ["/dashboard", "/dashboard/career-automation", "/dashboard", "/dashboard/career-automation", "/dashboard/jobs", "/dashboard", "/dashboard/jobs"]) {
      const before = test.calls.length, start = Date.now();
      if (!measurements.length) await test.page.goto("http://127.0.0.1:5176" + route);
      else await test.page.locator(`a.nav-item[href="${route}"]`).first().click();
      const selector = route.endsWith("career-automation") ? ".career-graph-header" : route.endsWith("jobs") ? ".jobs-hero" : ".dashboard-home";
      await test.page.locator(selector).waitFor();
      if (route.endsWith("career-automation")) await test.page.getByRole("heading", { name: "Backend Developer", exact: true }).waitFor();
      if (route === "/dashboard") await test.page.locator(".stat-value").first().filter({ hasText: "%" }).waitFor();
      const visibleMs = Date.now() - start;
      await test.page.waitForTimeout(600);
      await test.page.waitForLoadState("networkidle");
      const calls = test.calls.slice(before).map(({ endpoint, search, method }) => ({ endpoint, search, method }));
      measurements.push({ route, visibleMs, requests: calls.length, calls });
    }
    assert.deepEqual(test.errors, []);
    assert.deepEqual(test.unexpected, []);
    const directory = path.resolve(__dirname, "../node_modules/.cache/query-qa");
    fs.mkdirSync(directory, { recursive: true });
    const mode = process.argv.includes("--baseline") ? "before" : "after";
    fs.writeFileSync(path.join(directory, `navigation-${mode}.json`), JSON.stringify(measurements, null, 2));
    if (mode === "after") for (const index of (process.argv.includes("--priority") ? [3, 6] : [2, 3, 5, 6])) assert.equal(measurements[index].requests, 0, measurements[index].route);
    console.log(JSON.stringify({ mode, measurements }));
    await test.context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
