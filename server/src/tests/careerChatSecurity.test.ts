import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import type { Request, Response } from "express";
import CustomerConversation from "../models/CustomerConversation";
import { careerChatIdentity, CareerChatAccessError, withCareerChatLock } from "../services/careerChatAccess";
import { getOrCreateConversation, addConversationMessage, updateConversationMemory } from "../services/csMemoryService";
import { listConversations, getConversation, getConversationMessages, deleteConversation, renameConversation } from "../controllers/careerChatHistoryController";

const userA = "111111111111111111111111";
const userB = "222222222222222222222222";
const id = "333333333333333333333333";
const scope = <T>(action: () => T) => careerChatIdentity.run(userA, action);
const response = () => {
  const result = { statusCode: 200, body: undefined as any, status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; } };
  return result;
};
const request = (query = {}) => ({ params: { conversationId: id }, query }) as unknown as Request;
const unexpected = (error?: unknown) => { if (error) throw error; };

test("memory refuses calls without authenticated scope", async () => {
  await assert.rejects(getOrCreateConversation("session"), (error: any) => error.status === 401);
});
test("body/context identity cannot replace JWT identity", async () => {
  await assert.rejects(scope(() => getOrCreateConversation("session", { userId: userB })), (error: any) => error.status === 404);
});
test("foreign, orphaned and deleted sessions are never adopted", async t => {
  t.mock.method(CustomerConversation, "findOne", async (filter: any) => {
    assert.equal(String(filter.userId), userA); assert.equal(filter.deletedAt, null); return null;
  });
  t.mock.method(CustomerConversation, "exists", async () => ({ _id: new Types.ObjectId(id) }));
  const create = t.mock.method(CustomerConversation, "create", async () => { throw Error("Must not create or adopt"); });
  await assert.rejects(scope(() => getOrCreateConversation("existing")), (error: any) => error.status === 404);
  await assert.rejects(scope(() => addConversationMessage({ sessionId: "existing", sender: "customer", text: "hello" })), (error: any) => error.status === 404);
  await assert.rejects(scope(() => updateConversationMemory("existing", { targetRole: "Engineer" })), (error: any) => error.status === 404);
  assert.equal(create.mock.callCount(), 0);
});
test("new conversations use authenticated owner and fresh empty memory", async t => {
  t.mock.method(CustomerConversation, "findOne", async () => null);
  t.mock.method(CustomerConversation, "exists", async () => null);
  let payload: any;
  t.mock.method(CustomerConversation, "create", async (value: any) => { payload = value; return value; });
  await scope(() => getOrCreateConversation("new-session"));
  assert.equal(String(payload.userId), userA); assert.deepEqual(payload.messages, []);
  assert.deepEqual(payload.memory, { skillsFocus: [], metadata: {} });
});
test("existing history and recommendation metadata survive message and memory writes", async t => {
  const metadata = { careerSubject: "backend", recommendedTopics: ["SQL"], data: { jobMatching: { jobs: [] } } };
  const conversation = new CustomerConversation({ userId: userA, sessionId: "own", messages: [
    { sender: "assistant", text: "Learn SQL", metadata }
  ], memory: { metadata: { custom: true } } });
  t.mock.method(CustomerConversation, "findOne", async () => conversation);
  t.mock.method(conversation, "save", async () => conversation);
  await scope(() => addConversationMessage({ sessionId: "own", sender: "customer", text: "More suggestions" }));
  await scope(() => updateConversationMemory("own", { targetRole: "Backend Developer" }));
  assert.deepEqual(conversation.messages[0]!.metadata, metadata);
  assert.equal(conversation.messages.length, 2); assert.equal(conversation.title, "More suggestions");
  assert.equal(conversation.memory.targetRole, "Backend Developer");
  assert.equal(String(conversation.$where!.userId), userA); assert.equal(conversation.$where!.deletedAt, null);
});
test("history pagination filters owner and deletion before selecting messages", async t => {
  const pipelines: any[] = [];
  t.mock.method(CustomerConversation, "aggregate", async (pipeline: any) => {
    pipelines.push(pipeline);
    return pipeline[0].$match._id ? [{ start: 10, messages: [] }] : [];
  });
  const list = response(); await scope(() => listConversations(request({ limit: "20" }), list as unknown as Response, unexpected));
  const messages = response(); await scope(() => getConversationMessages(request({ before: "40", limit: "30" }), messages as unknown as Response, unexpected));
  for (const pipeline of pipelines) { assert.equal(String(pipeline[0].$match.userId), userA); assert.equal(pipeline[0].$match.deletedAt, null); }
  assert.equal(messages.body.data.nextBefore, "10");
  assert.ok(pipelines[1].some((stage: any) => stage.$project?.messages?.$cond));
});
test("unknown/foreign conversation reads return the same 404", async t => {
  t.mock.method(CustomerConversation, "aggregate", async () => []);
  for (const handler of [getConversation, getConversationMessages]) {
    const res = response(); await scope(() => handler(request(), res as unknown as Response, unexpected));
    assert.equal(res.statusCode, 404);
  }
});
test("invalid pagination is rejected", async () => {
  for (const query of [{ limit: "1000" }, { limit: "-1" }, { cursor: "invalid" }]) {
    const res = response(); await scope(() => listConversations(request(query), res as unknown as Response, unexpected));
    assert.equal(res.statusCode, 400);
  }
  const res = response(); await scope(() => getConversationMessages(request({ before: "-1" }), res as unknown as Response, unexpected));
  assert.equal(res.statusCode, 400);
});
test("delete checks owner, retains messages and bumps version", async t => {
  t.mock.method(CustomerConversation, "findOne", (filter: any) => {
    assert.equal(String(filter.userId), userA);
    return { select: () => ({ lean: async () => ({ sessionId: "own" }) }) };
  });
  t.mock.method(CustomerConversation, "updateOne", async (filter: any, update: any) => {
    assert.equal(String(filter.userId), userA); assert.equal(filter.deletedAt, null);
    assert.ok(update.$set.deletedAt instanceof Date); assert.equal(update.$inc.__v, 1);
    assert.equal(update.$unset, undefined); assert.equal(update.$set.messages, undefined);
    return { matchedCount: 1 };
  });
  const res = response(); await scope(() => deleteConversation(request(), res as unknown as Response, unexpected));
  assert.equal(res.statusCode, 200);
});
test("foreign deletion is refused", async t => {
  t.mock.method(CustomerConversation, "findOne", () => ({ select: () => ({ lean: async () => null }) }));
  const res = response(); await scope(() => deleteConversation(request(), res as unknown as Response, unexpected));
  assert.equal(res.statusCode, 404);
});
test("in-flight chat blocks deletion and duplicate sends, then releases lock", async () => {
  await withCareerChatLock("busy", async () => {
    await assert.rejects(withCareerChatLock("busy", async () => {}), (error: any) => error instanceof CareerChatAccessError && error.status === 409);
  });
  await withCareerChatLock("busy", async () => {});
});

