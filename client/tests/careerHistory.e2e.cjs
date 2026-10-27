// Isolated browser fixtures. This suite never calls MongoDB or Qwen.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("../../server/node_modules/playwright");
const artifacts = path.resolve(__dirname, "../node_modules/.cache/career-ui-qa");
fs.mkdirSync(artifacts, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    await context.addInitScript(() => {
      if (!sessionStorage.getItem("fixture-initialized")) {
        localStorage.setItem("interviewiq_token", "ui-test-token");
        localStorage.setItem("interviewiq_user", JSON.stringify({ id: "111111111111111111111111", fullName: "History Test", email: "test@example.invalid", role: "user" }));
        sessionStorage.setItem("fixture-initialized", "yes");
      }
    });
    const savedId = "333333333333333333333333";
    const olderId = "555555555555555555555555";
    let conversations = [{ conversationId: savedId, sessionId: "fixture-existing", userId: "111111111111111111111111", title: "Saved conversation", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
    const makeMessage = (id, text, sender = "assistant") => ({ _id: id, sender, text, intent: "SKILL_GAP", metadata: { careerSubject: "backend", recommendedTopics: ["SQL"], action: "REPLY", data: {} }, createdAt: new Date().toISOString() });
    const messages = { [savedId]: [
      ...Array.from({ length: 12 }, (_, index) => makeMessage(`history-${index}`, `Career note ${index + 1}: Build a practical project, document the decisions and test its behavior.\n\nFocus on a measurable learning outcome.`, index % 3 === 1 ? "customer" : "assistant")),
      makeMessage("old-message", "Previously recommended SQL\n\n### Next steps\n- Practice queries\n- Review indexes\n\n```sql\nSELECT skill FROM profile;\n```")
    ] };
    messages[savedId].splice(3, 0, {
      ...makeMessage("job-card", "A matching vacancy"), intent: "JOB_MATCHING",
      metadata: { careerSubject: "backend", recommendedTopics: ["SQL"], action: "REPLY", data: { jobMatching: { jobs: [
        { id: "fixture-job", title: "Backend Developer", company: "Test Company", location: "Baku", matchScore: 85, matchedSkills: ["SQL"], missingSkills: ["Docker"] }
      ] } } }
    });
    let deleteCount = 0, createCount = 0, listCalls = 0, failRename = false, releaseReply;
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (!url.pathname.includes("/api/v1/")) {
        if (url.hostname === "127.0.0.1") return route.continue();
        return route.abort();
      }
      const pathname = url.pathname.split("/api/v1")[1];
      const method = route.request().method();
      const send = data => route.fulfill({ json: { success: true, data } });
      if (pathname === "/cs/conversations" && method === "GET") {
        listCalls++;
        if (url.searchParams.get("cursor")) return send({ conversations: [{ ...conversations[0], conversationId: olderId, title: "Older conversation" }], nextCursor: null });
        return send({ conversations, nextCursor: "older-page" });
      }
      if (pathname === "/cs/conversations" && method === "POST") { createCount++; return route.fulfill({ status: 500, json: { success: false } }); }
      const match = pathname.match(/^\/cs\/conversations\/([^/]+)(\/messages)?$/);
      if (match && method === "PATCH") {
        const { title } = route.request().postDataJSON();
        if (failRename) { failRename = false; await new Promise(resolve => setTimeout(resolve, 150)); return route.fulfill({ status: 500, json: { success: false } }); }
        const item = conversations.find(c => c.conversationId === match[1]);
        item.title = title.trim().replace(/\s+/g, " "); return send({ conversationId: item.conversationId, title: item.title });
      }
      if (match && method === "DELETE") { deleteCount++; conversations = conversations.filter(c => c.conversationId !== match[1]); return send({}); }
      if (match && match[2]) {
        if (url.searchParams.get("before")) return send({ messages: [makeMessage("earlier-message", "Earlier question", "customer")], nextBefore: null });
        return send({ messages: messages[match[1]] || [], nextBefore: match[1] === savedId ? "1" : null });
      }
      if (match) return send(conversations.find(c => c.conversationId === match[1]));
      if (pathname === "/cs/chat") {
        const body = route.request().postDataJSON(); assert.equal(body.userId, undefined);
        let item = conversations.find(c => c.sessionId === body.sessionId);
        if (!item) {
          item = { ...conversations[0], conversationId: "444444444444444444444444", sessionId: body.sessionId, title: body.message };
          conversations.unshift(item); messages[item.conversationId] = [];
        }
        messages[item.conversationId].push(makeMessage(`user-${Date.now()}`, body.message, "customer"));
        if (body.message === "Delayed answer test") await new Promise(resolve => { releaseReply = resolve; });
        const reply = body.message === "Delayed answer test" ? "A delayed contextual reply" : "New session reply";
        messages[item.conversationId].push(makeMessage(`reply-${Date.now()}`, reply));
        return send({ sessionId: body.sessionId, conversation: item, reply, intent: "GENERAL_CAREER_HELP", confidence: 1, alternatives: [], needsClarification: false, action: "REPLY", requiresHuman: false, memory: {}, data: {} });
      }
      return route.fulfill({ status: 404, json: { success: false } });
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto("http://127.0.0.1:5176/dashboard/career-assistant");
    await page.getByText("Previously recommended SQL", { exact: true }).waitFor();
    assert.equal(await page.locator(".career-job-card").count(), 1);
    assert.equal(await page.getByRole("link", { name: /View Job/ }).getAttribute("href"), "/dashboard/jobs/fixture-job");
    const historyBox = await page.locator(".career-history").boundingBox();
    const chatBox = await page.locator(".career-assistant-chat").boundingBox();
    assert.ok(historyBox.x + historyBox.width < chatBox.x);
    assert.ok(Math.abs(historyBox.y - chatBox.y) < 2 && Math.abs(historyBox.height - chatBox.height) < 2);
    assert.ok(chatBox.width > historyBox.width);
    assert.equal(await page.locator(".career-assistant-header").count(), 0);
    await page.screenshot({ animations: "disabled", path: path.join(artifacts, "desktop.png") });
    const viewport = page.getByRole("region", { name: "Conversation messages" });
    await viewport.evaluate(el => { el.scrollTop = 0; });
    const before = await viewport.evaluate(el => ({ top: el.scrollTop, height: el.scrollHeight }));
    await page.getByRole("button", { name: "Load earlier messages", exact: true }).click();
    await page.getByText("Earlier question", { exact: true }).waitFor();
    const after = await viewport.evaluate(el => ({ top: el.scrollTop, height: el.scrollHeight }));
    assert.ok(Math.abs(after.top - before.top - (after.height - before.height)) < 5, `Older-message loading should preserve scroll position: ${JSON.stringify({before,after})}`);
    const callsBeforeSearch = listCalls;
    await page.getByRole("textbox", { name: "Search conversations", exact: true }).fill("not found");
    await page.getByText("No matching conversations", { exact: true }).waitFor();
    assert.equal(listCalls, callsBeforeSearch);
    await page.getByRole("textbox", { name: "Search conversations", exact: true }).fill("");
    await page.getByRole("button", { name: "Load more conversations", exact: true }).click();
    await page.getByRole("button", { name: /Older conversation/ }).first().waitFor();
    await page.getByLabel("Actions for Saved conversation", { exact: true }).click();
    await page.getByRole("button", { name: "Rename", exact: true }).click();
    await page.getByRole("textbox", { name: /Conversation title/ }).fill("Backend Developer Career Plan");
    await page.getByRole("button", { name: "Save title", exact: true }).click();
    await page.getByRole("heading", { name: "Backend Developer Career Plan", exact: true }).waitFor();
    await page.reload();
    await page.getByRole("heading", { name: "Backend Developer Career Plan", exact: true }).waitFor();
    failRename = true;
    await page.getByRole("button", { name: "Rename active conversation" }).click();
    await page.getByRole("textbox", { name: /Conversation title/ }).fill("This must roll back");
    await page.getByRole("button", { name: "Save title", exact: true }).click();
    await page.getByRole("dialog").getByRole("alert").waitFor();
    await page.getByRole("heading", { name: "Backend Developer Career Plan", exact: true }).waitFor();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByPlaceholder("Ask InterviewIQ about your career...").fill("Delayed answer test");
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".career-message-thinking") !== null);
    await viewport.evaluate(el => { el.scrollTop = 0; });
    await page.waitForTimeout(80);
    assert.ok(releaseReply); releaseReply();
    await page.getByText("A delayed contextual reply", { exact: true }).waitFor();
    assert.ok(await viewport.evaluate(el => el.scrollTop < 100), "An AI reply must not pull a reader away from earlier messages");
    const savedCount = conversations.length;
    for (let index = 0; index < 3; index++) await page.getByRole("button", { name: "New Chat", exact: false }).first().click();
    assert.equal(createCount, 0); assert.equal(conversations.length, savedCount);
    assert.equal(await page.getByText("Previously recommended SQL", { exact: true }).count(), 0);
    await page.getByPlaceholder("Ask InterviewIQ about your career...").fill("A multiline draft");
    await page.getByPlaceholder("Ask InterviewIQ about your career...").press("Shift+Enter");
    assert.ok((await page.getByPlaceholder("Ask InterviewIQ about your career...").inputValue()).includes("\n"));
    assert.equal(conversations.length, savedCount);
    await page.getByPlaceholder("Ask InterviewIQ about your career...").fill("A new question");
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    await page.getByText("New session reply", { exact: true }).waitFor();
    assert.equal(createCount, 0); assert.equal(conversations.length, savedCount + 1);
    await page.reload(); await page.getByText("New session reply", { exact: true }).waitFor();
    for (const width of [1024, 820, 390]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Layout must fit ${width}px`);
    }
    await page.screenshot({ animations: "disabled", path: path.join(artifacts, "mobile.png") });
    await page.getByRole("button", { name: "Open chat history", exact: true }).click();
    await page.getByRole("textbox", { name: "Search conversations", exact: true }).waitFor({ state: "visible" });
    await page.screenshot({ animations: "disabled", path: path.join(artifacts, "mobile-history.png") });
    await page.getByRole("complementary", { name: "Chat history" }).getByRole("button", { name: "Close chat history", exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.getByLabel("Actions for A new question", { exact: true }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog").waitFor(); assert.equal(deleteCount, 0);
    await page.getByRole("button", { name: "Cancel", exact: true }).click(); assert.equal(deleteCount, 0);
    await page.getByLabel("Actions for A new question", { exact: true }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("button", { name: "Delete conversation", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" }); assert.equal(deleteCount, 1);
    await page.getByRole("button", { name: /Backend Developer Career Plan/ }).first().click();
    await page.getByText("Previously recommended SQL", { exact: true }).waitFor();
    await page.getByRole("button", { name: /logout/i }).click(); await page.waitForURL("**/login");
    const cleared = await page.evaluate(() => ({ token: localStorage.getItem("interviewiq_token"), keys: Object.keys(sessionStorage).filter(key => key.startsWith("interviewiq-career")) }));
    assert.equal(cleared.token, null); assert.deepEqual(cleared.keys, []); assert.deepEqual(pageErrors, []);
    console.log("PASS: two-panel layout, local search, pagination, rename persistence/rollback, draft isolation, scrolling, mobile drawer, soft-delete confirmation and logout");
    console.log("UI screenshots:", artifacts);
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
