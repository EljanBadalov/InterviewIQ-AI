/** Internal diagnostic vocabulary. Never attach prompts, answers, or model output. */
export const INTERVIEW_EVALUATION_FAILURES = {
  EVALUATION_JSON_MISSING: 'json',
  EVALUATION_JSON_INVALID: 'json',
  EVALUATION_REQUIRED_FIELDS_MISSING: 'validation',
  EVALUATION_SCORE_INVALID: 'validation',
  EVALUATION_OBSERVATIONS_INVALID: 'validation',
  EVALUATION_EVIDENCE_INVALID: 'validation',
  EVALUATION_FEEDBACK_UNGROUNDED: 'validation',
  EVALUATION_QUESTION_GROUNDING_INVALID: 'validation',
  EVALUATION_OBSERVATION_GROUNDING_INVALID: 'validation',
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
/** Bounded diagnostic reasons only; never include the rejected quote or answer. */
export const INTERVIEW_EVIDENCE_FAILURE_REASONS = [
  'EVIDENCE_MISSING', 'EVIDENCE_NOT_ARRAY', 'EVIDENCE_COUNT_INVALID',
  'EVIDENCE_ITEM_NOT_STRING', 'EVIDENCE_TOO_SHORT', 'EVIDENCE_TOO_LONG',
  'EVIDENCE_NOT_VERBATIM', 'EVIDENCE_MODE_INVALID', 'EVIDENCE_ID_INVALID',
] as const;
export type InterviewEvidenceFailureReason = typeof INTERVIEW_EVIDENCE_FAILURE_REASONS[number];
export const INTERVIEW_EVALUATION_CONTRACT_VERSION = 'interview-evaluation-v4-inline-refs';
export const INTERVIEW_OBSERVATION_FAILURE_REASONS = [
  'OBSERVATION_REFERENCES_MISSING', 'OBSERVATION_REFERENCE_COUNT_MISMATCH',
  'OBSERVATION_REFERENCE_INVALID', 'OBSERVATION_VALUE_INVALID',
  'OBSERVATION_MARKER_MISSING', 'OBSERVATION_TEXT_REFERENCE_MISSING',
] as const;
export type InterviewObservationFailureReason = typeof INTERVIEW_OBSERVATION_FAILURE_REASONS[number];
export type InterviewEvaluationFailureReason = InterviewEvidenceFailureReason | InterviewObservationFailureReason;
export class InterviewEvaluationError extends Error {
  constructor(public readonly code: InterviewEvaluationFailureCode, public readonly reason?: InterviewEvaluationFailureReason) {
    super(code);
    this.name = 'InterviewEvaluationError';
  }
}
export function classifyInterviewEvaluationFailure(error: unknown) {
  // Never classify by arbitrary error messages: those may contain private upstream content.
  const code = error instanceof InterviewEvaluationError &&
    Object.hasOwn(INTERVIEW_EVALUATION_FAILURES, error.code)
    ? error.code : 'EVALUATION_VALIDATION_FAILED';
  const failure: {
    failureCode: InterviewEvaluationFailureCode;
    failureStage: typeof INTERVIEW_EVALUATION_FAILURES[InterviewEvaluationFailureCode];
    failureReason?: InterviewEvaluationFailureReason;
  } = { failureCode: code, failureStage: INTERVIEW_EVALUATION_FAILURES[code] };
  if (code === 'EVALUATION_EVIDENCE_INVALID' && error instanceof InterviewEvaluationError &&
    INTERVIEW_EVIDENCE_FAILURE_REASONS.includes(error.reason as InterviewEvidenceFailureReason))
    failure.failureReason = error.reason;
  if (code === 'EVALUATION_OBSERVATION_GROUNDING_INVALID' && error instanceof InterviewEvaluationError &&
    INTERVIEW_OBSERVATION_FAILURE_REASONS.includes(error.reason as InterviewObservationFailureReason))
    failure.failureReason = error.reason;
  return failure;
}
export const INTERVIEW_EVALUATION_LIMITS = {
  observations: { maxItems: 6, minChars: 12, maxChars: 500 },
  feedback: { minChars: 40, maxChars: 1800 },
  improvedAnswer: { minChars: 40, maxChars: 2400 },
  followUpQuestion: { maxChars: 500 },
  evidence: { minItems: 1, maxItems: 3, minChars: 8, maxChars: 240 },
} as const;