test("actual Mongoose save carries owner, deletion and optimistic version guards", async t => {
  const conversation = CustomerConversation.hydrate({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userA),
    sessionId: "guarded", __v: 3, messages: [], memory: { skillsFocus: [], metadata: {} } });
  t.mock.method(CustomerConversation, "findOne", async () => conversation);
  let saved = false;
  t.mock.method(CustomerConversation.collection, "updateOne", async (filter: any, update: any) => {
    saved = true; assert.equal(String(filter.userId), userA); assert.equal(filter.deletedAt, null);
    assert.equal(filter.__v, 3); assert.equal(update.$inc.__v, 1);
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  await scope(() => addConversationMessage({ sessionId: "guarded", sender: "customer", text: "Save safely" }));
  assert.equal(saved, true);
});
test("a stale Mongoose save fails when soft-delete has changed the version", async t => {
  const conversation = CustomerConversation.hydrate({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userA),
    sessionId: "deleted-during-request", __v: 3, messages: [], memory: { skillsFocus: [], metadata: {} } });
  t.mock.method(CustomerConversation, "findOne", async () => conversation);
  t.mock.method(CustomerConversation.collection, "updateOne", async () => ({ acknowledged: true, matchedCount: 0, modifiedCount: 0 }));
  await assert.rejects(scope(() => addConversationMessage({ sessionId: "deleted-during-request", sender: "customer", text: "Must fail" })),
    (error: any) => error.name === "VersionError");
});

test("rename rejects blank, long, non-string and control-character titles", async () => {
  for (const title of ["", "   ", "x".repeat(101), null, ["bad"], "bad\ntitle", "bad\u0085title"]) {
    const req = request(); req.body = { title };
    const res = response(); await scope(() => renameConversation(req, res as unknown as Response, unexpected));
    assert.equal(res.statusCode, 400);
  }
});
test("rename preserves messages and metadata and updates only an owned active title", async t => {
  t.mock.method(CustomerConversation, "findOne", (filter: any) => {
    assert.equal(String(filter.userId), userA); assert.equal(filter.deletedAt, null);
    return { select: () => ({ lean: async () => ({ sessionId: "rename-own" }) }) };
  });
  t.mock.method(CustomerConversation, "updateOne", async (filter: any, update: any) => {
    assert.equal(String(filter.userId), userA); assert.equal(filter.deletedAt, null);
    assert.deepEqual(update.$set, { title: "Backend Developer Plan", titleManuallySet: true });
    assert.equal(update.$inc.__v, 1); assert.equal(update.$unset, undefined);
    return { matchedCount: 1 };
  });
  const req = request(); req.body = { title: "  Backend   Developer Plan  ", userId: userB };
  const res = response(); await scope(() => renameConversation(req, res as unknown as Response, unexpected));
  assert.equal(res.statusCode, 200); assert.equal(res.body.data.title, "Backend Developer Plan");
});
test("foreign or deleted conversation cannot be renamed", async t => {
  t.mock.method(CustomerConversation, "findOne", () => ({ select: () => ({ lean: async () => null }) }));
  const update = t.mock.method(CustomerConversation, "updateOne", async () => { throw Error("Must not mutate"); });
  const req = request(); req.body = { title: "No access" };
  const res = response(); await scope(() => renameConversation(req, res as unknown as Response, unexpected));
  assert.equal(res.statusCode, 404); assert.equal(update.mock.callCount(), 0);
});
test("rename cannot interfere with in-flight generation", async t => {
  t.mock.method(CustomerConversation, "findOne", () => ({ select: () => ({ lean: async () => ({ sessionId: "busy-rename" }) }) }));
  const req = request(); req.body = { title: "Wait" };
  const res = response();
  await withCareerChatLock("busy-rename", async () => {
    await scope(() => renameConversation(req, res as unknown as Response, unexpected));
  });
  assert.equal(res.statusCode, 409);
});
test("a manually chosen title is not replaced by the next user message", async t => {
  const conversation = new CustomerConversation({ userId: userA, sessionId: "manual-title", title: "New conversation", titleManuallySet: true, messages: [] });
  t.mock.method(CustomerConversation, "findOne", async () => conversation);
  t.mock.method(conversation, "save", async () => conversation);
  await scope(() => addConversationMessage({ sessionId: "manual-title", sender: "customer", text: "Replace title?" }));
  assert.equal(conversation.title, "New conversation");
});
