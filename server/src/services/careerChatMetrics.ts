import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

type Phase = 'preprocessing' | 'context' | 'response' | 'persistence';
export interface CareerChatMetrics {
  correlationId: string;
  success: boolean;
  totalMs: number;
  phasesMs: Record<Phase, number>;
  persistenceMs: number;
  qwenRoundtripMs: number;
  qwenCalls: number;
  cacheHit: boolean | null;
  strategy: string;
}
interface Scope { metrics: CareerChatMetrics; phase: Phase; since: number; closed: boolean }
const scopes = new AsyncLocalStorage<Scope>();
export function careerChatCorrelationId(): string | undefined {
  const scope = scopes.getStore();
  return scope && !scope.closed ? scope.metrics.correlationId : undefined;
}
export function careerChatPhase(phase: Phase): void {
  const scope = scopes.getStore();
  if (!scope || scope.closed) return;
  const now = performance.now();
  scope.metrics.phasesMs[scope.phase] += now - scope.since;
  scope.since = now;
  scope.phase = phase;
}
/** Persistence and Qwen durations are nested observations; do not add them to phases. */
export async function timeChatPersistence<T>(work: () => Promise<T>): Promise<T> {
  const scope = scopes.getStore(), started = performance.now();
  try { return await work(); }
  finally { if (scope && !scope.closed) scope.metrics.persistenceMs += performance.now() - started; }
}
export function startChatQwenAttempt(): () => void {
  const scope = scopes.getStore(), started = performance.now();
  if (scope && !scope.closed) scope.metrics.qwenCalls++;
  let finished = false;
  return () => {
    if (!finished && scope && !scope.closed) scope.metrics.qwenRoundtripMs += performance.now() - started;
    finished = true;
  };
}
export function careerChatOutcome(strategy: unknown, cacheHit: unknown): void {
  const scope = scopes.getStore();
  if (!scope || scope.closed) return;
  scope.metrics.strategy = typeof strategy === 'string' && /^[A-Z_]{1,64}$/.test(strategy) ? strategy : 'UNKNOWN';
  scope.metrics.cacheHit = typeof cacheHit === 'boolean' ? cacheHit : null;
}
/** Logs only fixed metrics and a random correlation ID; never users, prompts or errors. */
export async function withCareerChatMetrics<T>(work: () => Promise<T>, observe?: (value: CareerChatMetrics) => void, isSuccess: () => boolean = () => true): Promise<T> {
  if (scopes.getStore()) return work();
  const start = performance.now();
  const scope: Scope = { phase: 'preprocessing', since: start, closed: false, metrics: {
    correlationId: randomUUID(), success: false, totalMs: 0,
    phasesMs: { preprocessing: 0, context: 0, response: 0, persistence: 0 },
    persistenceMs: 0, qwenRoundtripMs: 0, qwenCalls: 0, cacheHit: null, strategy: 'UNKNOWN',
  } };
  return scopes.run(scope, async () => {
    try { const result = await work(); scope.metrics.success = isSuccess(); return result; }
    finally {
      careerChatPhase(scope.phase);
      scope.metrics.totalMs = performance.now() - start;
      scope.closed = true;
      try {
        const snapshot = structuredClone(scope.metrics);
        if (observe) observe(snapshot);
        else console.info('[Career Chat Performance]', JSON.stringify(snapshot));
      } catch { /* Telemetry cannot change a response. */ }
    }
  });
}
