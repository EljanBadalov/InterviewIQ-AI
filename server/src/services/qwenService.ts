/* =========================================================
   QWEN SERVICE

   Centralized Qwen integration for InterviewIQ.
   Connects Node.js Backend directly to the self-hosted
   Python FastAPI Qwen inference service.

   Supports:
   - text generation
   - JSON generation
   - retry & exponential backoff
   - timeout handling
   - configurable model & service URL
   - robust JSON cleanup and safe parsing
   - zero external API key requirement
========================================================= */

/* =========================================================
   TYPES
========================================================= */

export type QwenMessageRole =
  | "system"
  | "user"
  | "assistant";

export interface IQwenMessage {
  role: QwenMessageRole;
  content: string;
}

export interface IQwenGenerationOptions {
  model?: string;
  temperature?: number;
  topP?: number;
  maxCompletionTokens?: number;
  timeoutMs?: number;
  retries?: number;
  enableThinking?: boolean;
}

export interface IQwenTextGenerationInput
  extends IQwenGenerationOptions {
  messages: IQwenMessage[];
}

/*
 * Chat-specific text generation input.
 *
 * This keeps Career Assistant / conversational generation separate
 * from structured JSON extraction. It intentionally returns plain text
 * so small local models do not need to spend time producing/parsing JSON.
 */
export interface IQwenChatGenerationInput
  extends IQwenGenerationOptions {
  messages: IQwenMessage[];
}

export interface IQwenJSONGenerationInput
  extends IQwenGenerationOptions {
  messages: IQwenMessage[];
}

export interface IQwenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface IQwenTextResult {
  success: boolean;
  text?: string;
  model?: string;
  usage?: IQwenUsage;
  finishReason?: string;
  error?: string;
}

export interface IQwenJSONResult<T> {
  success: boolean;
  data?: T;
  rawText?: string;
  model?: string;
  usage?: IQwenUsage;
  finishReason?: string;
  error?: string;
}

/* =========================================================
   INTERNAL RESPONSE TYPES
========================================================= */

interface IFastAPIGenerateResponse {
  response?: string;
  model?: string;
  tokens_generated?: number;
  finish_reason?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  detail?: string | Record<string, unknown>;
}

/* =========================================================
   ENVIRONMENT & CONFIGURATION
========================================================= */

const getQwenServiceBaseUrl = (): string => {
  const configured =
    process.env.QWEN_SERVICE_URL?.trim() ||
    process.env.QWEN_BASE_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  // Local development default for Python FastAPI service
  return "http://localhost:8000";
};

const getDefaultQwenModel = (): string => {
  return (
    process.env.QWEN_MODEL?.trim() ||
    "Qwen/Qwen3-4B-GGUF:Q4_K_M"
  );
};

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_RETRIES = 1;
const DEFAULT_TEMPERATURE = 0.6;
const DEFAULT_TOP_P = 0.95;
const DEFAULT_MAX_COMPLETION_TOKENS = 1024;

/*
 * Conversational defaults for the local Qwen 4B CPU model.
 *
 * These values are intentionally separate from the generic defaults above.
 * Resume/JSON extraction can continue using its own explicit configuration,
 * while Career Assistant gets a longer timeout and a smaller completion
 * budget for faster, more reliable natural-language replies.
 */
const CHAT_DEFAULT_TIMEOUT_MS = 300_000;
const CHAT_DEFAULT_RETRIES = 0;
const CHAT_DEFAULT_TEMPERATURE = 0.5;
const CHAT_DEFAULT_TOP_P = 0.9;
const CHAT_DEFAULT_MAX_COMPLETION_TOKENS = 800;

/* =========================================================
   HELPERS
========================================================= */

const sleep = async (milliseconds: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

const normalizeText = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  return normalized || undefined;
};

const isQwenDebugEnabled = (): boolean => {
  const value =
    process.env.QWEN_DEBUG
      ?.trim()
      .toLowerCase();

  return (
    value === "1" ||
    value === "true" ||
    value === "yes"
  );
};

const buildResponsePreview = (
  value: unknown,
  maxLength = 300
): string | undefined => {
  if (
    !isQwenDebugEnabled() ||
    typeof value !== "string"
  ) {
    return undefined;
  }

  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
};

