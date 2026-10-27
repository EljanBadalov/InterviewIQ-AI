import { useSyncExternalStore } from 'react';
import { useApiQuery } from './apiQueries';
import { activeCareer, careerContext, careerSnapshot, subscribeCareer } from './careerContextStore';
export type { ActiveCareer } from './careerContextStore';
/** Data responses carry context; cold routes no longer wait for a selection request. */
export function useCareerQuery<T>(endpoint:string,enabled=true,retainPrevious=false) {
    useSyncExternalStore(subscribeCareer,careerSnapshot);
    const result=useApiQuery<T>(endpoint,enabled,retainPrevious);
    // Older compatible servers may omit the additive envelope.
    const fallback=useApiQuery('/career-automation/active-career',enabled&&result.isSuccess&&!careerContext()&&endpoint!=='/career-automation/active-career');
    return {...result,activeCareer:activeCareer(),careerPending:result.isPending,careerError:result.error||fallback.error};
}
