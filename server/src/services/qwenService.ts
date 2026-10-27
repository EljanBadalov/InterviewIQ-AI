import { careerChatCorrelationId, startChatQwenAttempt } from './careerChatMetrics';
import { aiProxyRequestOptions } from '../config/aiProxyTransport';
import { interviewAttempt, interviewUsage, interviewCorrelationId, timeInterviewValidation, guardInterviewInference, recordInterviewProxyDiagnostics } from './interviewEvaluationMetrics';
import { countGenerationMetric, generationCorrelationId, recordGenerationDuration, timeGenerationStage } from './roadmapGenerationMetrics';
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
  signal?: AbortSignal;
  deadlineAtMs?: number;
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

export function normalizeQwenFinishReason(value:unknown):string {
  return typeof value==='string' && ['stop','length','content_filter','error'].includes(value)?value:'unknown';
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
  failureKind?: 'missing_json' | 'invalid_json' | 'transport' | 'unavailable' | 'timeout';
  data?: T;
  rawText?: string;
  model?: string;
  usage?: IQwenUsage;
  finishReason?: string;
  error?: string;
}

// Preserve protocol failure type across the transport boundary without private error text.
class QwenResponseError extends Error {
  constructor(readonly failureKind: 'missing_json' | 'invalid_json' | 'transport' | 'unavailable' | 'timeout') {
    super('Qwen transport request failed');
  }
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
  timings_ms?: {queue_wait?:number;inference_roundtrip?:number;readiness?:number};
  diagnostics?: {stage?:unknown;inferenceDispatched?:unknown};
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
const CHAT_DEFAULT_RETRIES = 2;
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
  const transportOptions = aiProxyRequestOptions(baseUrl);

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
    if(options.signal?.aborted)throw new Error('Qwen request cancelled before dispatch');
    const remaining=options.deadlineAtMs===undefined?timeoutMs:Math.min(timeoutMs,options.deadlineAtMs-Date.now());
    if(!Number.isFinite(remaining)||remaining<=0)throw new Error('Qwen request deadline expired before dispatch');
    const budget=Math.min(300_000,Math.max(1,Math.floor(remaining)));
    const outbound={...payload,request_budget_ms:budget,deadline_unix_ms:Date.now()+budget,correlation_id:generationCorrelationId() || careerChatCorrelationId() || interviewCorrelationId()};
    const wireBody=JSON.stringify(outbound);
    const promptBytes=Buffer.byteLength(JSON.stringify({message:payload.message,system:payload.system}));
    countGenerationMetric('finalPayloadBytes',Buffer.byteLength(wireBody));
    countGenerationMetric('finalPromptBytes',promptBytes);
    countGenerationMetric('finalPromptTokensEstimate',Math.ceil(promptBytes/4));
    const controller = new AbortController();

    const requestStartedAt =
      Date.now();

    const timeout =
      setTimeout(
        () => {
          controller.abort();
        },
        budget
      );

