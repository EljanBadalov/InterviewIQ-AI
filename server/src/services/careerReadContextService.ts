import { createHash } from 'node:crypto';
import type { ActiveCareer } from './activeCareerService';
export interface CareerReadVersions { evidenceRevision?:number; automationRevision?:number }
export interface CareerReadContext extends CareerReadVersions {
    owner:string; activeCareer:ActiveCareer|null; preferencesKey?:string;
}
/** Additive metadata only. No private evidence or generation recovery is performed here. */
export function careerReadContext(owner:string, versions:CareerReadVersions|undefined, activeCareer:ActiveCareer|null, source?:any):CareerReadContext {
    if(source && String(source.userId).toLowerCase()!==owner.toLowerCase()) throw new Error('Career read owner mismatch');
    return {owner,...versions,activeCareer,...(source?{preferencesKey:createHash('sha256').update(JSON.stringify(source.jobPreferences||{})).digest('hex')}: {})};
}
export function careerFromSource(source:any):ActiveCareer|null {
    if(!source || !['active','paused'].includes(source.status))return null;
    return {targetRole:source.targetRole,roleKey:null,revision:source.__v??0,source:'career-automation',catalogResolved:false};
}

/** Identity and evidence freshness are distinct; global knowledge freshness is not assumed. */
export function roadmapReadFreshness(roadmap:readonly any[],owner:string,evidenceRevision?:number) {
    const sections=roadmap.filter(section=>!section.metadata?.retainedForCompletedTasks);
    const stamps=sections.map(section=>section.metadata?.roadmapNarrative?.sourceStamp);
    const valid=sections.length>0 && evidenceRevision!==undefined && stamps.every(stamp=>stamp?.policy==='career-read-provenance-v1' && stamp.owner===owner && Number.isSafeInteger(stamp.evidenceRevision));
    return {evidenceFreshness:valid?(stamps.every(stamp=>stamp.evidenceRevision===evidenceRevision)?'current':'stale'):'unverified',knowledgeFreshness:'unverified',freshness:'unverified'} as const;
}
