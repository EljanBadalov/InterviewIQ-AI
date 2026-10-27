// All mutations in this suite hit isolated browser fixtures, never the real API.
const assert = require("node:assert/strict");
const { chromium } = require("../../server/node_modules/playwright");
const base = "http://127.0.0.1:5176";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const setup = require("./cacheFixture.cjs")(browser);
    let jobVersion = 1, roadmapVersion = 1, completed = 0, resumeVersion = 0;
    let failures = 0, failureStatus = 500, holdJobs = false, releaseJobs;
    let profile = { targetRoles: ["Backend Developer"], locations: ["Baku, Azerbaijan"], workModes: [] };
    let bookmarks = [{ _id: "fixture-question", text: "Explain an index", category: "backend", difficulty: "beginner", interviewType: "technical" }];
    const secondUser = { id: "account-b", fullName: "Second Account", email: "second@example.invalid", role: "user" };
    const automation = () => ({ _id: "fixture-roadmap", targetRole: "Backend Developer", currentReadinessScore: roadmapVersion, roadmap: [], tasks: [], careerContext:{status:'current',evidenceFreshness:'current'}, jobPreferences: profile });
    const test = await setup(true, { respond: async ({ route, url, endpoint, send }) => {
      const method = route.request().method();
      const owner = route.request().headers().authorization === "Bearer fixture-account-b" ? "B" : "A";
      if (endpoint === "/auth/login") { await send({ token: "fixture-account-b", user: secondUser }); return true; }
      if (endpoint === "/jobs") {
        const page = Number(url.searchParams.get("page") || 1), search = url.searchParams.get("search") || "all";
        const version = jobVersion;
        if (holdJobs && owner === "A") await new Promise(resolve => { releaseJobs = resolve; });
        if (search === "slow") await sleep(900);
        if (failures > 0) { failures--; await route.fulfill({ status: failureStatus, json: { success: false, message: "Fixture failure" } }); return true; }
        const job = { _id: `job-${owner}-${page}`, title: `${owner} ${search} page ${page} version ${version}`, company: "Fixture Company", location: "Baku", remoteType: "remote", employmentType: "full-time", experienceMin: 1, experienceMax: 2, description: "Isolated fixture vacancy", responsibilities: [], requirements: [], preferredQualifications: [], skills: ["SQL"], keywords: [], salary: 1000, source: "Greenhouse", match: null };
        await route.fulfill({ json: { success: true, careerContext:{owner:owner==='B'?'account-b':'route-fixture',activeCareer:{targetRole:'Backend Developer',roleKey:'backend-developer',revision:0},evidenceRevision:0,automationRevision:0,preferencesKey:'fixture-preferences'}, hasResume: true, resume: { id: "fixture-resume", fileName: "fixture.pdf", overallScore: 70 }, data: { jobs: [job], total: 36, page, limit: 18, totalPages: 2, hasNextPage: page < 2, hasPreviousPage: page > 1 } } });
        return true;
      }
      if (endpoint === "/jobs/external/refresh") { jobVersion++; await send({ jobs: [] }); return true; }
      if (endpoint === "/career-automation") { await send(automation()); return true; }
      if (endpoint === "/career-automation/summary") { await send({ currentReadinessScore: roadmapVersion }); return true; }
      if (endpoint === "/career-automation/replan") { roadmapVersion++; await send({ automation: automation(), summary: { currentReadinessScore: roadmapVersion } }); return true; }
      if (endpoint === "/career-automation/job-preferences") { const body = route.request().postDataJSON(); profile = { targetRoles: [body.targetRole], locations: body.locations, workModes: body.workModes }; await send({ automation: automation(), summary: { currentReadinessScore: roadmapVersion } }); return true; }
      if (endpoint === "/career-automation/fields") { await send({ fields: [{ slug: "backend", name: "Backend Developer", category: "engineering" }] }); return true; }
      if (endpoint === "/dashboard/stats") { await send({ stats: { totalInterviews: completed, completedInterviews: completed, averageScore: 70, bestScore: 70 }, recentInterviews: [] }); return true; }
      if (endpoint === "/interviews") { await send([{ _id: "fixture-interview", category: "backend", difficulty: "beginner", interviewType: "technical", status: "in_progress", createdAt: new Date().toISOString() }]); return true; }
      if (endpoint === "/interviews/fixture-interview" && method === "GET") { await send({ interviewId: "fixture-interview", status: "in_progress", totalQuestions: 1, question: { questionId: "fixture-question", questionText: "Explain an index." } }); return true; }
      if (endpoint === "/interviews/fixture-interview/answers") { completed++; await send({ completed: true, overallScore: 70, evaluation: { score: 70, technicalAccuracy: 70, completeness: 70, communication: 70, feedback: "Fixture evaluation", improvedAnswer: "Fixture improved answer", strengths: ["Clarity"], weaknesses: ["Detail"] } }); return true; }
      if (endpoint === "/bookmarks") { await send({ bookmarks, totalBookmarks: bookmarks.length }); return true; }
      if (endpoint === "/bookmarks/fixture-question" && method === "DELETE") { bookmarks = []; await send({}); return true; }
      if (endpoint === "/resume/analyze") { resumeVersion++; await send({ fileName: "fixture.pdf", overallScore: 70, atsScore: 70, contentScore: 70, structureScore: 70, summary: "Fixture analysis" }); return true; }
      if (endpoint === "/resume/history") { await send({ analyses: resumeVersion ? [{ _id: "fixture-analysis", fileName: "fixture.pdf", overallScore: 70 }] : [] }); return true; }
      return false;
    } });
    const { page, calls } = test;
    const count = endpoint => calls.filter(call => call.endpoint === endpoint).length;
    async function nav(route) {
      await page.locator(`a.nav-item[href="${route}"]`).first().click();
      await page.waitForURL(base + route);
    }
    async function settle() { await page.waitForTimeout(300); await page.waitForLoadState("networkidle"); }
    const title = text => page.getByRole("heading", { name: text, exact: true });
    await page.goto(base + "/dashboard/jobs");
    await title("A all page 1 version 1").waitFor();
    assert.equal(count("/jobs"), 1);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await title("A all page 2 version 1").waitFor();
    const beforePrevious = count("/jobs");
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await title("A all page 1 version 1").waitFor();
    await settle(); assert.equal(count("/jobs"), beforePrevious);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await title("A all page 2 version 1").waitFor();
    const search = page.getByPlaceholder("Search by role, company, location or skill...");
    await search.fill("slow");
    await page.waitForRequest(request => new URL(request.url()).searchParams.get("search") === "slow");
    await search.fill("fresh");
    await title("A fresh page 1 version 1").waitFor();
    await page.waitForTimeout(1000);
    assert.equal(await title("A slow page 1 version 1").count(), 0);
    assert.equal(calls.filter(call => call.endpoint === "/jobs" && call.search.includes("search=fresh")).length, 1);
    await page.getByRole("button", { name: /Refresh jobs/i }).click();
    await title("A fresh page 1 version 2").waitFor();
    assert.equal(count("/jobs/external/refresh"), 1);
    await search.fill("");
    await title("A all page 1 version 2").waitFor();
    assert.ok(calls.filter(call => call.endpoint === "/jobs" && call.search.includes("search=slow")).every(call => call.search.includes("page=1")));
    await page.locator(".jobs-filter-trigger").click();
    const filteredRequest = page.waitForRequest(request => new URL(request.url()).searchParams.get("employmentType") === "full-time");
    await page.getByRole("button", { name: "Full-time", exact: true }).click();
    await filteredRequest;
    await page.getByRole("button", { name: "Close filters", exact: true }).click();
    await settle();
    assert.ok(calls.some(call => call.endpoint === "/jobs" && call.search.includes("employmentType=full-time") && call.search.includes("page=1")));
    await nav("/dashboard"); await settle();
    await page.evaluate(() => { window.restoreFixtureDate = Date.now; Date.now = () => window.restoreFixtureDate() + 61_000; });
    const beforeStale = count("/jobs");
    holdJobs = true;
    await nav("/dashboard/jobs");
    await title("A all page 1 version 2").waitFor();
    await page.getByRole("status").filter({ hasText: "Updating job matches..." }).waitFor();
    assert.equal(await page.locator(".jobs-loading").count(), 0);
    await page.waitForTimeout(160);
    await page.evaluate(() => { Date.now = window.restoreFixtureDate; });
    holdJobs = false; releaseJobs?.();
    await settle();
    assert.equal(count("/jobs"), beforeStale + 1);
    console.log("PASS Jobs deduplication, pagination/filter reset, cache reuse, canceled search race, explicit refresh and nonblocking stale revalidation");

    await nav("/dashboard/career-automation");
    await title("Backend Developer").waitFor(); await settle();
    await page.getByRole("button", { name: "Rebuild roadmap", exact: true }).click();
    await page.waitForResponse(response => response.url().endsWith("/career-automation/replan"));
    await settle();
    assert.equal(count("/career-automation/replan"), 1);
    assert.ok((await page.locator(".career-readiness-pill").innerText()).includes("2%"));
    const roadmapReads = count("/career-automation");
    await nav("/dashboard"); await settle();
    await nav("/dashboard/career-automation"); await title("Backend Developer").waitFor(); await settle();
    assert.equal(count("/career-automation"), roadmapReads, "Authoritative rebuild result was not cached");
    await page.getByRole("button", { name: "Job Preferences", exact: true }).click();
    await page.locator(".career-job-preferences-grid select").first().selectOption("Backend Developer");
    await page.getByRole("button", { name: "Save Preferences", exact: true }).click();
    await page.locator(".career-job-preferences-modal").waitFor({ state: "hidden" });
    assert.equal(count("/career-automation/job-preferences"), 1);
    assert.equal(count("/jobs/external/refresh"), 1, "Saving preferences must not start another refresh");
    const jobsAfterPreferences = count("/jobs");
    await nav("/dashboard/jobs"); await title("A all page 1 version 2").waitFor();
    assert.equal(count("/jobs"), jobsAfterPreferences + 1);
    console.log("PASS roadmap rebuild result, navigation reuse and job-preference invalidation");

    await nav("/dashboard"); await settle();
    const statsBeforeBookmark = count("/dashboard/stats");
    const progressReads = count("/progress");
    await nav("/dashboard/performance-progress"); await title("Performance & Progress").waitFor(); await settle();
    assert.equal(count("/progress"), progressReads, "Dashboard and Performance must share their progress query");
    await nav("/dashboard/bookmarks"); await page.getByText("Explain an index", { exact: true }).waitFor();
    await page.locator(".remove-bookmark-btn").click();
    await settle();
    assert.equal(await page.getByText("Explain an index", { exact: true }).count(), 0);
    await nav("/dashboard"); await settle();
    assert.equal(count("/dashboard/stats"), statsBeforeBookmark, "Bookmark mutation invalidated unrelated dashboard data");
    console.log("PASS targeted bookmark invalidation preserves unrelated dashboard cache");

    await nav("/dashboard/resume-analysis"); await page.locator('input[type="file"]').setInputFiles({ name: "fixture.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 isolated fixture") });
    await page.getByRole("button", { name: /Analyze/i }).first().click();
    await page.waitForResponse(response => response.url().endsWith("/resume/analyze")); await settle();
    const readsBeforeCV = count("/career-automation");
    await nav("/dashboard/career-automation"); await title("Backend Developer").waitFor(); await settle();
    assert.equal(count("/career-automation"), readsBeforeCV + 1);
    const statsBeforeInterview = count("/dashboard/stats");
    await nav("/dashboard/mock-interview");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Continue interview", exact: true }).click();
    assert.equal(count("/career-automation/fields"), 1, "Mock Interview should reuse the fields loaded in Job Preferences");
    await page.locator("textarea").fill("An index speeds up selective queries by keeping an ordered lookup structure.");
    await page.getByRole("button", { name: /Submit/i }).click();
    await page.getByText("Fixture evaluation", { exact: true }).waitFor();
    await nav("/dashboard"); await settle();
    assert.equal(count("/dashboard/stats"), statsBeforeInterview + 1);
    console.log("PASS fixture CV analysis and interview completion invalidate dependent reads");

    await nav("/dashboard/jobs"); await title("A all page 1 version 2").waitFor();
    const slowSearch = page.getByPlaceholder("Search by role, company, location or skill...");
    holdJobs = true;
    await slowSearch.fill("account-switch");
    await page.waitForRequest(request => new URL(request.url()).searchParams.get("search") === "account-switch");
    await page.waitForTimeout(150);
    const canceledRequest = page.waitForEvent("requestfailed", { predicate: request => request.url().includes("search=account-switch") });
    await page.getByRole("button", { name: "Logout", exact: true }).click();
    await canceledRequest;
    await page.waitForURL("**/login");
    assert.equal(await page.evaluate(() => localStorage.getItem("interviewiq_user")), null);
    await page.locator('input[type="email"]').first().fill(secondUser.email);
    await page.locator('input[type="password"]').first().fill("synthetic-fixture-password");
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL("**/dashboard");
    holdJobs = false; releaseJobs?.();
    await nav("/dashboard/jobs"); await title("B all page 1 version 2").waitFor(); await settle();
    assert.equal(await page.locator(".job-card-title h3").filter({ hasText: /^A / }).count(), 0);
    assert.equal(await page.evaluate(() => sessionStorage.getItem("interviewiq.jobsPage.cache.v1")), null);
    console.log("PASS logout/account switch cancels pending reads and never displays the previous account's results");

    await page.reload(); await title("B all page 1 version 2").waitFor();
    await nav("/dashboard"); await settle();
    await page.evaluate(() => { window.restoreFixtureDate = Date.now; Date.now = () => window.restoreFixtureDate() + 61_000; });
    failures = 2; failureStatus = 500;
    await nav("/dashboard/jobs");
    await page.locator(".jobs-error").first().waitFor();
    assert.ok(await title("B all page 1 version 2").isVisible(), "A failed background refetch hid cached results");
    assert.equal(await page.locator(".jobs-loading").count(), 0);
    await page.evaluate(() => { Date.now = window.restoreFixtureDate; });
    console.log("PASS cached data remains visible after a background refetch fails");
    assert.deepEqual(test.unexpected, []); assert.deepEqual(test.errors, []);
    await test.context.close();

    // A cold query retries a transient failure once, but never retries unauthorized reads.
    failures = 1; failureStatus = 500;
    const transient = await setup(true, { respond: async ({ route, endpoint }) => {
      if (endpoint !== "/jobs" || failures <= 0) return false;
      failures--; await route.fulfill({ status: failureStatus, json: { success: false } }); return true;
    } });
    await transient.page.goto(base + "/dashboard/jobs"); await transient.page.locator(".jobs-hero").waitFor(); await sleep(700);
    assert.equal(transient.calls.filter(call => call.endpoint === "/jobs").length, 2);
    await transient.context.close();
    const denied = await setup(true, { respond: async ({ route, endpoint }) => {
      if (endpoint !== "/jobs") return false;
      await route.fulfill({ status: 401, json: { success: false } }); return true;
    } });
    await denied.page.goto(base + "/dashboard/jobs"); await denied.page.locator(".jobs-error").first().waitFor(); await sleep(700);
    assert.equal(denied.calls.filter(call => call.endpoint === "/jobs").length, 1);
    await denied.context.close();
    const unavailable = await setup(true, { respond: async ({ route, endpoint }) => {
      if (endpoint !== "/career-automation") return false;
      await route.fulfill({ status: 503, json: { success: false } }); return true;
    } });
    await unavailable.page.goto(base + "/dashboard/career-automation");
    await unavailable.page.getByRole("alert").filter({ hasText: "Career roadmap could not be loaded." }).waitFor();
    assert.equal(await unavailable.page.getByText(/Create your Career Automation profile first/).count(), 0);
    assert.ok(await unavailable.page.getByRole("button", { name: "Retry", exact: true }).isVisible());
    await unavailable.context.close();
    console.log("PASS direct refresh, transient retry, no retry on 401, and roadmap errors are not shown as an absent profile");
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
