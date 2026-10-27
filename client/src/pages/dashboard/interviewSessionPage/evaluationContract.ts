/** Validate the public evaluation shape without synthesizing missing feedback. */
export function isAcceptedInterviewEvaluation(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const score = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 100;
  const text = (x: unknown, min: number, max: number) => typeof x === 'string' &&
    x.replace(/\s+/g, ' ').trim().length >= min && x.replace(/\s+/g, ' ').trim().length <= max;
  const observations = (x: unknown) => Array.isArray(x) && x.length <= 6 &&
    x.every(entry => text(entry, 12, 500) && entry.length <= 500);
  return ['score', 'technicalAccuracy', 'completeness', 'communication'].every(key => score(item[key])) &&
    text(item.feedback, 40, 1800) && text(item.improvedAnswer, 40, 2400) &&
    observations(item.strengths) && observations(item.weaknesses);
}
