import { AsyncLocalStorage } from 'node:async_hooks';
import { Types } from 'mongoose';
import { countGenerationMetric, timeGenerationStage } from './roadmapGenerationMetrics';

export interface RoadmapEvidenceMetrics {
  reads: number;
  reusedReads: number;
  historyReuse: number;
  stages: Array<{ name: string; durationMs: number; success: boolean }>;
}
interface EvidenceScope {
  userId: string;
  values: Map<string, Promise<unknown>>;
  metrics: RoadmapEvidenceMetrics;
}
const scopes = new AsyncLocalStorage<EvidenceScope>();
const ownerKey = (userId: unknown) => String(userId).trim().toLowerCase();

/** Scope exists only until this operation finishes; nothing is shared across requests. */
export async function withRoadmapEvidence<T>(userId: string, work: () => Promise<T>, observe?: (metrics: RoadmapEvidenceMetrics) => void): Promise<T> {
  const owner = ownerKey(userId);
  const current = scopes.getStore();
  if (current) {
    if (current.userId !== owner) throw new Error('Roadmap evidence owner mismatch');
    return work();
  }
  // Preserve public context-builder validation for invalid inputs outside automation.
  if (!Types.ObjectId.isValid(owner)) return work();
  const scope: EvidenceScope = { userId: owner, values: new Map(), metrics: { reads: 0, reusedReads: 0, historyReuse: 0, stages: [] } };
  return scopes.run(scope, async () => {
    try { return await work(); }
    finally { observe?.({ ...scope.metrics, stages: [...scope.metrics.stages] }); scope.values.clear(); }
  });
}
function ownedScope(userId: string): EvidenceScope | undefined {
  const scope = scopes.getStore();
  if (scope && scope.userId !== ownerKey(userId)) throw new Error('Roadmap evidence owner mismatch');
  return scope;
}
function clone<T>(value: T): T {
  if (value instanceof Types.ObjectId) return new Types.ObjectId(String(value)) as T;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (Array.isArray(value)) return value.map(clone) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,clone(item)])) as T;
  return value;
}
export async function measureRoadmapStage<T>(name: string, work: () => Promise<T>, isSuccessful?: (value: T) => boolean): Promise<T> {
  const scope = scopes.getStore();
  if (!scope) return work();
  const started = performance.now(); let success = false;
  try { const result = await work(); success = isSuccessful ? isSuccessful(result) : true; return result; }
  finally { scope.metrics.stages.push({ name, durationMs: performance.now()-started, success }); }
}
export async function readRoadmapEvidence<T>(userId: string, key: string, work: () => Promise<T>): Promise<T> {
  const scope = ownedScope(userId);
  if (!scope) return work();
  let value = scope.values.get(key);
  if (!value) {
    scope.metrics.reads++;
    countGenerationMetric('evidenceReads');
    value = Promise.resolve().then(() => timeGenerationStage('database.evidence', work));
    scope.values.set(key,value);
  } else { scope.metrics.reusedReads++; countGenerationMetric('evidenceReuse'); }
  return clone(await value as T);
}
type OwnedRow = { user: unknown; _id?: unknown; fileId?: unknown };
function assertOwned(userId: string, rows: OwnedRow[]) {
  if (rows.some(row => ownerKey(row.user) !== ownerKey(userId))) throw new Error('Roadmap source owner mismatch');
}
export async function readRoadmapHistory<T extends OwnedRow>(userId: string, kind: 'resume' | 'interview', work: () => Promise<T[]>): Promise<T[]> {
  return readRoadmapEvidence(userId,`${kind}:history`,async () => { const rows=await work(); assertOwned(userId,rows); return rows; });
}
export async function readRoadmapDocument<T extends OwnedRow>(userId: string, kind: 'resume' | 'interview', selector: { id?: string; fileId?: string; latest?: boolean }, work: () => Promise<T | null>): Promise<T | null> {
  const scope = ownedScope(userId);
  if (!scope) return work();
  const key = `${kind}:${JSON.stringify(selector)}`;
  return readRoadmapEvidence(userId,key,async () => {
    const history = scope.values.get(`${kind}:history`);
    if (history) {
      // A failed optional history read must not poison an independent lookup.
      const rows = await (history as Promise<T[]>).catch(() => undefined);
      if (rows) {
        const found = selector.latest ? rows[0] : selector.id ? rows.find(row => String(row._id) === selector.id) : rows.find(row => String(row.fileId) === selector.fileId);
        if (found || (selector.latest && rows.length === 0)) { scope.metrics.historyReuse++; return found ?? null; }
      }
    }
    const row = await work();
    if (row) assertOwned(userId,[row]);
    return row;
  });
}
