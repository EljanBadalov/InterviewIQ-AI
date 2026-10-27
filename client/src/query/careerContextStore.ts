import { accountId, onSessionReset, sessionEpoch } from './authScope';
export interface ActiveCareer { targetRole:string; roleKey:string|null; revision:number }
export interface CareerContext { owner:string; activeCareer:ActiveCareer|null; evidenceRevision?:number; automationRevision?:number; preferencesKey?:string }
const listeners=new Set<()=>void>();
let context:CareerContext|undefined;
let domains:Record<string,number>={};
let serial=0;
export const careerSnapshot=()=>String(serial);
export const subscribeCareer=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export const activeCareer=()=>context?.activeCareer;
export const careerContext=()=>context;
const publish=()=>{serial++;listeners.forEach(listener=>listener());};
export function careerDomain(endpoint:string):string|null {
    const path=new URL(endpoint,'https://query.invalid').pathname;
    if(path==='/progress')return 'progress';
    if(path.startsWith('/jobs'))return path==='/jobs/external/matches'?'matches':'jobs';
    if(path.startsWith('/career-automation') && !path.endsWith('/fields') && !path.endsWith('/generation-status'))return 'roadmap';
    return null;
}
export function careerRequestToken(endpoint:string) {
    const domain=careerDomain(endpoint);
    return JSON.stringify([accountId(),sessionEpoch(),domain,domain?domains[domain]||0:0]);
}
export function careerScope(endpoint:string, candidate=context):string|undefined {
    const domain=careerDomain(endpoint);if(!domain)return;
    const role=candidate?.activeCareer?.targetRole.trim().toLowerCase()??null;
    // __v orders snapshots; unrelated task writes do not change Progress identity.
    const dependency=domain==='progress'?[candidate?.evidenceRevision]:domain==='jobs'||domain==='matches'?[candidate?.evidenceRevision,candidate?.preferencesKey]:[candidate?.automationRevision,candidate?.activeCareer?.revision];
    return JSON.stringify([candidate?'known':'bootstrap',role,domains[domain]||0,...dependency]);
}
export function acceptCareerContext(next:CareerContext, beforePublish?:()=>void):boolean {
    if(!next || next.owner!==accountId() || (next.activeCareer!==null && (!next.activeCareer || typeof next.activeCareer.targetRole!=='string' || !next.activeCareer.targetRole.trim() || !Number.isSafeInteger(next.activeCareer.revision) || next.activeCareer.revision<0)))return false;
    for(const key of ['evidenceRevision','automationRevision'] as const) {
        if(next[key]!==undefined && (!Number.isSafeInteger(next[key]) || next[key]! < 0))return false;
        if(context?.[key]!==undefined && (next[key]===undefined || next[key]! < context[key]!))return false;
    }
    const old=context?.activeCareer,fresh=next.activeCareer;
    if(old && fresh && (fresh.revision<old.revision || (fresh.revision===old.revision && fresh.targetRole!==old.targetRole)))return false;
    if(old && !fresh && next.automationRevision===undefined)return false;
    const changed=JSON.stringify(context)!==JSON.stringify(next);
    context={...next,activeCareer:fresh?{...fresh}:null};
    beforePublish?.();
    if(changed)publish();
    return true;
}
export function invalidateCareer(groups:readonly string[]) {
    for(const group of groups)domains[group]=(domains[group]||0)+1;
    publish();
}
onSessionReset(()=>{context=undefined;domains={};publish();});
