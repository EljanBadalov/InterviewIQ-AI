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
  localStorage.setItem(
    "interviewiq_token",
    token
  );

  localStorage.setItem(
    "interviewiq_user",
    JSON.stringify(user)
  );
};

export const clearAuthSession = (): void => {
  localStorage.removeItem(
    "interviewiq_token"
  );

  localStorage.removeItem(
    "interviewiq_user"
  );
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