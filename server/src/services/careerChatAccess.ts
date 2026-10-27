import { AsyncLocalStorage } from "node:async_hooks";

// Authentication scope propagates through all asynchronous memory operations.
export const careerChatIdentity = new AsyncLocalStorage<string>();
export class CareerChatAccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const requireCareerChatUser = (): string => {
  const userId = careerChatIdentity.getStore();
  if (!userId) throw new CareerChatAccessError(401, "Authentication required.");
  return userId;
};
const activeSessions = new Set<string>();
export const withCareerChatLock = async <T>(sessionId: string, action: () => Promise<T>): Promise<T> => {
  if (activeSessions.has(sessionId)) throw new CareerChatAccessError(409, "A message is still being processed. Please try again shortly.");
  activeSessions.add(sessionId);
  try { return await action(); } finally { activeSessions.delete(sessionId); }
};
