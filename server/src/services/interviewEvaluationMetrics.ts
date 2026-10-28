import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { classifyInterviewEvaluationFailure, INTERVIEW_EVALUATION_CONTRACT_VERSION } from './interviewEvaluationContract';
export interface InterviewMetrics {
  evaluationContractVersion: string; evaluationProtocol?: 'legacy-literal' | 'refs-v1' | 'refs-v2' | 'unknown'; buildRevision?: string;
  correlationId: string; totalMs: number; success: boolean; status: number;
  contextMs: number; validationMs: number; persistenceMs: number; coordinationMs: number;
  qwenRoundtripMs: number; attempts: number; retries: number;
  promptTokens?: number; completionTokens?: number; transportUncertain: boolean;
  failureCode?: ReturnType<typeof classifyInterviewEvaluationFailure>['failureCode'];
  failureStage?: ReturnType<typeof classifyInterviewEvaluationFailure>['failureStage'];
  failureReason?: ReturnType<typeof classifyInterviewEvaluationFailure>['failureReason'];
  inferenceDispatched?: boolean | 'unknown';
  proxyFailureCode?: string;
  proxyFailureStage?: string;
}
const scopes = new AsyncLocalStorage<InterviewMetrics>();
const proxyCodes = new Set(['QWEN_MODEL_UNAVAILABLE','QWEN_TIMEOUT','GENERATION_EXPIRED',
  'QWEN_TRANSPORT_FAILED','QWEN_RESPONSE_INVALID_JSON','QWEN_RESPONSE_EMPTY','QWEN_PROXY_FAILED']);
const proxyStages = new Set(['queue','readiness','inference','response','completed']);
export function recordInterviewProxyDiagnostics(value: unknown): boolean | undefined {
  if (!value || typeof value !== 'object') return;
  const item = value as Record<string, unknown>;
  if (typeof item.stage !== 'string' || !proxyStages.has(item.stage) || typeof item.inferenceDispatched !== 'boolean') return;
  const scope = scopes.getStore();
  if (scope) {
    scope.inferenceDispatched = item.inferenceDispatched;
    scope.proxyFailureStage = String(item.stage);
    if (typeof item.code === 'string' && proxyCodes.has(item.code)) scope.proxyFailureCode = item.code;
  }
  return item.inferenceDispatched;
}
export function recordInterviewEvaluationProtocol(version: unknown): void {
  const scope = scopes.getStore();
  if (scope) scope.evaluationProtocol = version === undefined ? 'legacy-literal'
    : version === 'refs-v1' || version === 'refs-v2' ? version : 'unknown';
}
export function recordInterviewEvaluationFailure(error: unknown) {
  const failure = classifyInterviewEvaluationFailure(error);
  const scope = scopes.getStore();
  if (scope) { Object.assign(scope, failure); scope.failureReason = failure.failureReason; }
  return failure;
}
const inferenceGuards = new WeakMap<InterviewMetrics, ()=>Promise<void>>();
export function setInterviewInferenceGuard(guard:()=>Promise<void>):()=>void{
  const scope=scopes.getStore();if(!scope)return ()=>{};
  inferenceGuards.set(scope,guard);return ()=>inferenceGuards.delete(scope);
}
export async function guardInterviewInference():Promise<void>{
  const scope=scopes.getStore();if(scope)await inferenceGuards.get(scope)?.();
}
export const interviewCorrelationId = () => scopes.getStore()?.correlationId;
export const interviewTransportUncertain = () => scopes.getStore()?.transportUncertain ?? false;
export function timeInterviewValidation<T>(work:()=>T):T{
  const scope=scopes.getStore(),start=performance.now();
  try{return work();}finally{if(scope)scope.validationMs+=performance.now()-start;}
}
export function interviewAttempt(): (uncertain?: boolean) => void {
  const scope=scopes.getStore(), start=performance.now(); let finished=false;
  if(scope){scope.attempts++;scope.retries=Math.max(0,scope.attempts-1);scope.inferenceDispatched='unknown';}
  return uncertain => {
    if(scope){
      // A parsed proxy timeout may establish uncertainty after the HTTP timer has stopped.
      scope.transportUncertain ||= Boolean(uncertain);
      if(!finished)scope.qwenRoundtripMs+=performance.now()-start;
    }
    finished=true;
  };
}
export function interviewUsage(usage: {prompt_tokens?: unknown;completion_tokens?: unknown} | undefined): void {
  const scope=scopes.getStore();if(!scope||!usage)return;
  for(const [source,target] of [['prompt_tokens','promptTokens'],['completion_tokens','completionTokens']] as const){
    const value=usage[source];if(typeof value==='number'&&Number.isFinite(value)&&value>=0)scope[target]=(scope[target]||0)+value;
  }
}
export async function timeInterviewStage<T>(stage: 'contextMs'|'validationMs'|'persistenceMs'|'coordinationMs', work:()=>T|Promise<T>):Promise<T>{
  const scope=scopes.getStore(),start=performance.now();
  try{return await work();}finally{if(scope)scope[stage]+=performance.now()-start;}
}
export async function withInterviewMetrics<T>(work:()=>Promise<T>,status:()=>number=()=>200,observe?:(value:InterviewMetrics)=>void):Promise<T>{
  if(scopes.getStore())return work();
  const value:InterviewMetrics={evaluationContractVersion:INTERVIEW_EVALUATION_CONTRACT_VERSION,
    ...(/^[a-f0-9]{40}$/i.test(process.env.RENDER_GIT_COMMIT || '') ? {buildRevision:process.env.RENDER_GIT_COMMIT} : {}),correlationId:randomUUID(),totalMs:0,success:false,status:0,contextMs:0,validationMs:0,persistenceMs:0,coordinationMs:0,qwenRoundtripMs:0,attempts:0,retries:0,transportUncertain:false,inferenceDispatched:false};
  return scopes.run(value,async()=>{const start=performance.now();try{const result=await work();value.status=status();value.success=value.status<400;return result;}
    finally{value.totalMs=performance.now()-start;try{const snapshot=structuredClone(value);if(observe)observe(snapshot);else console.info('[Interview Evaluation Performance]',JSON.stringify(snapshot));}catch{/* Telemetry never changes evaluation. */}}});
}
