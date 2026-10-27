// Isolated API fixtures. Credentials are synthetic; all external requests are intercepted.
const fs = require("node:fs");
const path = require("node:path");
const base = process.env.QUERY_TEST_ORIGIN || "http://127.0.0.1:5176";
const user = { id: "route-fixture", fullName: "Route Test", email: "route@example.invalid", role: "user", authProvider: "local" };
const automation = { _id: "route-fixture", targetRole: "Backend Developer", currentReadinessScore: 0, roadmap: [], tasks: [], jobPreferences: { targetRoles: ["Backend Developer"], locations: ["Baku, Azerbaijan"], workModes: [] } };
const progress = { completedInterviewsCount: 0, averageTechnicalAccuracy: 0, averageCompleteness: 0, averageCommunication: 0, technicalPerformance: { trend: [] }, behavioralPerformance: { trend: [] }, technicalBehavioralDifference: 0, lastFiveAverage: 0, previousFiveAverage: 0, recentChange: 0, consistencyScore: 0, bestStreak: 0, currentDifficulty: null, difficultyProgression: [], recurringWeaknesses: [], roleSkillProgress: null, aiInsights: {}, strongestCategory: null, weakestCategory: null, scoreProgression: [], categoryPerformance: [] };
const artifacts = path.resolve(__dirname, "../node_modules/.cache/route-loading-qa");
fs.mkdirSync(artifacts, { recursive: true });
module.exports = (browser) => {
  async function setup(authenticated = true, options = {}) {
   const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
   if (authenticated) await context.addInitScript(user => {
    if (!sessionStorage.getItem("fixture-initialized")) {
     localStorage.setItem("interviewiq_token", "isolated-fixture-token");
     localStorage.setItem("interviewiq_user", JSON.stringify(user));
     sessionStorage.setItem("fixture-initialized", "yes");
    }
   }, user);
   const errors = [], scripts = new Set(), unexpected = [], calls = [];
   let delayJobs = false, delayLocations = false;
   let selected={targetRole:'Backend Developer',roleKey:'backend-developer',revision:0};
   await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === base) {
     if ((delayJobs && /\/jobsPage-.*\.js$/.test(url.pathname)) || (delayLocations && /\/lib-.*\.js$/.test(url.pathname))) await new Promise(resolve => setTimeout(resolve, 700));
     return route.continue();
    }
    if (!url.pathname.includes("/api/v1/")) return route.fulfill({ contentType: "application/javascript", body: "" });
    const endpoint = url.pathname.split("/api/v1")[1];
    calls.push({ endpoint, search: url.search, method: route.request().method(), started: Date.now() });
    await new Promise(resolve => setTimeout(resolve, 120));
    const send = data => {
     const next=data?.activeCareer || data?.roleSkillProgress?.activeCareer;
     if(next)selected=next;
     const owner=route.request().headers().authorization==='Bearer fixture-account-b'?'account-b':user.id;
     const carrier=endpoint==='/progress'||endpoint.startsWith('/jobs')||endpoint.startsWith('/career-automation')&&!endpoint.endsWith('/fields');
     return route.fulfill({json:{success:true,data,...(carrier?{careerContext:{owner,activeCareer:selected,evidenceRevision:0,automationRevision:selected.revision,preferencesKey:'fixture-preferences'}}:{})}});
    };
    if (options.respond && await options.respond({ route, url, endpoint, send })) return;
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
    if(endpoint === '/career-automation/active-career')return send({activeCareer:{targetRole:'Backend Developer',roleKey:'backend-developer',revision:0}});
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
   return { context, page, scripts, errors, unexpected, calls, delayJobs: () => { delayJobs = true; }, delayLocations: () => { delayLocations = true; } };
  }
return setup;
};
