import { accountId, sessionSnapshot } from './authScope';
import { invalidateCareer } from './careerContextStore';
const eventName='interviewiq-career-mutation';
const storageKey='interviewiq-career-signal-v1';
const allowed=new Set(['roadmap','jobs','matches','progress','dashboard','resume','resume-profile','interviews']);
export function announceCareerMutation(groups:readonly string[]) {
    window.dispatchEvent(new CustomEvent(eventName,{detail:groups.filter(group=>allowed.has(group))}));
}
/** One bridge per mounted account provider. Signals never contain authoritative career data. */
export function startCareerSync(revalidate:(groups:string[])=>Promise<unknown>) {
    const session=sessionSnapshot(),owner=accountId();
    if(!owner)return()=>{};
    const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel('interviewiq-career-v1');
    const seen=new Set<string>();let disposed=false,running=false,timer:ReturnType<typeof setTimeout>|undefined;
    const pending=new Set<string>();let lastValidated=0;
    const schedule=(groups:string[])=>{
        groups.forEach(group=>pending.add(group));
        if(running||timer||disposed)return;
        timer=setTimeout(async()=>{timer=undefined;if(disposed||sessionSnapshot()!==session)return;
            running=true;const batch=[...pending];pending.clear();
            try{await revalidate(batch);lastValidated=Date.now();}catch{/* Existing query error states remain visible. */}
            finally{running=false;if(pending.size&&!disposed)schedule([]);}
        },40);
    };
    const receive=(value:unknown)=>{
        if(disposed||sessionSnapshot()!==session||!value||typeof value!=='object')return;
        const message=value as {version?:number;owner?:string;nonce?:string;groups?:string[]};
        if(message.version!==1||message.owner!==owner||typeof message.nonce!=='string'||message.nonce.length>100||!Array.isArray(message.groups)||message.groups.length>10||!message.groups.every(group=>allowed.has(group))||seen.has(message.nonce))return;
        seen.add(message.nonce);if(seen.size>128)seen.delete(seen.values().next().value!);
        invalidateCareer(message.groups);schedule(message.groups);
    };
    const onLocal=(event:Event)=>{
        if(sessionSnapshot()!==session)return;
        const groups=(event as CustomEvent<string[]>).detail;if(!groups.length)return;
        const message={version:1,owner,nonce:crypto.randomUUID(),groups};
        channel?.postMessage(message);
        if(!channel)try{localStorage.setItem(storageKey,JSON.stringify(message));localStorage.removeItem(storageKey);}catch{/* Focus revalidation is the fallback. */}
    };
    const onStorage=(event:StorageEvent)=>{if(event.key===storageKey&&event.newValue)try{receive(JSON.parse(event.newValue));}catch{/* Ignore malformed external input. */}};
    const onFocus=()=>{if(document.visibilityState==='visible' && Date.now()-lastValidated>30_000)schedule(['roadmap','jobs','matches','progress']);};
    if(channel)channel.onmessage=event=>receive(event.data);
    window.addEventListener(eventName,onLocal);window.addEventListener('storage',onStorage);
    window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onFocus);
    return()=>{disposed=true;if(timer)clearTimeout(timer);pending.clear();seen.clear();channel?.close();window.removeEventListener(eventName,onLocal);window.removeEventListener('storage',onStorage);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onFocus);};
}
