import { Types } from 'mongoose';
import CareerAutomation, { type ICareerAutomation } from '../models/CareerAutomation';
import { resolveCareerField } from './careerFieldService';

export interface ActiveCareer {
    targetRole: string;
    roleKey: string | null;
    revision: number;
    source: 'career-automation';
    catalogResolved: boolean;
}
export class ActiveCareerError extends Error {
    constructor(public code: string, public httpStatus: number, message: string) { super(message); }
}
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
const ownerId = (owner: string) => {
    if (!Types.ObjectId.isValid(owner)) throw new ActiveCareerError('CAREER_OWNER_INVALID', 401, 'Authentication is required.');
    return new Types.ObjectId(owner);
};
export type CareerSource = Pick<ICareerAutomation, 'userId' | 'targetRole' | 'status'> & { __v?: number; jobPreferences?: ICareerAutomation['jobPreferences'] };
const revision = (value: CareerSource) => value.__v ?? 0;
function assertOwner(owner: string, source: CareerSource) {
    if (String(source.userId).toLowerCase() !== String(owner).toLowerCase()) throw new ActiveCareerError('CAREER_OWNER_MISMATCH', 403, 'Career selection is not accessible.');
}
/** Owned source read can overlap independent evidence and knowledge work. */
export async function readActiveCareerSource(owner:string):Promise<CareerSource|null> {
    const source=await CareerAutomation.findOne({userId:ownerId(owner)})
        .select('userId targetRole status __v jobPreferences').read('primary').readConcern('majority').maxTimeMS(5000).lean<CareerSource>();
    if(source)assertOwner(owner,source);
    return source;
}
/** This DTO resolves the catalog without rewriting legacy titles or preferences. */
export async function resolveActiveCareer(owner: string, prepared?: CareerSource | null): Promise<ActiveCareer | null> {
    ownerId(owner);
    const source = prepared === undefined ? await readActiveCareerSource(owner) : prepared;
    if (!source) return null;
    assertOwner(owner, source);
    if (!['active', 'paused'].includes(source.status)) return null;
    const catalog = await resolveCareerField(source.targetRole);
    return { targetRole: source.targetRole, roleKey: catalog?.field.slug ?? null, revision: revision(source), source: 'career-automation', catalogResolved: Boolean(catalog) };
}
/** Optional revision keeps old clients compatible; null explicitly expects no record. */
export async function prepareCareerSelection(owner: string, target: unknown, expectedRevision: unknown) {
    const userId = ownerId(owner);
    if (expectedRevision !== undefined && expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || Number(expectedRevision) < 0))
        throw new ActiveCareerError('CAREER_REVISION_INVALID', 400, 'Expected revision must be a non-negative integer or null.');
    const automation = await CareerAutomation.findOne({ userId }).read('primary').readConcern('majority').maxTimeMS(5000);
    if (automation) assertOwner(owner, automation);
    if (expectedRevision !== undefined && (expectedRevision === null ? Boolean(automation) : !automation || revision(automation) !== expectedRevision))
        throw new ActiveCareerError('CAREER_REVISION_CONFLICT', 409, 'Your career data changed. Reload before saving again.');
    if (automation && !['active', 'paused'].includes(automation.status))
        throw new ActiveCareerError('CAREER_INACTIVE', 409, 'This career automation is inactive.');
    let selected: { name: string; slug: string } | undefined;
    if (target !== undefined) {
        if (typeof target !== 'string' || !normalize(target) || normalize(target).length > 160)
            throw new ActiveCareerError('CAREER_SELECTION_INVALID', 400, 'Select a valid target career.');
        const catalog = await resolveCareerField(normalize(target));
        if (!catalog) throw new ActiveCareerError('CAREER_SELECTION_UNKNOWN', 400, 'Select an available career from the catalog.');
        selected = { name: catalog.field.name, slug: catalog.field.slug };
    }
    if (!automation && !selected) throw new ActiveCareerError('CAREER_NOT_FOUND', 404, 'Career automation was not found.');
    // A selection is not a generated roadmap or a measured proficiency claim.
    const document = automation ?? new CareerAutomation({ userId, targetRole: selected!.name,
        careerGoal: `Explore ${selected!.name}`, settings: { automationEnabled: false, dailyTasksEnabled: false, jobSearchEnabled: false },
        roadmap: [], tasks: [], jobMatches: [] });
    if (selected) { document.targetRole = selected.name; document.jobPreferences.targetRoles = [selected.name]; }
    return { automation: document, selected };
}
export function isCareerWriteConflict(error: unknown): boolean {
    return Boolean(error && typeof error === 'object' &&
        (['VersionError', 'DocumentNotFoundError'].includes((error as Error).name) || (error as { code?: number }).code === 11000));
}
