import { AsyncLocalStorage } from 'node:async_hooks';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';

export type MetricStage = 'database.coordination' | 'database.model' | 'database.evidence' | 'planner' | 'cache' | 'prompt' | 'qwen' | 'jsonParse' | 'validation' | 'commit' | 'evidence' | 'nextSteps' | 'controller' | 'summary' | 'serialization' | 'proxy.queue' | 'proxy.inference' | 'proxy.readiness';
export type MetricCounter = 'modelReads' | 'evidenceReads' | 'evidenceReuse' | 'automationReuse' | 'cacheHits' | 'cacheMisses' | 'generatedNodes' | 'qwenCalls' | 'qwenFailures' | 'fallbackNodes' | 'promptBytes' | 'completionBytes' | 'promptTokensEstimate' | 'completionTokensEstimate' | 'promptTokensActual' | 'completionTokensActual' | 'coordinationCalls' | 'finalPayloadBytes' | 'finalPromptBytes' | 'finalPromptTokensEstimate' | 'validNodes' | 'missingNodes' | 'invalidNodes' | 'duplicateNodes' | 'unknownNodes' | 'receivedNodes' | 'qwenTruncated' | 'qwenStopped' | 'qwenFinishUnknown' | 'groundingRejectedNodes' | 'repeatedTextNodes';
export interface GenerationMetrics {
    boundary: 'generation' | 'controller';
    correlationId: string;
    operation: 'create' | 'replan' | 'progress-refresh';
    success: boolean;
    totalMs: number;
    stages: Partial<Record<MetricStage, { calls: number; failures: number; incomplete: number; durationMs: number }>>;
    counters: Partial<Record<MetricCounter, number>>;
}
interface Scope { value: GenerationMetrics; closed: boolean; active: Set<() => void> }
const scopes = new AsyncLocalStorage<Scope>();
/** No owners, inputs, error messages, prompts or database filters enter this scope. */
export async function withGenerationMetrics<T>(operation: GenerationMetrics['operation'], work: () => Promise<T>, observe?: (metrics: GenerationMetrics) => void, boundary: GenerationMetrics['boundary'] = 'generation', isSuccess?: () => boolean): Promise<T> {
    if (scopes.getStore() && !scopes.getStore()!.closed) return work();
    const scope: Scope = { closed: false, active: new Set(), value: { boundary, correlationId: randomUUID(), operation, success: false, totalMs: 0, stages: {}, counters: {} } };
    return scopes.run(scope, async () => {
        const start = performance.now();
        try { const result = await work(); scope.value.success = isSuccess ? isSuccess() : true; return result; }
        finally {
            scope.value.totalMs = performance.now() - start;
            for (const close of scope.active) close();
            scope.closed = true;
            // Observability must never change a commit or hide its original error.
            try {
                if (observe || process.env.ROADMAP_PERFORMANCE_METRICS === '1') {
                    const snapshot = JSON.parse(JSON.stringify(scope.value)) as GenerationMetrics;
                    if (observe) observe(snapshot);
                    if (process.env.ROADMAP_PERFORMANCE_METRICS === '1') console.info('[Roadmap Performance]', JSON.stringify(snapshot));
                }
            } catch { /* A telemetry sink cannot fail generation. */ }
        }
    });
}
export function countGenerationMetric(name: MetricCounter, amount = 1): void {
    const scope = scopes.getStore();
    if (scope && !scope.closed && Number.isFinite(amount) && amount >= 0) scope.value.counters[name] = (scope.value.counters[name] || 0) + amount;
}
export function timeGenerationStage<T>(name: MetricStage, work: () => T): T {
    const scope = scopes.getStore();
    if (!scope || scope.closed) return work();
    const start = performance.now();
    const close = () => finish(false, true);
    let finished = false;
    const finish = (success: boolean, incomplete = false) => {
        if (scope.closed || finished) return;
        finished = true;
        scope.active.delete(close);
        const row = scope.value.stages[name] ||= { calls: 0, failures: 0, incomplete: 0, durationMs: 0 };
        row.calls++; row.incomplete += incomplete ? 1 : 0; row.failures += success || incomplete ? 0 : 1; row.durationMs += performance.now() - start;
    };
    scope.active.add(close);
    try {
        const result = work();
        if (result && typeof (result as any).then === 'function')
            return Promise.resolve(result).then(value => { finish(true); return value; }, error => { finish(false); throw error; }) as T;
        finish(true); return result;
    } catch (error) { finish(false); throw error; }
}

/** Controller boundary includes summary and synchronous JSON serialization, not auth or network RTT. */
export async function withGenerationResponseMetrics(operation:GenerationMetrics['operation'], response:Response, work:()=>Promise<void>) {
    return withGenerationMetrics(operation,async()=>{
        const json=response.json;
        response.json=function(body:unknown){return timeGenerationStage('serialization',()=>json.call(this,body));};
        try{return await timeGenerationStage('controller',work);}
        finally{response.json=json;}
    },undefined,'controller',()=> (response.statusCode || 200)<400);
}

/** Remote durations are observations, not extra wall-clock spans to sum into totalMs. */
export function recordGenerationDuration(name:'proxy.queue'|'proxy.inference'|'proxy.readiness',durationMs:unknown):void {
    const scope=scopes.getStore();
    if(!scope || scope.closed || typeof durationMs!=='number' || !Number.isFinite(durationMs) || durationMs<0)return;
    const row=scope.value.stages[name] ||= {calls:0,failures:0,incomplete:0,durationMs:0};
    row.calls++;row.durationMs+=durationMs;
}

export function generationCorrelationId():string|undefined {const scope=scopes.getStore();return scope&&!scope.closed?scope.value.correlationId:undefined;}
