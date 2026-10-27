import { NARRATIVE_EVIDENCE_POLICY } from './roadmapNarrativeGrounding';
import { SKILL_ASSESSMENT_POLICY } from './skillEvidenceAssessment';
import { LEARNING_PLANNER_POLICY } from './careerLearningPlanner';
import { LEARNING_KNOWLEDGE_HASH, LEARNING_KNOWLEDGE_VERSION } from '../data/careerLearningKnowledge';
import { AsyncLocalStorage } from 'node:async_hooks';
import { withGenerationMetrics, countGenerationMetric, timeGenerationStage } from './roadmapGenerationMetrics';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { User } from '../models/User';
import CareerAutomation from '../models/CareerAutomation';
import { Job } from '../models/Job';
import { CareerKnowledge } from '../models/CareerKnowledge';
import { NARRATIVE_POLICY, stableHash } from './roadmapNarrativePlanner';
import { withGenerationCommit, withGenerationReads } from './roadmapWriteGuard';
export type GenerationOperation = 'create' | 'replan' | 'progress-refresh';
export interface GenerationJob {
    id: string;
    operation: GenerationOperation;
    inputHash: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    token: string;
    leaseUntil: Date;
    deadline: Date;
    startedAt: Date;
    updatedAt: Date;
    evidenceRevision: number;
    automationRevision: number;
    committedRevision?: number;
    degraded?: boolean;
    errorCode?: string;
    receipts?: Partial<Record<GenerationOperation, {
        inputHash: string;
    }>>;
}
export class GenerationError extends Error {
    constructor(public code: string, public httpStatus = 409) {
        const messages: Record<string, string> = {
            GENERATION_ALREADY_RUNNING: 'A roadmap update is already running. Please wait for it to finish.',
            GENERATION_INPUT_CHANGED: 'Your career data changed during generation. Please retry.',
            GENERATION_COMMIT_CONFLICT: 'Your career data changed during generation. Please retry.',
            GENERATION_DEADLINE_EXCEEDED: 'The roadmap update took too long. Your existing roadmap was preserved.',
            GENERATION_FAILED: 'The roadmap update could not be saved. Your existing roadmap was preserved.',
            GENERATION_UNAVAILABLE: 'Roadmap updates are temporarily unavailable. Please retry.',
            GENERATION_RECOVERY_COOLDOWN: 'The previous update was interrupted. Please retry after its recovery window.',
            GENERATION_OWNER_NOT_FOUND: 'Your account was not found.',
            GENERATION_OWNER_INVALID: 'Authentication is required.',
            GENERATION_OWNER_MISMATCH: 'You cannot access this roadmap update.',
        };
        super(messages[code] || 'The roadmap update was interrupted. Please retry.');
        this.name = 'GenerationError';
    }
}
const LEASE_MS = 60000, DEADLINE_MS = 360000, POLL_MS = 300;
const DURABLE_WRITE={timestamps:false,maxTimeMS:10_000,writeConcern:{w:'majority' as const,wtimeoutMS:10_000}};
let recoveryCursor: mongoose.Types.ObjectId | undefined;
const stages = new AsyncLocalStorage<{
    owner: string;
    draft?: any;
    automation?: any;
    degraded: boolean;
    sourceStamp?:{owner:string;evidenceRevision:number;sourceVersion:string;policy:string};
    inferenceSignal?:AbortSignal;
    inferenceDeadlineMs?:number;
    checkActive:()=>void;
}>();
const date = (value: any) => new Date(value).getTime();
const currentJob = (state: any): GenerationJob | undefined => state?.roadmapGeneration;
const revision = (value: unknown) => typeof value === 'number' ? value : 0;
const revisionFilter = (field: string, value: number) => value === 0 ? { $or: [{ [field]: 0 }, { [field]: { $exists: false } }] } : { [field]: value };
const object = (value: any) => value?.toObject ? value.toObject() : value;
/** This adapter is also the boundary used by isolated database fixtures. */
export const roadmapGenerationStore = {
    async read(owner:string,session?:any):Promise<any>{
        const query=User.findById(owner).select({_id:1,roadmapGeneration:1,roadmapEvidenceRevision:1,roadmapAutomationRevision:1}).session(session || null).maxTimeMS(10_000);
        if(!session){query.readConcern('majority');query.read('primary');}
        return query.lean();
    },
    async automation(owner:string,session?:any):Promise<any>{
        const query=CareerAutomation.findOne({userId:owner}).session(session || null).maxTimeMS(10_000);
        if(!session){query.readConcern('majority');query.read('primary');}
        return query;
    },
    async globalVersion(session?: any): Promise<string> {
        const queries = [
            CareerKnowledge.find({ status: 'active' }).select('_id sourceVersion updatedAt').sort({ _id: 1 }).session(session || null).maxTimeMS(10_000).lean(),
            Job.findOne({ isActive: true }).sort({ updatedAt: -1, _id: -1 }).select('_id updatedAt').session(session || null).maxTimeMS(10_000).lean(),
            Job.countDocuments({ isActive: true }).session(session || null).maxTimeMS(10_000),
        ];
        if(!session)for(const query of queries){query.readConcern('majority');query.read('primary');}
        // The driver does not support parallel operations on a transaction session.
        const [knowledge, latest, count] = session ? [await queries[0], await queries[1], await queries[2]] : await Promise.all(queries);
        return stableHash({
            knowledge, latest, count
        });
    },
    async claim(owner: string, state: any, job: GenerationJob): Promise<boolean> {
        const old = currentJob(state);
        const filter: any = { _id: owner, $and: [revisionFilter('roadmapEvidenceRevision', job.evidenceRevision), revisionFilter('roadmapAutomationRevision', job.automationRevision)] };
        if (old)
            filter['roadmapGeneration.token'] = old.token;
        else
            filter.roadmapGeneration = { $exists: false };
        const result = await User.updateOne(filter, { $set: { roadmapGeneration: job } }, DURABLE_WRITE);
        return result.modifiedCount === 1;
    },
    async running(owner: string, job: GenerationJob): Promise<boolean> {
        const result = await User.updateOne({
            _id: owner, 'roadmapGeneration.token': job.token, 'roadmapGeneration.status': 'pending', 'roadmapGeneration.leaseUntil': { $gt: new Date() }
        }, { $set: { 'roadmapGeneration.status': 'running', 'roadmapGeneration.updatedAt': new Date() } }, DURABLE_WRITE);
        return result.modifiedCount === 1;
    },
    async heartbeat(owner: string, job: GenerationJob): Promise<boolean> {
        const now = new Date();
        const result = await User.updateOne({
            _id: owner, 'roadmapGeneration.token': job.token, 'roadmapGeneration.status': 'running', 'roadmapGeneration.leaseUntil': { $gt: now }, 'roadmapGeneration.deadline': { $gt: now }
        }, { $set: { 'roadmapGeneration.leaseUntil': new Date(Math.min(now.getTime() + LEASE_MS, date(job.deadline))), 'roadmapGeneration.updatedAt': now } }, DURABLE_WRITE);
        return result.modifiedCount === 1;
    },
    async expire(owner:string,job:GenerationJob):Promise<boolean>{
        // A renewal observed after the read must not be overwritten by recovery.
        const changed=await User.updateOne({
            _id:owner,
            'roadmapGeneration.token':job.token,
            'roadmapGeneration.status':{$in:['pending','running']},
            'roadmapGeneration.leaseUntil':job.leaseUntil ?? {$exists:false},
            'roadmapGeneration.deadline':job.deadline ?? {$exists:false},
        },{$set:{
            'roadmapGeneration.status':'failed',
            'roadmapGeneration.errorCode':'GENERATION_LEASE_EXPIRED',
            'roadmapGeneration.updatedAt':new Date(),
        }},DURABLE_WRITE);
        return changed.modifiedCount===1;
    },
    async fail(owner: string, job: GenerationJob, code: string): Promise<void> {
        await User.updateOne({
            _id: owner, 'roadmapGeneration.token': job.token, 'roadmapGeneration.status': { $in: ['pending', 'running'] }
        }, { $set: {
                'roadmapGeneration.status': 'failed', 'roadmapGeneration.errorCode': code, 'roadmapGeneration.updatedAt': new Date()
            } }, DURABLE_WRITE);
    },
    async commit(owner: string, job: GenerationJob, draft: any, degraded: boolean, globalVersion: string, original: any, completedHash: string): Promise<any> {
        const result=await mongoose.connection.transaction(async (session) => withGenerationCommit(owner, async () => {
            if (await roadmapGenerationStore.globalVersion(session) !== globalVersion)
                throw new GenerationError('GENERATION_INPUT_CHANGED');
            const filter: any = {
                _id: owner, 'roadmapGeneration.token': job.token, 'roadmapGeneration.status': 'running', 'roadmapGeneration.leaseUntil': { $gt: new Date() }, 'roadmapGeneration.deadline': { $gt: new Date() }, $and: [revisionFilter('roadmapEvidenceRevision', job.evidenceRevision), revisionFilter('roadmapAutomationRevision', job.automationRevision)]
            };
            const nextRevision = job.automationRevision + (draft ? 1 : 0);
            const receipts = { ...job.receipts };
            if (!degraded)
                receipts[job.operation] = { inputHash: completedHash };
            const changed = await User.updateOne(filter, { $set: {
                    'roadmapGeneration.status': 'completed', 'roadmapGeneration.inputHash': completedHash, 'roadmapGeneration.receipts': receipts, 'roadmapGeneration.updatedAt': new Date(), 'roadmapGeneration.committedRevision': nextRevision, 'roadmapGeneration.degraded': degraded
                }, ...(draft ? { $inc: { roadmapAutomationRevision: 1 } } : {}) }, { session, timestamps: false, maxTimeMS:10_000 });
            if (changed.modifiedCount !== 1)
                throw new GenerationError('GENERATION_COMMIT_CONFLICT');
            if (draft) {
                if (String(draft.userId) !== owner)
                    throw new GenerationError('GENERATION_OWNER_MISMATCH', 403);
                if (!draft.isNew) {
                    if (!original)
                        throw new GenerationError('GENERATION_COMMIT_CONFLICT');
                    draft.$where = {
                        userId: owner, updatedAt: original.updatedAt, __v: original.__v === undefined ? { $exists: false } : original.__v
                    };
                }
                await draft.save({ session });
                return draft;
            }
            return roadmapGenerationStore.automation(owner, session);
        }), { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' },maxCommitTimeMS:15_000,readPreference:'primary' });
        if(typeof result?.$session==='function'&&result.$session()?.hasEnded)result.$session(null);
        return result;
    },
    async expired(): Promise<any[]> {
        // Walk a bounded page through the existing _id index; no new status index.
        const rows = await User.find(recoveryCursor ? { _id: { $gt: recoveryCursor } } : {}).sort({ _id: 1 }).select({ _id: 1, roadmapGeneration: 1 }).limit(100).maxTimeMS(10_000).lean();
        recoveryCursor = rows.length === 100 ? rows[rows.length - 1]._id : undefined;
        return rows.filter(row => { const job = currentJob(row); return job && ['pending', 'running'].includes(job.status) && (date(job.leaseUntil) <= Date.now() || date(job.deadline) <= Date.now()); });
    },
};
// Instrument store boundaries; nested timings overlap and must not be summed.
for (const name of Object.keys(roadmapGenerationStore) as Array<keyof typeof roadmapGenerationStore>) {
    const original = roadmapGenerationStore[name] as (...args: any[]) => Promise<any>;
    (roadmapGenerationStore as any)[name] = (...args: any[]) => {
        countGenerationMetric('coordinationCalls');
        return timeGenerationStage(name === 'commit' ? 'commit' : 'database.coordination', () => original(...args));
    };
}
/** Return a working copy, never the immutable preflight document used by commit CAS. */
export async function readGenerationAutomation<T>(owner: string, read: () => Promise<T>): Promise<T> {
    const context = stages.getStore();
    if (!context) return read();
    if (String(owner).trim().toLowerCase() !== context.owner) throw new GenerationError('GENERATION_OWNER_MISMATCH', 403);
    context.checkActive();
    if (context.automation && String(context.automation.userId) !== context.owner) throw new GenerationError('GENERATION_OWNER_MISMATCH', 403);
    countGenerationMetric('automationReuse');
    return context.automation as T;
}
/** Existing services stage their draft; only the fenced transaction may persist it. */
/** Read-only accessor for provenance; never claims a job or reads the database. */
export function generationSourceStamp(owner:string) {
    const context=stages.getStore();
    if(!context)return;
    if(context.owner!==owner.toLowerCase())throw new GenerationError('GENERATION_OWNER_MISMATCH',403);
    context.checkActive();return context.sourceStamp?{...context.sourceStamp}:undefined;
}
/** Optional transport budget; never changes model parameters or durable job state. */
export function generationInferenceContext():{signal?:AbortSignal;deadlineAtMs?:number}|undefined {
    const context=stages.getStore();if(!context)return;
    context.checkActive();
    if(context.inferenceDeadlineMs!==undefined && Date.now()>=context.inferenceDeadlineMs)throw new GenerationError('GENERATION_DEADLINE_EXCEEDED',503);
    return {signal:context.inferenceSignal,deadlineAtMs:context.inferenceDeadlineMs};
}
export function assertGenerationActive():void{stages.getStore()?.checkActive();}
export async function saveGeneratedAutomation(document: any): Promise<any> {
    assertGenerationActive();
    const context = stages.getStore();
    if (!context)
        return document.save();
    if (String(document.userId) !== context.owner)
        throw new GenerationError('GENERATION_OWNER_MISMATCH', 403);
    context.draft = document;
    return document;
}
export async function createGeneratedAutomation(data: any): Promise<any> {
    assertGenerationActive();
    if (!stages.getStore())
        return CareerAutomation.create(data);
    const document = new CareerAutomation(data);
    await document.validate();
    return saveGeneratedAutomation(document);
}
export function recordGenerationFallback(fallbackNodes: number) {
    const context = stages.getStore();
    if (context && fallbackNodes > 0)
        context.degraded = true;
}
function fingerprint(operation:GenerationOperation,input:any,state:any,automation:any,globalVersion:string){
    const stored=object(automation);
    const configuration=stored?{
        targetRole:stored.targetRole,
        careerGoal:stored.careerGoal,
        targetDate:stored.targetDate,
        roadmapDurationDays:stored.roadmapDurationDays,
        activeResumeId:stored.activeResumeId,
        activeInterviewId:stored.activeInterviewId,
        settings:stored.settings,
        jobPreferences:stored.jobPreferences,
        status:stored.status,
        completed:stored.tasks?.filter((task:any)=>task.status==='completed').map(object),
        completedMilestones:stored.roadmap?.filter((milestone:any)=>milestone.status==='completed')
            .map((milestone:any)=>({id:milestone.id,completedAt:milestone.completedAt})),
    }:null;
    return stableHash({
        operation,
        policy:NARRATIVE_POLICY,
        narrativeEvidencePolicy:NARRATIVE_EVIDENCE_POLICY,
        learningPolicy:LEARNING_PLANNER_POLICY,
        assessmentPolicy:SKILL_ASSESSMENT_POLICY,
        learningKnowledge:LEARNING_KNOWLEDGE_VERSION,
        learningContent:LEARNING_KNOWLEDGE_HASH,
        coordinationPolicy:'roadmap-generation-v1',
        consumerContextPolicy:'career-roadmap-context-v2',
        input,
        evidence:revision(state.roadmapEvidenceRevision),
        globalVersion,
        configuration,
        // Receipts must describe the currently stored result, not an older role's output.
        outputVersion:stored?stableHash({roadmap:stored.roadmap,tasks:stored.tasks}):null,
    });
}
async function recover(owner: string, state: any) {
    const job = currentJob(state);
    if (job && ['pending', 'running'].includes(job.status) && (!Number.isFinite(date(job.leaseUntil)) || !Number.isFinite(date(job.deadline)) || date(job.leaseUntil) <= Date.now() || date(job.deadline) <= Date.now())) {
        return roadmapGenerationStore.expire(owner,job);
    }
    return false;
}
async function waitForJob(owner: string, job: GenerationJob, signal:AbortSignal): Promise<any> {
    while (Date.now() < date(job.deadline) + POLL_MS) {
        if(signal.aborted)throw signal.reason;
        await new Promise(resolve => setTimeout(resolve, POLL_MS));
        const state = await roadmapGenerationStore.read(owner);
        if(signal.aborted)throw signal.reason;
        if (!state)
            throw new GenerationError('GENERATION_OWNER_NOT_FOUND', 404);
        const current = currentJob(state);
        if (!current || current.token !== job.token)
            throw new GenerationError('GENERATION_SUPERSEDED');
        if (await recover(owner, state))
            throw new GenerationError('GENERATION_LEASE_EXPIRED', 503);
        if (current.status === 'completed')
            return roadmapGenerationStore.automation(owner);
        if (current.status === 'failed')
            throw new GenerationError(current.errorCode || 'GENERATION_FAILED', 503);
    }
    throw new GenerationError('GENERATION_WAIT_TIMEOUT', 503);
}
async function coordinate(owner: string, operation: GenerationOperation, input: any, work: () => Promise<any>,signal:AbortSignal): Promise<any> {
    for (let attempt = 0; attempt < 4; attempt++) {
        const state = await roadmapGenerationStore.read(owner);
        if(signal.aborted)throw signal.reason;
        if (!state)
            throw new GenerationError('GENERATION_OWNER_NOT_FOUND', 404);
        const [automation, globalVersion] = await Promise.all([roadmapGenerationStore.automation(owner), roadmapGenerationStore.globalVersion()]);
        if(signal.aborted)throw signal.reason;
        const inputHash = fingerprint(operation, input, state, automation, globalVersion);
        const previous = currentJob(state);
        if (await recover(owner, state))
            continue;
        if (previous && ['pending', 'running'].includes(previous.status)) {
            if (previous.inputHash === inputHash)
                return waitForJob(owner, previous,signal);
            throw new GenerationError('GENERATION_ALREADY_RUNNING');
        }
        if (previous?.receipts?.[operation]?.inputHash === inputHash) {
            const latest = await roadmapGenerationStore.read(owner);
            if (revision(latest?.roadmapEvidenceRevision) !== revision(state.roadmapEvidenceRevision) || revision(latest?.roadmapAutomationRevision) !== revision(state.roadmapAutomationRevision))
                continue;
            return automation;
        }
        // A dead process may have left an inference request running at the model server.
        // Do not automatically overlap a replacement before its original bounded deadline.
        if (previous?.status === 'failed' && previous.errorCode === 'GENERATION_LEASE_EXPIRED' && date(previous.deadline) > Date.now())
            throw new GenerationError('GENERATION_RECOVERY_COOLDOWN', 503);
        const now = new Date();
        const job: GenerationJob = {
            id: randomUUID(), token: randomUUID(), operation, inputHash, status: 'pending', startedAt: now, updatedAt: now, leaseUntil: new Date(now.getTime() + LEASE_MS), deadline: new Date(now.getTime() + DEADLINE_MS), evidenceRevision: revision(state.roadmapEvidenceRevision), automationRevision: revision(state.roadmapAutomationRevision), receipts: previous?.receipts || {}
        };
        if (!await roadmapGenerationStore.claim(owner, state, job))
            continue;
        if(signal.aborted){await roadmapGenerationStore.fail(owner,job,'GENERATION_DEADLINE_EXCEEDED');throw signal.reason;}
        if (!await roadmapGenerationStore.running(owner, job))
            throw new GenerationError('GENERATION_LEASE_LOST', 503);
        const inferenceAbort=new AbortController();
        let leaseLost = false, heartbeatBusy = false;
        const heartbeat=setInterval(async()=>{
            if(heartbeatBusy)return;
            heartbeatBusy=true;const renewedAt=Date.now();
            try{
                if(!await roadmapGenerationStore.heartbeat(owner,job))leaseLost=true;
                else job.leaseUntil=new Date(Math.min(renewedAt+LEASE_MS,date(job.deadline)));
            }catch{leaseLost=true;}
            finally{if(leaseLost)inferenceAbort.abort(new GenerationError('GENERATION_LEASE_LOST',503));heartbeatBusy=false;}
        },15_000);
        heartbeat.unref();
        let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
        let abandoned = false;
        try {
            const context = {
                owner, draft: undefined as any, degraded: false,
                inferenceSignal:AbortSignal.any([signal,inferenceAbort.signal]),inferenceDeadlineMs:date(job.deadline)-15_000,
                sourceStamp:{owner,evidenceRevision:job.evidenceRevision,sourceVersion:globalVersion,policy:'career-read-provenance-v1'},
                automation: automation ? CareerAutomation.hydrate(object(automation)) : null,
                checkActive:()=>{
                    if(abandoned||signal.aborted||Date.now()>=date(job.deadline))throw new GenerationError('GENERATION_DEADLINE_EXCEEDED',503);
                    if(leaseLost||Date.now()>=date(job.leaseUntil))throw new GenerationError('GENERATION_LEASE_LOST',503);
                }
            };
            const generation = stages.run(context, () => withGenerationReads(owner,async () => {
                await work();
                if (abandoned || signal.aborted)
                    throw new GenerationError('GENERATION_DEADLINE_EXCEEDED', 503);
                if (leaseLost)
                    throw new GenerationError('GENERATION_LEASE_LOST', 503);
                if (context.draft)
                    await context.draft.validate();
                const completedHash = fingerprint(operation, input, state, context.draft || automation, globalVersion);
                return await roadmapGenerationStore.commit(owner, job, context.draft, context.degraded, globalVersion, object(automation), completedHash);
            }));
            const deadline = new Promise<never>((_resolve, reject) => { deadlineTimer = setTimeout(() => { abandoned = true; inferenceAbort.abort(new GenerationError('GENERATION_DEADLINE_EXCEEDED',503)); reject(new GenerationError('GENERATION_DEADLINE_EXCEEDED', 503)); }, Math.max(1, date(job.deadline) - Date.now())); });
            return await Promise.race([generation, deadline]);
        }
        catch (error) {
            const conflict = error && typeof error === 'object' && (['VersionError', 'DocumentNotFoundError'].includes((error as Error).name) || (error as any).code === 11000);
            const safe = error instanceof GenerationError ? error : new GenerationError(conflict ? 'GENERATION_COMMIT_CONFLICT' : 'GENERATION_FAILED', conflict ? 409 : 503);
            try {
                await roadmapGenerationStore.fail(owner, job, safe.code);
            }
            catch { /* Expiry recovery remains available after database outages. */ }
            throw safe;
        }
        finally {
            clearInterval(heartbeat);
            inferenceAbort.abort();
            if (deadlineTimer)
                clearTimeout(deadlineTimer);
        }
    }
    throw new GenerationError('GENERATION_CLAIM_CONFLICT');
}
/** Each process has its own flight map; durable claims remain authoritative. */
export function createRoadmapGenerationCoordinator() {
    const flights = new Map<string, Promise<any>>();
    return function coordinateRoadmapGeneration(owner: string, operation: GenerationOperation, input: any, work: () => Promise<any>): Promise<any> {
        owner = String(owner).trim().toLowerCase();
        if (!mongoose.Types.ObjectId.isValid(owner))
            return Promise.reject(new GenerationError('GENERATION_OWNER_INVALID', 401));
        input = {
            ...input, userId: owner, ...(operation === 'replan' ? { preserveCompletedTasks: input.preserveCompletedTasks ?? true, reason: typeof input.reason === 'string' ? input.reason.trim() : '' } : {})
        };
        const key = stableHash({
            owner, operation, input
        });
        const existing = flights.get(key);
        if (existing)
            return existing.then(value => value?.constructor?.hydrate ? value.constructor.hydrate(value.toObject()) : value);
        const controller=new AbortController();
        let timeout:ReturnType<typeof setTimeout>;
        const deadline=new Promise<never>((_resolve,reject)=>{timeout=setTimeout(()=>{const error=new GenerationError('GENERATION_DEADLINE_EXCEEDED',503);controller.abort(error);reject(error);},DEADLINE_MS);});
        const promise = withGenerationMetrics(operation, () => Promise.race([coordinate(owner, operation, input, work,controller.signal),deadline])).finally(()=>clearTimeout(timeout)).catch(error => {if(error instanceof GenerationError)throw error;throw new GenerationError('GENERATION_UNAVAILABLE',503);});
        flights.set(key, promise);
        void promise.finally(() => {
            if (flights.get(key) === promise)
                flights.delete(key);
        }).catch(() => { });
        return promise;
    };
}
export const coordinateRoadmapGeneration = createRoadmapGenerationCoordinator();
export async function getRoadmapGenerationStatus(owner: string) {
    if (!mongoose.Types.ObjectId.isValid(owner))
        throw new GenerationError('GENERATION_OWNER_INVALID', 401);
    let state = await roadmapGenerationStore.read(owner);
    if (!state)
        throw new GenerationError('GENERATION_OWNER_NOT_FOUND', 404);
    if (await recover(owner, state))
        state = await roadmapGenerationStore.read(owner);
    const job = currentJob(state);
    if (!job)
        return { status: 'idle' };
    return {
        id: job.id, operation: job.operation, status: job.status, startedAt: job.startedAt, updatedAt: job.updatedAt, degraded: Boolean(job.degraded), ...(job.errorCode ? { errorCode: job.errorCode } : {}), ...(job.status === 'failed' && job.errorCode === 'GENERATION_LEASE_EXPIRED' ? { retryAfter: job.deadline } : {})
    };
}
export async function recoverStaleRoadmapGenerations() {
    for (const state of await roadmapGenerationStore.expired())
        await recover(String(state._id), state);
}
