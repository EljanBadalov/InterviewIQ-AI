import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { env } from "../config/env";
import { User } from "../models/User";
import { protect } from "../middleware/authMiddleware";
import csRoutes from "../routes/csRoutes";
import { careerChatIdentity } from "../services/careerChatAccess";
import { sendCustomerMessage } from "../controllers/csController";
import CustomerConversation from "../models/CustomerConversation";
const userA = "111111111111111111111111";
const userB = "222222222222222222222222";
const response = () => ({ code: 200, body: undefined as any, status(code: number) { this.code = code; return this; }, json(body: unknown) { this.body = body; return this; } });
test("missing and invalid JWT are rejected", async () => {
  for (const authorization of [undefined, "Bearer invalid"]) {
    const res = response(); let next = false;
    await protect({ headers: { authorization } } as Request, res as unknown as Response, () => { next = true; });
    assert.equal(res.code, 401); assert.equal(next, false);
  }
});
test("valid JWT resolves identity through existing authentication", async t => {
  t.mock.method(User, "findById", async (id: string) => { assert.equal(id, userA); return { _id: userA }; });
  const req = { headers: { authorization: `Bearer ${jwt.sign({ id: userA }, env.JWT_SECRET)}` } } as Request;
  const res = response(); let next = false;
  await protect(req, res as unknown as Response, () => { next = true; });
  assert.equal(next, true); assert.equal(String(req.user!._id), userA);
});
test("all CS routes run after namespace authentication and identity scope", () => {
  const stack = csRoutes.stack;
  assert.equal(stack[0].handle, protect);
  assert.ok(stack.slice(2).every((layer: any) => !!layer.route));
  assert.equal(stack.filter((layer: any) => layer.route).length, 9);
});
test("controller ignores forged body userId and refuses foreign session before inference", async t => {
  let queried = false;
  t.mock.method(CustomerConversation, "findOne", async (filter: any) => {
    queried = true; assert.equal(String(filter.userId), userA); return null;
  });
  t.mock.method(CustomerConversation, "exists", async () => ({ _id: userB }));
  const req = { user: { _id: userA }, body: { userId: userB, sessionId: "foreign", message: "hello" } } as unknown as Request;
  const res = response();
  await careerChatIdentity.run(userA, () => sendCustomerMessage(req, res as unknown as Response));
  assert.equal(queried, true); assert.equal(res.code, 404);
});