const normalizeMessages = (messages: IQwenMessage[]): IQwenMessage[] => {
  return messages
    .map((message) => ({
      role: message.role,
      content: message.content.replace(/\r\n/g, "\n").trim(),
    }))
    .filter((message) => Boolean(message.content));
};

const buildUsage = (
  response: IFastAPIGenerateResponse
): IQwenUsage | undefined => {
  if (response.usage) {
    return {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    };
  }

  if (typeof response.tokens_generated === "number") {
    return {
      completionTokens: response.tokens_generated,
    };
  }

  return undefined;
};

/* =========================================================
   JSON CLEANUP
========================================================= */

const cleanJSONText = (value: string): string => {
  let text = value.trim();

  if (text.startsWith("```json")) {
    text = text.slice(7);
  } else if (text.startsWith("```")) {
    text = text.slice(3);
  }

  if (text.endsWith("```")) {
    text = text.slice(0, -3);
  }

  return text.trim();
};

const parseJSONSafely = <T>(value: string): T | undefined => {
  const cleaned = cleanJSONText(value);

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return undefined;
  }
};

/* =========================================================
   RETRY RULES
========================================================= */

const isRetryableStatus = (status: number): boolean => {
  return (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
};

const getRetryDelay = (attempt: number): number => {
  const base = 800;
  return base * Math.pow(2, attempt);
};

/* =========================================================
   PROMPT EXTRACTION
========================================================= */

const extractSystemAndUserMessage = (
  messages: IQwenMessage[]
): { system?: string; user: string } => {
  let systemContent = "";
  const userContents: string[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      systemContent = systemContent
        ? `${systemContent}\n${message.content}`
        : message.content;
    } else if (message.role === "user") {
      userContents.push(message.content);
    } else if (message.role === "assistant") {
      userContents.push(`[Previous Assistant Response]: ${message.content}`);
    }
  }

  return {
    system: systemContent.trim() || undefined,
    user: userContents.join("\n\n").trim(),
  };
};

/* =========================================================
   CORE REQUEST (FASTAPI BRIDGE)
========================================================= */

const callFastAPIQwen = async (
  messages: IQwenMessage[],
  options: IQwenGenerationOptions
): Promise<IFastAPIGenerateResponse> => {
  const normalizedMessages =
    normalizeMessages(messages);

  if (normalizedMessages.length === 0) {
    throw new Error(
      "Qwen request requires at least one non-empty message"
    );
  }

  const baseUrl =
    getQwenServiceBaseUrl();

  const endpoint =
    `${baseUrl}/generate`;

  const timeoutMs =
    options.timeoutMs ??
    DEFAULT_TIMEOUT_MS;

  const retries =
    Math.max(
      0,
      options.retries ??
        DEFAULT_RETRIES
    );

  const { system, user } =
    extractSystemAndUserMessage(
      normalizedMessages
    );

  const payload = {
    message:
      user,

    system,

    max_tokens:
      options.maxCompletionTokens ??
      DEFAULT_MAX_COMPLETION_TOKENS,

    temperature:
      options.temperature ??
      DEFAULT_TEMPERATURE,

    top_p:
      options.topP ??
      DEFAULT_TOP_P,
  };

  let lastError:
    Error | undefined;

  for (
    let attempt = 0;
    attempt <= retries;
    attempt += 1
  ) {
    const controller =
      new AbortController();

    const requestStartedAt =
      Date.now();

    const timeout =
      setTimeout(
        () => {
          controller.abort();
        },
        timeoutMs
      );

    try {
      console.log(
        `[Qwen Service] POST /generate attempt ${attempt + 1}/${retries + 1} | timeout=${timeoutMs}ms | maxTokens=${payload.max_tokens}`
      );

      const response =
        await fetch(
          endpoint,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload
              ),

            signal:
              controller.signal,
          }
        );

      const rawText =
        await response.text();

      let parsed:
        IFastAPIGenerateResponse;

      try {
        parsed =
          rawText
            ? JSON.parse(
                rawText
              )
            : {};
      } catch {
        throw new Error(
          `Qwen Service returned invalid HTTP JSON. Status: ${response.status}; bodyLength=${rawText.length}`
        );
      }

      const elapsedMs =
        Date.now() -
        requestStartedAt;

      console.log(
        `[Qwen Service] HTTP ${response.status} in ${elapsedMs}ms | responseType=${typeof parsed.response} | responseLength=${
          typeof parsed.response === "string"
            ? parsed.response.length
            : 0
        } | finishReason=${parsed.finish_reason ?? "unknown"}`
      );

      const preview =
        buildResponsePreview(
          parsed.response
        );

      if (preview) {
        console.log(
          `[Qwen Service][DEBUG] Response preview: ${preview}`
        );
      }

      if (response.ok) {
        if (
          typeof parsed.response !==
            "string" ||
          !parsed.response.trim()
        ) {
          throw new Error(
            `Qwen Service returned HTTP ${response.status} but the response field was empty or invalid`
          );
        }

        return parsed;
      }

      const errorMessage =
        typeof parsed.detail ===
          "string"
          ? parsed.detail
          : parsed.detail
          ? JSON.stringify(
              parsed.detail
            )
          : `Qwen Service request failed with status ${response.status}`;

      lastError =
        new Error(
          errorMessage
        );

      if (
        attempt < retries &&
        isRetryableStatus(
          response.status
        )
      ) {
        await sleep(
          getRetryDelay(
            attempt
          )
        );

        continue;
      }

      throw lastError;
    } catch (error) {
      if (
        error instanceof Error &&
        error.name ===
          "AbortError"
      ) {
        lastError =
          new Error(
            `Qwen Service timed out after ${timeoutMs}ms`
          );
      } else {
        lastError =
          error instanceof Error
            ? error
            : new Error(
                "Unknown Qwen Service request error"
              );
      }

      console.warn(
        `[Qwen Service] Request attempt ${attempt + 1} failed: ${lastError.message}`
      );

      if (attempt < retries) {
        await sleep(
          getRetryDelay(
            attempt
          )
        );

        continue;
      }
    } finally {
      clearTimeout(
        timeout
      );
    }
  }

  throw (
    lastError ??
    new Error(
      "Qwen Service request failed"
    )
  );
};

