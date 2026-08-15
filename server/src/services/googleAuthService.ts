import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env";

export interface IGoogleUserPayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
}

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export const verifyGoogleCredential = async (
  credential: string
): Promise<IGoogleUserPayload> => {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload) {
    throw new Error("Invalid Google token payload");
  }

  const {
    sub,
    email,
    name,
    picture,
    email_verified,
  } = payload;

  if (!sub) {
    throw new Error(
      "Google ID (sub) is missing from token payload"
    );
  }

  if (!email) {
    throw new Error(
      "Email is missing from Google token payload"
    );
  }

  if (!email_verified) {
    throw new Error(
      "Google email address is not verified"
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  const normalizedPayload: IGoogleUserPayload = {
    sub,
    email: normalizedEmail,
    name:
      name?.trim() ||
      normalizedEmail.split("@")[0] ||
      "User",
    emailVerified: true,
  };

  if (picture) {
    normalizedPayload.picture = picture;
  }

  return normalizedPayload;
};