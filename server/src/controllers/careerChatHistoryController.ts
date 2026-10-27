import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import CustomerConversation from "../models/CustomerConversation";
import { getOrCreateConversation } from "../services/csMemoryService";
import { CareerChatAccessError, requireCareerChatUser, withCareerChatLock } from "../services/careerChatAccess";

const owner = () => new Types.ObjectId(requireCareerChatUser());
const notFound = () => new CareerChatAccessError(404, "Conversation not found.");
const limitOf = (value: unknown, fallback: number) => {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || Number(value) > 100) {
    throw new CareerChatAccessError(400, "Limit must be between 1 and 100.");
  }
  return Number(value);
};
const ownedFilter = (req: Request) => {
  const id = req.params.conversationId;
  if (typeof id !== "string" || !/^[a-f0-9]{24}$/i.test(id)) throw notFound();
  return { _id: new Types.ObjectId(id), userId: owner(), deletedAt: null };
};
const summaryProjection = {
  _id: 0, conversationId: { $toString: "$_id" }, sessionId: 1, userId: { $toString: "$userId" },
  title: { $ifNull: ["$title", { $ifNull: [{ $arrayElemAt: [{ $map: {
    input: { $filter: { input: "$messages", as: "message", cond: { $eq: ["$$message.sender", "customer"] } } },
    as: "message", in: { $substrCP: ["$$message.text", 0, 100] }
  } }, 0] }, "New conversation"] }] }, createdAt: 1, updatedAt: 1, lastMessageAt: 1
};
const endpoint = (action: (req: Request, res: Response) => Promise<void>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try { await action(req, res); } catch (error) {
      if (error instanceof CareerChatAccessError) res.status(error.status).json({ success: false, message: error.message });
      else next(error);
    }
  };
export const createConversation = endpoint(async (_req, res) => {
  const conversation = await getOrCreateConversation(`career-${randomUUID()}`, { userId: requireCareerChatUser() });
  res.status(201).json({ success: true, data: { conversationId: String(conversation._id), sessionId: conversation.sessionId,
    userId: String(conversation.userId), title: "New conversation", createdAt: conversation.createdAt, updatedAt: conversation.updatedAt } });
});
export const listConversations = endpoint(async (req, res) => {
  const limit = limitOf(req.query.limit, 20);
  const cursor = req.query.cursor;
  if (cursor !== undefined && (typeof cursor !== "string" || !/^[a-f0-9]{24}$/i.test(cursor))) {
    throw new CareerChatAccessError(400, "Invalid cursor.");
  }
  const data = await CustomerConversation.aggregate([
    { $match: { userId: owner(), deletedAt: null, ...(cursor ? { _id: { $lt: new Types.ObjectId(String(cursor)) } } : {}) } },
    { $sort: { _id: -1 } }, { $limit: limit + 1 }, { $project: summaryProjection }
  ]);
  const hasMore = data.length > limit;
  const conversations = data.slice(0, limit);
  res.json({ success: true, data: { conversations, nextCursor: hasMore ? conversations.at(-1).conversationId : null } });
});
export const getConversation = endpoint(async (req, res) => {
  const [conversation] = await CustomerConversation.aggregate([{ $match: ownedFilter(req) }, { $project: summaryProjection }]);
  if (!conversation) throw notFound();
  res.json({ success: true, data: conversation });
});
export const getConversationMessages = endpoint(async (req, res) => {
  const limit = limitOf(req.query.limit, 30);
  const before = req.query.before;
  if (before !== undefined && (typeof before !== "string" || !/^\d+$/.test(before) || !Number.isSafeInteger(Number(before)))) {
    throw new CareerChatAccessError(400, "Invalid message cursor.");
  }
  // Slice in MongoDB so opening a conversation does not transfer its entire history.
  const [page] = await CustomerConversation.aggregate([
    { $match: ownedFilter(req) },
    { $project: { messages: 1, end: before === undefined ? { $size: "$messages" } : { $min: [Number(before), { $size: "$messages" }] } } },
    { $project: { end: 1, start: { $max: [0, { $subtract: ["$end", limit] }] }, messages: 1 } },
    { $project: { start: 1, messages: { $cond: [{ $gt: ["$end", "$start"] }, { $slice: ["$messages", "$start", { $subtract: ["$end", "$start"] }] }, []] } } }
  ]);
  if (!page) throw notFound();
  res.json({ success: true, data: { messages: page.messages, nextBefore: page.start > 0 ? String(page.start) : null } });
});
export const deleteConversation = endpoint(async (req, res) => {
  const filter = ownedFilter(req);
  const conversation = await CustomerConversation.findOne(filter).select("sessionId").lean();
  if (!conversation) throw notFound();
  await withCareerChatLock(conversation.sessionId, async () => {
    // Bump the version so any already-read document cannot save over a deletion.
    const result = await CustomerConversation.updateOne(filter, { $set: { deletedAt: new Date() }, $inc: { __v: 1 } });
    if (!result.matchedCount) throw notFound();
  });
  res.json({ success: true, message: "Conversation deleted." });
});

export const renameConversation = endpoint(async (req, res) => {
  const rawTitle: unknown = req.body?.title;
  if (typeof rawTitle !== "string" || /\p{Cc}/u.test(rawTitle)) {
    throw new CareerChatAccessError(400, "Enter a valid conversation title.");
  }
  const title = rawTitle.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (!title || title.length > 100) {
    throw new CareerChatAccessError(400, "Title must contain between 1 and 100 characters.");
  }
  const filter = ownedFilter(req);
  const conversation = await CustomerConversation.findOne(filter).select("sessionId").lean();
  if (!conversation) throw notFound();
  await withCareerChatLock(conversation.sessionId, async () => {
    const result = await CustomerConversation.updateOne(filter, {
      $set: { title, titleManuallySet: true }, $inc: { __v: 1 }
    });
    if (!result.matchedCount) throw notFound();
  });
  res.json({ success: true, data: { conversationId: String(filter._id), title } });
});
