// Browser regression tests against the production build with isolated API fixtures.
// No request reaches the real backend, MongoDB, Google authentication, or Qwen.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { chromium } = require("../../server/node_modules/playwright");
const base = "http://127.0.0.1:5176";
const user = { id: "route-fixture", fullName: "Route Test", email: "route@example.invalid", role: "user", authProvider: "local" };
const automation = { _id: "route-fixture", targetRole: "Backend Developer", currentReadinessScore: 0, roadmap: [], tasks: [], jobPreferences: { targetRoles: ["Backend Developer"], locations: ["Baku, Azerbaijan"], workModes: [] } };
const progress = { completedInterviewsCount: 0, averageTechnicalAccuracy: 0, averageCompleteness: 0, averageCommunication: 0, technicalPerformance: { trend: [] }, behavioralPerformance: { trend: [] }, technicalBehavioralDifference: 0, lastFiveAverage: 0, previousFiveAverage: 0, recentChange: 0, consistencyScore: 0, bestStreak: 0, currentDifficulty: null, difficultyProgression: [], recurringWeaknesses: [], roleSkillProgress: null, aiInsights: {}, strongestCategory: null, weakestCategory: null, scoreProgression: [], categoryPerformance: [] };
const artifacts = path.resolve(__dirname, "../node_modules/.cache/route-loading-qa");
fs.mkdirSync(artifacts, { recursive: true });
(async () => {
 const browser = await chromium.launch({ channel: "msedge", headless: true });
 const metrics = [];
 try {
  async function setup(authenticated = true) {
   const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
   if (authenticated) await context.addInitScript(user => {
    if (!sessionStorage.getItem("fixture-initialized")) {
     localStorage.setItem("interviewiq_token", "isolated-fixture-token");
     localStorage.setItem("interviewiq_user", JSON.stringify(user));
     sessionStorage.setItem("fixture-initialized", "yes");
    }
   }, user);
   const errors = [], scripts = new Set(), unexpected = [];
   let delayJobs = false, delayLocations = false;
   await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === base) {
     if ((delayJobs && /\/jobsPage-.*\.js$/.test(url.pathname)) || (delayLocations && /\/lib-.*\.js$/.test(url.pathname))) await new Promise(resolve => setTimeout(resolve, 700));
     return route.continue();
    }
    if (!url.pathname.includes("/api/v1/")) return route.fulfill({ contentType: "application/javascript", body: "" });
    const endpoint = url.pathname.split("/api/v1")[1];
    const send = data => route.fulfill({ json: { success: true, data } });
    if (endpoint === '/career-automation/active-career') return send({activeCareer:{targetRole:'Backend Developer',roleKey:'backend-developer',revision:0}});
    if (endpoint === "/auth/login") return send({ token: "isolated-fixture-token", user });
    if (endpoint === "/auth/profile") return send(user);
    if (endpoint === "/dashboard/stats") return send({ stats: { totalInterviews: 0, completedInterviews: 0, averageScore: 0, bestScore: 0 }, recentInterviews: [] });
    if (endpoint === "/progress") return send(progress);
    if (endpoint === "/cs/conversations") return send({ conversations: [], nextCursor: null });
    if (endpoint === "/career-automation") return send(automation);
    if (endpoint === "/career-automation/summary") return send({ currentReadinessScore: 0 });
    if (endpoint === "/career-automation/fields") return send({ fields: [{ id: "backend", title: "Backend Developer" }] });
    if (endpoint === "/jobs/external/matches") return send({ jobs: [] });
    if (endpoint === "/jobs") return send({ jobs: [], total: 0, page: 1, totalPages: 1, filters: {} });
    if (endpoint === "/jobs/fixture-job") return send({ job: { _id: "fixture-job", title: "Fixture Backend Developer", company: "Fixture Company", location: "Baku", description: "Test role", skills: [], requirements: [], responsibilities: [], matchedSkills: [], missingSkills: [], matchScore: 0 } });
    if (endpoint === "/cv-optimization/jobs/fixture-job") return route.fulfill({ status: 400, json: { success: false, code: "RESUME_REQUIRED", message: "Upload a resume first." } });
    if (endpoint === "/interviews") return send([]);
    if (endpoint === "/interviews/fixture-interview") return send({ interviewId: "fixture-interview", status: "in_progress", totalQuestions: 1, question: { _id: "fixture-question", question: "Explain a database index.", text: "Explain a database index.", category: "backend", type: "technical" } });
    if (endpoint.startsWith("/bookmarks")) return send({ bookmarks: [], isBookmarked: false });
    if (endpoint === "/resume/history") return send({ analyses: [] });
    unexpected.push(endpoint);
    return route.fulfill({ status: 404, json: { success: false, message: "Unconfigured isolated fixture" } });
   });
   const page = await context.newPage();
   page.on("pageerror", error => errors.push(error.message));
   page.on("console", message => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push("Console: " + message.text());
   });
   page.on("response", response => {
    const url = new URL(response.url());
    if (url.origin === base && url.pathname.endsWith(".js")) {
     scripts.add(url.pathname);
     if (!response.ok()) errors.push(`Chunk HTTP ${response.status()}: ${url.pathname}`);
    }
   });
   page.on("requestfailed", request => { if (request.url().startsWith(base) && request.url().endsWith(".js")) errors.push("Chunk request failed"); });
   return { context, page, scripts, errors, unexpected, delayJobs: () => { delayJobs = true; }, delayLocations: () => { delayLocations = true; } };
  }
  for (const [route, selector] of [
   ["/", "h1"], ["/login", "form"], ["/register", "form"], ["/verify-email", "h1, h2"],
   ["/dashboard", "h1"], ["/dashboard/mock-interview", "h1"],
   ["/dashboard/mock-interview/fixture-interview", ".interview-session-page"], ["/dashboard/resume-analysis", "h1"],
   ["/dashboard/jobs", "h1"], ["/dashboard/jobs/fixture-job", "h1"],
   ["/dashboard/jobs/fixture-job/improve-cv", "h2"], ["/dashboard/performance-progress", "h1"],
   ["/dashboard/bookmarks", "h1"], ["/dashboard/career-assistant", "h1"],
   ["/dashboard/career-automation", "h1"], ["/dashboard/settings", "h1"]
  ]) {
   const test = await setup();
   const response = await test.page.goto(base + route);
   assert.equal(response.status(), 200, route);
   await test.page.waitForLoadState("networkidle");
   assert.ok((await test.page.locator("#root").innerText()).length > 20, route);
   assert.ok((await test.page.locator(selector).all()).length && (await Promise.all((await test.page.locator(selector).all()).map(element => element.isVisible()))).some(Boolean), "Route content missing: " + route);
   assert.equal(await test.page.getByText("Loading page...", { exact: true }).count(), 0, route);
   assert.deepEqual(test.errors, [], route);
   assert.deepEqual(test.unexpected, [], route);
   assert.ok(![...test.scripts].some(name => /\/lib-/.test(name)), "Location database loaded too early: " + route);
   assert.ok(![...test.scripts].some(name => /\/(ImproveCVWizard|ImproveCVModal|ResumeProfileCompletenessModal)-/.test(name)), "Closed modal was loaded: " + route);
   const files = [...test.scripts].map(name => fs.readFileSync(path.resolve(__dirname, "../dist", name.slice(1))));
   metrics.push({ route, rawBytes: files.reduce((sum, file) => sum + file.length, 0), gzipBytes: files.reduce((sum, file) => sum + zlib.gzipSync(file, { level: 9 }).length, 0), chunks: test.scripts.size });
   await test.page.reload();
   await test.page.waitForLoadState("networkidle");
   assert.deepEqual(test.errors, [], "Refresh " + route);
   console.log("PASS direct navigation and refresh:", route);
   await test.context.close();
  }
  const auth = await setup(false);
  await auth.page.goto(base + "/dashboard/career-assistant");
  await auth.page.waitForURL("**/login");
  await auth.page.locator('input[type="email"]').first().fill(user.email);
  await auth.page.locator('input[type="password"]').first().fill("fixture-password-only");
  await auth.page.locator('button[type="submit"]').first().click();
  await auth.page.waitForURL("**/dashboard");
  await auth.page.waitForLoadState("networkidle");
  auth.delayJobs();
  await auth.page.locator('a[href="/dashboard/jobs"]').click();
  await auth.page.getByRole("status").filter({ hasText: "Loading page..." }).waitFor();
  assert.ok(await auth.page.getByRole("button", { name: /logout/i }).isVisible(), "Dashboard shell disappeared during page loading");
  await auth.page.waitForLoadState("networkidle");
  await auth.page.getByRole("button", { name: /logout/i }).click();
  await auth.page.waitForURL("**/login");
  assert.equal(await auth.page.evaluate(() => localStorage.getItem("interviewiq_token")), null);
  assert.equal(await auth.page.evaluate(() => localStorage.getItem("interviewiq_user")), null);
  assert.deepEqual(auth.errors, []);
  console.log("PASS protected redirect, fixture login, persistent dashboard shell/loading state, logout");
  await auth.context.close();
  const location = await setup();
  await location.page.goto(base + "/dashboard/career-automation");
  await location.page.getByRole("button", { name: "Job Preferences", exact: true }).waitFor();
  assert.ok(![...location.scripts].some(name => /\/lib-/.test(name)));
  location.delayLocations();
  await location.page.getByRole("button", { name: "Job Preferences", exact: true }).click();
  await location.page.getByRole("status").filter({ hasText: "Loading locations..." }).waitFor();
  const country = location.page.locator('select').filter({ has: location.page.locator('option[value="AZ"]') });
  await country.waitFor();
  await country.selectOption("US");
  await location.page.locator(".career-location-selects select").nth(1).selectOption("MA");
  await location.page.locator(".career-location-selects select").nth(2).selectOption("Boston");
  assert.equal(await location.page.locator(".career-location-selects select").nth(2).inputValue(), "Boston");
  assert.equal([...location.scripts].filter(name => /\/lib-/.test(name)).length, 1);
  await location.page.screenshot({ path: path.join(artifacts, "preferences.png"), animations: "disabled" });
  await location.page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.ok(await location.page.getByText("Baku, Azerbaijan", { exact: false }).first().isVisible());
  assert.deepEqual(location.errors, []);
  console.log("PASS location chunk loads only when preferences open; country/state/city selection; cancel preserves saved location");
  await location.context.close();
  fs.writeFileSync(path.join(artifacts, "payloads.json"), JSON.stringify(metrics, null, 2));
  console.log(JSON.stringify(metrics));
 } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
