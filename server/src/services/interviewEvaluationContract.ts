/** Internal diagnostic vocabulary. Never attach prompts, answers, or model output. */
export const INTERVIEW_EVALUATION_FAILURES = {
  EVALUATION_JSON_MISSING: 'json',
  EVALUATION_JSON_INVALID: 'json',
  EVALUATION_REQUIRED_FIELDS_MISSING: 'validation',
  EVALUATION_SCORE_INVALID: 'validation',
  EVALUATION_OBSERVATIONS_INVALID: 'validation',
  EVALUATION_EVIDENCE_INVALID: 'validation',
  EVALUATION_FEEDBACK_UNGROUNDED: 'validation',
  EVALUATION_FEEDBACK_INVALID: 'validation',
  EVALUATION_IMPROVED_ANSWER_INVALID: 'validation',
  EVALUATION_FOLLOW_UP_INVALID: 'validation',
  EVALUATION_UNSUPPORTED_CLAIM: 'validation',
  EVALUATION_VALIDATION_FAILED: 'validation',
  EVALUATION_TRANSPORT_FAILED: 'transport',
  EVALUATION_MODEL_UNAVAILABLE: 'readiness',
  EVALUATION_TIMEOUT: 'transport',
  EVALUATION_OUTPUT_TRUNCATED: 'validation',
  EVALUATION_INPUT_INVALID: 'input',
} as const;
export type InterviewEvaluationFailureCode = keyof typeof INTERVIEW_EVALUATION_FAILURES;
export class InterviewEvaluationError extends Error {
  constructor(public readonly code: InterviewEvaluationFailureCode) {
    super(code);
    this.name = 'InterviewEvaluationError';
  }
}
export function classifyInterviewEvaluationFailure(error: unknown) {
  // Never classify by arbitrary error messages: those may contain private upstream content.
  const code = error instanceof InterviewEvaluationError &&
    Object.hasOwn(INTERVIEW_EVALUATION_FAILURES, error.code)
    ? error.code : 'EVALUATION_VALIDATION_FAILED';
  return { failureCode: code, failureStage: INTERVIEW_EVALUATION_FAILURES[code] };
}
export const INTERVIEW_EVALUATION_LIMITS = {
  observations: { maxItems: 6, minChars: 12, maxChars: 500 },
  feedback: { minChars: 40, maxChars: 1800 },
  improvedAnswer: { minChars: 40, maxChars: 2400 },
  followUpQuestion: { maxChars: 500 },
  evidence: { minItems: 1, maxItems: 3, minChars: 8, maxChars: 240 },
} as const;