    try {
      console.log(
        `[Qwen Service] POST /generate attempt ${attempt + 1}/${retries + 1} | timeout=${budget}ms | maxTokens=${payload.max_tokens}`
      );

      if (
        process.env.QWEN_DEBUG === "true"
      ) {
        console.log(
          "[Qwen Service][CALLER TRACE]"
        );

        console.trace();
      }

      await guardInterviewInference();
      const finishChatAttempt = startChatQwenAttempt();
      const finishInterviewAttempt = interviewAttempt();
      let response: Response;
      let rawText: string;
      try { response =
        await fetch(
          endpoint,
          {
            method:
              "POST",

            ...transportOptions,

            body:
              wireBody,

            signal:
              options.signal ? AbortSignal.any([controller.signal,options.signal]) : controller.signal,
          }
        );
        rawText = await response.text();
      } catch(error) { finishInterviewAttempt(true); throw error; }
      finally { finishChatAttempt(); finishInterviewAttempt(); }

      let parsed:
        IFastAPIGenerateResponse =
        {};

      if (
        rawText
      ) {
        try {
          parsed =
            JSON.parse(
              rawText
            ) as IFastAPIGenerateResponse;
        } catch {
          if (response.status >= 500) finishInterviewAttempt(true);
          console.warn(`[Qwen Service] Non-JSON HTTP response | status=${response.status} | bytes=${rawText.length}`);
          if (
            !response.ok
          ) {
            lastError =
              new Error(
                `Qwen Service returned HTTP ${response.status}: ${rawText.length} response bytes`
              );

            if (
              attempt < retries &&
              isRetryableStatus(
                response.status
              )
            ) {
              const delay =
                getRetryDelay(
                  attempt
                );

              console.warn(
                `[Qwen Service] Retryable HTTP ${response.status}. Retrying in ${delay}ms...`
              );

              await sleep(
                delay
              );

              continue;
            }

            throw lastError;
          }

          throw new QwenResponseError('invalid_json');
        }
      }

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        if (response.status >= 500) finishInterviewAttempt(true);
        throw new QwenResponseError('invalid_json');
      }
      const proxyDetail = typeof parsed.detail === 'object' && parsed.detail !== null ? parsed.detail : undefined;
      const dispatched = recordInterviewProxyDiagnostics(response.ok ? parsed.diagnostics : proxyDetail);
      if (response.status === 504 && dispatched !== false) finishInterviewAttempt(true);
      if (!response.ok && response.status >= 500 && dispatched === undefined) finishInterviewAttempt(true);
      const proxyCode = proxyDetail?.code;
      // Only recognize the proxy's bounded diagnostic vocabulary, never its arbitrary error text.
      if (!response.ok && dispatched !== undefined) {
        if (proxyCode === 'QWEN_MODEL_UNAVAILABLE' && dispatched === false)
          throw new QwenResponseError('unavailable');
        if (proxyCode === 'QWEN_TIMEOUT' || proxyCode === 'GENERATION_EXPIRED')
          throw new QwenResponseError('timeout');
        if (proxyCode === 'QWEN_RESPONSE_INVALID_JSON') throw new QwenResponseError('invalid_json');
        if (proxyCode === 'QWEN_RESPONSE_EMPTY') throw new QwenResponseError('missing_json');
        if (proxyCode === 'QWEN_TRANSPORT_FAILED' && dispatched) finishInterviewAttempt(true);
        if (proxyCode === 'QWEN_PROXY_FAILED' && dispatched && proxyDetail?.stage === 'inference') finishInterviewAttempt(true);
      }
      parsed.finish_reason=normalizeQwenFinishReason(parsed.finish_reason);
      interviewUsage(parsed.usage);
      const timings=parsed.timings_ms || (typeof parsed.detail==='object'?parsed.detail?.timings_ms as IFastAPIGenerateResponse['timings_ms']:undefined);
      recordGenerationDuration('proxy.queue',timings?.queue_wait);
      recordGenerationDuration('proxy.inference',timings?.inference_roundtrip);
      recordGenerationDuration('proxy.readiness',timings?.readiness);
      countGenerationMetric(parsed.finish_reason==='length'?'qwenTruncated':parsed.finish_reason==='stop'?'qwenStopped':'qwenFinishUnknown');
      const elapsedMs =
        Date.now() -
        requestStartedAt;

      console.log(
        `[Qwen Service] HTTP ${response.status} in ${elapsedMs}ms | responseType=${typeof parsed.response} | responseLength=${typeof parsed.response === "string"
          ? parsed.response.length
          : 0
        } | finishReason=${parsed.finish_reason ?? "unknown"}`
      );

      if (response.ok) {
        if (
          typeof parsed.response !==
          "string" ||
          !parsed.response.trim()
        ) {
          throw new QwenResponseError('missing_json');
        }

        return parsed;
      }

      const errorMessage = `Qwen Service request failed with status ${response.status}`;

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
      if(options.signal?.aborted)throw new Error('Qwen request cancelled');
      if(options.deadlineAtMs!==undefined && Date.now()>=options.deadlineAtMs)throw new Error('Qwen request deadline expired');
      if (error instanceof QwenResponseError) {
        lastError = error;
      } else if (
        error instanceof Error &&
        error.name ===
        "AbortError"
      ) {
        lastError =
          new QwenResponseError('timeout');
      } else {
        lastError = new Error("Qwen transport request failed");
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
 * - allows up to 5 minutes for slow CPU inference
 * - limits output size so local generation does not run unnecessarily long
 * - retries transient failures with exponential backoff
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
      )}s: ${result.error ||
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
        failureKind: 'missing_json',
      };
    }

    const parsed = timeInterviewValidation(() => timeGenerationStage('jsonParse', () => parseJSONSafely<T>(rawText)));

    if (!parsed) {
      return {
        success: false,
        rawText,
        model: response.model || getDefaultQwenModel(),
        usage: buildUsage(response),
        finishReason: response.finish_reason,
        error: "Qwen returned invalid JSON format",
        failureKind: 'invalid_json',
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
      failureKind: error instanceof QwenResponseError ? error.failureKind : 'transport',
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
  signal?: AbortSignal;
  deadlineAtMs?: number;
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
      ...aiProxyRequestOptions(baseUrl),
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
