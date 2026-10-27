import { acceptCareerContext, careerRequestToken, careerScope, careerSnapshot, subscribeCareer, type CareerContext } from './careerContextStore';
import axios from "axios";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import apiClient from "../api/apiClient";
import { accountId, sessionEpoch, sessionSnapshot, subscribeSession } from "./authScope";
import { queryClient } from "./queryClient";
import { apiQueryKey, resourceGroup, resourceStaleTime } from "./queryPolicy";

export function apiQueryOptions<T>(endpoint: string, scope = sessionSnapshot(), contextScope?:string) {
  const [owner, epoch] = JSON.parse(scope) as [string | null, number];
  const contextKey=contextScope??careerScope(endpoint);
  const baseKey = apiQueryKey(owner, epoch, endpoint);
  const key = contextKey ? [...baseKey,contextKey] as const : baseKey;
  const path = key[4];
  const params = key[5];
  return queryOptions({
    queryKey: key,
    queryFn: async ({ signal }) => {
      if (owner !== accountId() || epoch !== sessionEpoch()) throw new axios.CanceledError("Account session changed");
      const requestToken=careerRequestToken(endpoint);
      const body = (await apiClient.get<T>(path, { params, signal })).data;
      if (body && typeof body === "object" && "success" in body && body.success === false) {
        throw new Error("The request was not successful");
      }
      if(requestToken!==careerRequestToken(endpoint))throw new axios.CanceledError('Career dependencies changed');
      const envelope=(body as {careerContext?:CareerContext})?.careerContext ?? (path==='/career-automation/active-career' && body && typeof body==='object' && 'data' in body && body.data && typeof body.data==='object' && 'activeCareer' in body.data ? {owner:owner!,activeCareer:body.data.activeCareer} as CareerContext : undefined);
      if(envelope && !acceptCareerContext(envelope,()=>{
        const confirmed=apiQueryKey(owner,epoch,endpoint);
        const nextScope=careerScope(endpoint,envelope);
        queryClient.setQueryData(nextScope?[...confirmed,nextScope]:confirmed,body);
      }))throw new axios.CanceledError('Older career context');
      return body;
    },
    staleTime: resourceStaleTime(path),
    gcTime: resourceGroup(path) === "career-fields" ? 60 * 60_000 : 10 * 60_000,
  });
}

export function useApiQuery<T>(endpoint: string, enabled = true, retainPrevious = false, contextScope?:string) {
  const careerVersion=useSyncExternalStore(subscribeCareer,careerSnapshot);
  const scope = useSyncExternalStore(subscribeSession, sessionSnapshot);
  const options = useMemo(() => apiQueryOptions<T>(endpoint, scope, contextScope), [endpoint, scope, contextScope, careerVersion]);
  const result = useQuery({ ...options, enabled: enabled && Boolean(accountId()), placeholderData: retainPrevious ? keepPreviousData : undefined });
  const setData = useCallback((data: T) => {
    if(contextScope===undefined && options.queryKey[6]!==careerScope(endpoint))return;
    if (options.queryKey[1] !== accountId() || options.queryKey[2] !== sessionEpoch()) return;
    void queryClient.cancelQueries({ queryKey: options.queryKey });
    queryClient.setQueryData(options.queryKey, data);
  }, [options,endpoint,contextScope]);
  return { ...result, setData };
}

// Imperative reads in on-demand dialogs share the same cache as route observers.
export async function readApi<T>(endpoint: string): Promise<{ data: T }> {
  return { data: await queryClient.fetchQuery(apiQueryOptions<T>(endpoint)) };
}
