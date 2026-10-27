import { startCareerSync } from './careerContextSync';
import { accountId, sessionEpoch } from './authScope';
import { Fragment, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import { sessionSnapshot, subscribeSession } from "./authScope";

export default function AccountQueryProvider({ children }: { children: ReactNode }) {
  const scope = useSyncExternalStore(subscribeSession, sessionSnapshot);
  useEffect(()=>startCareerSync(async groups=>{
    const owner=accountId(),epoch=sessionEpoch();
    const predicate=(query:{queryKey:readonly unknown[]})=>query.queryKey[0]==='account'&&query.queryKey[1]===owner&&query.queryKey[2]===epoch&&groups.includes(String(query.queryKey[3]));
    await queryClient.invalidateQueries({predicate,refetchType:'none'});
    if(groups.includes('roadmap')) { const {readApi}=await import('./apiQueries'); await readApi('/career-automation/active-career'); }
    await queryClient.refetchQueries({predicate,type:'active'},{cancelRefetch:false});
  }),[scope]);
  return (
    <QueryClientProvider client={queryClient}>
      <Fragment key={scope}>{children}</Fragment>
    </QueryClientProvider>
  );
}
