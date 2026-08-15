import dotenv from "dotenv";

dotenv.config();

type NodeEnvironment =
  | "development"
  | "test"
  | "production";

interface EnvConfig {
  PORT: number;
  NODE_ENV: NodeEnvironment;
  MONGO_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  GEMINI_API_KEY?: string;
  CLIENT_URL: string;
  GOOGLE_CLIENT_ID: string;

  EMAILJS_SERVICE_ID: string;
  EMAILJS_TEMPLATE_ID: string;
  EMAILJS_RESET_TEMPLATE_ID: string;
  EMAILJS_PUBLIC_KEY: string;
  EMAILJS_PRIVATE_KEY?: string;
}

function getRequiredEnv(
  name: string
): string {
  const value = process.env[name];

  if (
    !value ||
    value.trim() === ""
  ) {
    throw new Error(
      `CRITICAL ERROR: Environment variable "${name}" is missing or empty in .env file.`
    );
  }

  return value.trim();
}

function parsePort(
  value: string | undefined
): number {
  if (
    !value ||
    value.trim() === ""
  ) {
    return 5000;
  }

  const parsedPort =
    Number(value);

  if (
    Number.isNaN(parsedPort) ||
    !Number.isInteger(parsedPort) ||
    parsedPort <= 0 ||
    parsedPort > 65535
  ) {
    throw new Error(
      `CRITICAL ERROR: Invalid PORT value "${value}". PORT must be an integer between 1 and 65535.`
    );
  }

  return parsedPort;
}

function parseNodeEnvironment(
  value: string | undefined
): NodeEnvironment {
  const nodeEnv =
    value?.trim() ||
    "development";

  const allowedEnvironments: NodeEnvironment[] =
    [
      "development",
      "test",
      "production",
    ];

  if (
    !allowedEnvironments.includes(
      nodeEnv as NodeEnvironment
    )
  ) {
    throw new Error(
      `CRITICAL ERROR: Invalid NODE_ENV value "${nodeEnv}".`
    );
  }

  return nodeEnv as NodeEnvironment;
}

export const env: EnvConfig = {
  PORT: parsePort(
    process.env.PORT
  ),

  NODE_ENV:
    parseNodeEnvironment(
      process.env.NODE_ENV
    ),

  MONGO_URI:
    getRequiredEnv(
      "MONGO_URI"
    ),

  JWT_SECRET:
    getRequiredEnv(
      "JWT_SECRET"
    ),

  JWT_EXPIRES_IN:
    process.env.JWT_EXPIRES_IN?.trim() ||
    "7d",

  GEMINI_API_KEY:
    process.env.GEMINI_API_KEY?.trim() ||
    undefined,

  CLIENT_URL:
    process.env.CLIENT_URL?.trim() ||
    "http://localhost:5173",

  GOOGLE_CLIENT_ID:
    getRequiredEnv(
      "GOOGLE_CLIENT_ID"
    ),

  EMAILJS_SERVICE_ID:
    getRequiredEnv(
      "EMAILJS_SERVICE_ID"
    ),

  EMAILJS_TEMPLATE_ID:
    getRequiredEnv(
      "EMAILJS_TEMPLATE_ID"
    ),

  EMAILJS_RESET_TEMPLATE_ID:
    getRequiredEnv(
      "EMAILJS_RESET_TEMPLATE_ID"
    ),

  EMAILJS_PUBLIC_KEY:
    getRequiredEnv(
      "EMAILJS_PUBLIC_KEY"
    ),

  EMAILJS_PRIVATE_KEY:
    process.env.EMAILJS_PRIVATE_KEY?.trim() ||
    undefined,
};