const assert = require("node:assert/strict");
const path = require("node:path");
const storage = new Map([
  ["interviewiq_token", "unit-fixture-token"],
  ["interviewiq_user", JSON.stringify({ id: "account-a" })],
]);
global.localStorage = { getItem: key => storage.get(key) || null };
global.window = new EventTarget();
const root = path.resolve(__dirname, "../node_modules/.cache/query-unit");
const { queryClient } = require(path.join(root, "queryClient.js"));
const { apiQueryKey, mutationGroups, resourceStaleTime } = require(path.join(root, "queryPolicy.js"));
const { beginSessionChange, sessionEpoch } = require(path.join(root, "authScope.js"));
queryClient.setDefaultOptions({ queries: { staleTime: 60_000, gcTime: 0, retry: false } });
(async () => {
  const key = apiQueryKey("account-a", 0, "/jobs?page=1&limit=18");
  assert.deepEqual(key, apiQueryKey("account-a", 0, "/jobs?limit=18&page=1"));
  assert.notDeepEqual(key, apiQueryKey("account-a", 0, "/jobs?page=2&limit=18"));
  assert.notDeepEqual(key, apiQueryKey("account-b", 0, "/jobs?page=1&limit=18"));
  assert.ok(!JSON.stringify(key).includes("unit-fixture-token"));
  let calls = 0;
  const options = { queryKey: key, queryFn: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); return { jobs: ["fixture"] }; } };
  await Promise.all([queryClient.fetchQuery(options), queryClient.fetchQuery(options)]);
  assert.equal(calls, 1);
  await queryClient.fetchQuery(options);
  assert.equal(calls, 1);
  await queryClient.invalidateQueries({ queryKey: key, refetchType: "none" });
  await queryClient.fetchQuery(options);
  assert.equal(calls, 2);
  storage.set("interviewiq_user", JSON.stringify({ id: "account-a", fullName: "Updated name" }));
  const profileEvent = new Event("storage");
  Object.defineProperty(profileEvent, "key", { value: "interviewiq_user" });
  window.dispatchEvent(profileEvent);
  assert.equal(sessionEpoch(), 0, "A same-account profile update must not flush all queries");
  assert.ok(queryClient.getQueryData(key));
  let aborted = false;
  const pending = queryClient.fetchQuery({ queryKey: ["account", "account-a", 0, "pending"], queryFn: ({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => { aborted = true; reject(new Error("Aborted fixture")); });
  }) }).catch(() => undefined);
  beginSessionChange();
  await pending;
  assert.ok(aborted);
  assert.equal(queryClient.getQueryCache().getAll().length, 0);
  assert.equal(sessionEpoch(), 1);
  assert.deepEqual(mutationGroups("/bookmarks/fixture"), ["bookmarks"]);
  assert.ok(mutationGroups("/resume/analyze").includes("roadmap"));
  assert.ok(mutationGroups("/interviews/fixture/answer").includes("dashboard"));
  assert.ok(mutationGroups("/career-automation/replan").includes("jobs"));
  assert.equal(resourceStaleTime("/career-automation/fields"), 3_600_000);
  queryClient.clear();
  console.log("PASS query key normalization, account/parameter isolation, parallel deduplication, fresh cache reuse, targeted invalidation, cancellation and session reset");
})().catch(error => { console.error(error.message); process.exitCode = 1; });
