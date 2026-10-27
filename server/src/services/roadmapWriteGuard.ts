import { AsyncLocalStorage } from 'node:async_hooks';
import { countGenerationMetric, timeGenerationStage } from './roadmapGenerationMetrics';
import mongoose, { type ClientSession } from 'mongoose';
import { User } from '../models/User';
const committing = new AsyncLocalStorage<string>();
export const withGenerationCommit = <T>(owner: string, work: () => Promise<T>) => committing.run(owner, work);
const reading=new AsyncLocalStorage<string>();
export function withGenerationReads<T>(owner:string,work:()=>Promise<T>):Promise<T>{
    if(reading.getStore()&&reading.getStore()!==owner)throw new Error('Generation read owner mismatch');
    return reading.run(owner,work);
}
/** Apply committed evidence reads only inside a generation operation. */
export function installRoadmapReadGuard(model:any){
    const marker=Symbol.for('interviewiq.roadmapReadGuard');if(model[marker])return;model[marker]=true;
    const readOps=new Set(['find','findOne','countDocuments','distinct']);
    const exec=model.Query.prototype.exec;
    model.Query.prototype.exec=function(...args:any[]){
        if(reading.getStore()&&readOps.has(this.op)&&!this.getOptions().session){this.readConcern('majority');this.read('primary');}
        if (readOps.has(this.op)) { countGenerationMetric('modelReads'); return timeGenerationStage('database.model', () => exec.apply(this,args)); }
        return exec.apply(this,args);
    };
    const aggregate=model.aggregate;
    if(typeof aggregate==='function')model.aggregate=function(...args:any[]){
        const query=aggregate.apply(model,args),execute=query.exec;
        query.exec=function(...values:any[]){
            if(reading.getStore()&&!this.options?.session){this.readConcern('majority');this.read('primary');}
            countGenerationMetric('modelReads');
            return timeGenerationStage('database.model', () => execute.apply(this,values));
        };
        return query;
    };
}

/** All application writes to owned generation evidence share the account revision fence. */
export function installRoadmapWriteGuard(model: any, ownerField: string, revision: 'roadmapEvidenceRevision' | 'roadmapAutomationRevision') {
    const installed = Symbol.for('interviewiq.roadmapWriteGuard');
    if (model[installed])
        return;
    model[installed] = true;
    installRoadmapReadGuard(model);
    async function guarded(owners: (session: ClientSession) => Promise<string[]>, work: (session: ClientSession) => Promise<any>, session?: ClientSession): Promise<any> {
        async function execute(current: ClientSession) {
            const values = [...new Set(await owners(current))];
            for (const owner of values) {
                if (!mongoose.Types.ObjectId.isValid(owner))
                    throw new Error('Invalid generation evidence owner');
                if (committing.getStore()) {
                    if (committing.getStore() !== owner)
                        throw new Error('Generation commit owner mismatch');
                    continue;
                }
                const changed = await User.updateOne({ _id: owner }, { $inc: { [revision]: 1 } }, { session: current, timestamps: false,maxTimeMS:10_000 });
                if (changed.matchedCount !== 1)
                    throw new Error('Generation evidence owner was not found');
            }
            return work(current);
        }
        if (session?.inTransaction())
            return execute(session);
        // Transactions contain database work only. Inference is never retried here.
        const result=await mongoose.connection.transaction(execute, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' },maxCommitTimeMS:15_000,readPreference:'primary' });
        // Do not return a document still bound to a session owned and ended here.
        for(const document of (Array.isArray(result)?result:[result]))
            if(typeof document?.$session==='function'&&document.$session()?.hasEnded)document.$session(null);
        return result;
    }
    for (const method of ['save', '$save']) {
        const original = model.prototype[method];
        model.prototype[method] = function (options: any = {}) {
            if (revision === 'roadmapAutomationRevision' && !this.isNew) {
                // Fence saves loaded before a concurrent replan/task update, including legacy rows.
                this.$where = {
                    ...this.$where, [ownerField]: this.get(ownerField), __v: this.__v === undefined ? { $exists: false } : this.__v
                };
                this.increment();
            }
            return guarded(async () => [String(this.get(ownerField))], session => original.call(this, { ...options, session }), options.session || this.$session());
        };
    }
    const exec = model.Query.prototype.exec;
    const writes = new Set(['updateOne', 'updateMany', 'replaceOne', 'findOneAndUpdate', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete']);
    model.Query.prototype.exec = function (...args: any[]) {
        if (!writes.has(this.op))
            return exec.apply(this, args);
        const query = this;
        if (revision === 'roadmapAutomationRevision' && ['updateOne', 'updateMany', 'findOneAndUpdate'].includes(query.op)) {
            const update = query.getUpdate() || {};
            query.setUpdate({ ...update, $inc: { ...update.$inc, __v: 1 } });
        }
        return guarded(async (session) => {
            const filter = query.getFilter();
            const explicit = filter[ownerField] ?? query.getUpdate()?.$setOnInsert?.[ownerField] ?? query.getUpdate()?.$set?.[ownerField];
            if (explicit && typeof explicit !== 'object')
                return [String(explicit)];
            if (explicit instanceof mongoose.Types.ObjectId)
                return [String(explicit)];
            const found = await model.find(filter).select(ownerField).session(session).lean();
            return found.map((row: any) => String(row[ownerField]));
        }, session => { const attempt = query.clone().session(session); return exec.apply(attempt, args); }, query.getOptions().session);
    };
    const insertMany = model.insertMany;
    model.insertMany = function (rows: any[], options: any = {}) {
        return guarded(async () => rows.map(row => String(row[ownerField])), session => insertMany.call(model, rows, { ...options, session }), options.session);
    };
    const bulkWrite = model.bulkWrite;
    model.bulkWrite = function (operations: any[], options: any = {}) {
        return guarded(async (session) => {
            const owners: string[] = [];
            for (const operation of operations) {
                const item = Object.values(operation)[0] as any;
                const explicit = item.document?.[ownerField] ?? item.filter?.[ownerField] ?? item.update?.$setOnInsert?.[ownerField];
                if (explicit)
                    owners.push(String(explicit));
                else if (item.filter) {
                    const rows = await model.find(item.filter).select(ownerField).session(session).lean();
                    owners.push(...rows.map((row: any) => String(row[ownerField])));
                }
            }
            return owners;
        }, session => bulkWrite.call(model, operations, { ...options, session }), options.session);
    };
}
