import { beginSessionChange, publishSessionChange } from "../query/authScope";

const clearCareerChatSelection = (): void => {
  for (let index = sessionStorage.length - 1; index >= 0; index--) {
    const key = sessionStorage.key(index);
    if (key && (key.startsWith("interviewiq-career-active:") || key === "interviewiq-career-assistant-session")) sessionStorage.removeItem(key);
  }

};

export interface StoredUser {
  id?: string;
  _id?: string;
  fullName: string;
  email: string;
  role: string;
  avatar?: string;
  authProvider?: "local" | "google";
}

export const saveAuthSession = (
  token: string,
  user: StoredUser
): void => {
  beginSessionChange();
  clearCareerChatSelection();
  sessionStorage.removeItem("interviewiq.jobsPage.cache.v1");
  localStorage.setItem(
    "interviewiq_token",
    token
  );

  localStorage.setItem(
    "interviewiq_user",
    JSON.stringify(user)
  );
  publishSessionChange();
};

export const clearAuthSession = (): void => {
  beginSessionChange();
  clearCareerChatSelection();
  sessionStorage.removeItem("interviewiq.jobsPage.cache.v1");
  localStorage.removeItem(
    "interviewiq_token"
  );

  localStorage.removeItem(
    "interviewiq_user"
  );
  publishSessionChange();
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem(
    "interviewiq_token"
  );
};

export const getStoredUser = (): StoredUser | null => {
  const storedUser = localStorage.getItem(
    "interviewiq_user"
  );

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(
      storedUser
    ) as StoredUser;
  } catch {
    return null;
  }
};

export const isAuthenticated = (): boolean => {
  return Boolean(getAuthToken());
};