/* =========================================================
   TEXT GENERATION
========================================================= */

export const generateQwenText = async (
  input: IQwenTextGenerationInput
): Promise<IQwenTextResult> => {
  try {
    const response = await callFastAPIQwen(input.messages, input);
    const text = normalizeText(response.response);

    if (!text) {
      return {
        success: false,
        model: response.model || getDefaultQwenModel(),
        usage: buildUsage(response),
        finishReason: response.finish_reason,
        error: "Qwen returned an empty text response",
      };
    }

    return {
      success: true,
      text,
      model: response.model || getDefaultQwenModel(),
      usage: buildUsage(response),
      finishReason: response.finish_reason,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown Qwen text generation error",
    };
  }
};

/* =========================================================
   CHAT / CAREER ASSISTANT TEXT GENERATION
========================================================= */

/*
 * Use this helper for normal chatbot answers.
 *
 * Important:
 * - returns plain text, NOT JSON
 * - allows up to 4 minutes for slow CPU inference
 * - limits output size so local generation does not run unnecessarily long
 * - does not retry by default, preventing duplicate long-running requests
 *
 * Callers can still override any option explicitly.
 */
export const generateQwenChatText = async (
  input: IQwenChatGenerationInput
): Promise<IQwenTextResult> => {
  const startedAt =
    Date.now();

  console.log(
    "[Qwen Service] Starting conversational text generation..."
  );

  const result =
    await generateQwenText({
      ...input,

      temperature:
        input.temperature ??
        CHAT_DEFAULT_TEMPERATURE,

      topP:
        input.topP ??
        CHAT_DEFAULT_TOP_P,

      maxCompletionTokens:
        input.maxCompletionTokens ??
        CHAT_DEFAULT_MAX_COMPLETION_TOKENS,

      timeoutMs:
        input.timeoutMs ??
        CHAT_DEFAULT_TIMEOUT_MS,

      retries:
        input.retries ??
        CHAT_DEFAULT_RETRIES,
    });

  const elapsedSeconds =
    (
      Date.now() -
      startedAt
    ) / 1000;

  console.log(
    "[Qwen Service][CHAT RESULT]",
    JSON.stringify(
      {
        success:
          result.success,

        hasText:
          Boolean(
            result.text
          ),

        textLength:
          result.text
            ?.length ??
          0,

        model:
          result.model,

        finishReason:
          result.finishReason,

        usage:
          result.usage,

        error:
          result.error,
      },
      null,
      2
    )
  );

  if (result.success) {
    console.log(
      `[Qwen Service] Conversational response completed in ${elapsedSeconds.toFixed(
        2
      )}s`
    );
  } else {
    console.warn(
      `[Qwen Service] Conversational response failed after ${elapsedSeconds.toFixed(
        2
      )}s: ${
        result.error ||
        "Unknown error"
      }`
    );
  }

  return result;
};

/* =========================================================
   JSON GENERATION
========================================================= */

export const generateQwenJSON = async <T>(
  input: IQwenJSONGenerationInput
): Promise<IQwenJSONResult<T>> => {
  try {
    const messages: IQwenMessage[] = [
      {
        role: "system",
        content:
          "You are an AI data extractor. Respond ONLY with valid, raw JSON syntax conforming to the required schema. Never wrap the JSON inside markdown fences (```json or ```). Do not include conversational remarks.",
      },
      ...input.messages,
    ];

    const response = await callFastAPIQwen(messages, input);
    const rawText = normalizeText(response.response);

    if (!rawText) {
      return {
        success: false,
        model: response.model || getDefaultQwenModel(),
        usage: buildUsage(response),
        finishReason: response.finish_reason,
        error: "Qwen returned an empty JSON response",
      };
    }

    const parsed = parseJSONSafely<T>(rawText);

    if (!parsed) {
      return {
        success: false,
        rawText,
        model: response.model || getDefaultQwenModel(),
        usage: buildUsage(response),
        finishReason: response.finish_reason,
        error: "Qwen returned invalid JSON format",
      };
    }

    return {
      success: true,
      data: parsed,
      rawText,
      model: response.model || getDefaultQwenModel(),
      usage: buildUsage(response),
      finishReason: response.finish_reason,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown Qwen JSON generation error",
    };
  }
};

/* =========================================================
   SIMPLE PROMPT HELPER
========================================================= */

export const generateQwenFromPrompt = async (options: {
  systemPrompt?: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxCompletionTokens?: number;
  timeoutMs?: number;
  retries?: number;
  enableThinking?: boolean;
}): Promise<IQwenTextResult> => {
  const messages: IQwenMessage[] = [];

  if (options.systemPrompt) {
    messages.push({
      role: "system",
      content: options.systemPrompt,
    });
  }

  messages.push({
    role: "user",
    content: options.userPrompt,
  });

  return generateQwenText({
    messages,
    model: options.model,
    temperature: options.temperature,
    maxCompletionTokens: options.maxCompletionTokens,
    timeoutMs: options.timeoutMs,
    retries: options.retries,
    enableThinking: options.enableThinking,
  });
};

/* =========================================================
   HEALTH CHECK
========================================================= */

export const testQwenConnection = async (): Promise<{
  success: boolean;
  model?: string;
  reply?: string;
  error?: string;
}> => {
  const baseUrl = getQwenServiceBaseUrl();

  try {
    const healthCheck = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!healthCheck.ok) {
      return {
        success: false,
        error: `Qwen health check failed with status: ${healthCheck.status}`,
      };
    }

    const healthData = (await healthCheck.json()) as {
      status?: string;
      model?: string;
      llamaCpp?: boolean;
    };

    const result = await generateQwenText({
      messages: [
        {
          role: "user",
          content: "Reply with exactly: QWEN_OK",
        },
      ],
      temperature: 0.1,
      maxCompletionTokens: 30,
      retries: 0,
      timeoutMs: 25_000,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    const isOk = (result.text || "").toUpperCase().includes("QWEN_OK");

    return {
      success: isOk,
      model: healthData.model || result.model,
      reply: result.text,
      error: isOk ? undefined : `Unexpected reply: ${result.text}`,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not reach Qwen FastAPI service",
    };
  }
};

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  generateQwenText,
  generateQwenChatText,
  generateQwenJSON,
  generateQwenFromPrompt,
  testQwenConnection,
};