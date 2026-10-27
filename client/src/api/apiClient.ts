import { acceptCareerContext, careerContext, careerDomain, careerRequestToken, careerScope, invalidateCareer } from '../query/careerContextStore';
import { announceCareerMutation } from '../query/careerContextSync';
import { canApplyCareerSelection, type CareerSelection } from '../query/careerSelectionPolicy';
import axios from "axios";
import { accountId, sessionEpoch, sessionSignal } from "../query/authScope";
import { queryClient } from "../query/queryClient";
import { apiQueryKey, mutationGroups } from "../query/queryPolicy";

declare module "axios" {
  interface InternalAxiosRequestConfig {
    accountEpoch?: number;
    careerRequestToken?:string;
  }
}

const apiClient = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api/v1",
});

apiClient.interceptors.request.use(
  (config) => {
    config.accountEpoch = sessionEpoch();
    config.careerRequestToken=careerRequestToken(config.url||'/');
    config.signal = config.signal
      ? AbortSignal.any([sessionSignal(), config.signal as AbortSignal])
      : sessionSignal();
    const token = localStorage.getItem(
      "interviewiq_token"
    );

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    } else {
      config.headers["Content-Type"] =
        "application/json";
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(response => {
  if (response.config.accountEpoch !== sessionEpoch()) {
    throw new axios.CanceledError("Account session changed");
  }
  const requestPath=response.config.url||'/';
  if(response.config.method?.toLowerCase()==='get' && careerDomain(requestPath) && response.config.careerRequestToken!==careerRequestToken(requestPath))throw new axios.CanceledError('Career dependencies changed');
  const method = response.config.method?.toLowerCase();
  if (method && !["get", "head", "options"].includes(method) && response.data?.success !== false) {
    const path = new URL(response.config.url || "/", "https://query.invalid").pathname;
    let mutationBody=response.config.data;
    if(typeof mutationBody==='string')try{mutationBody=JSON.parse(mutationBody);}catch{mutationBody=undefined;}
    const selection=response.data?.data?.activeCareer;
    const oldRole=careerContext()?.activeCareer?.targetRole;
    if(path==='/career-automation/job-preferences' && selection?.targetRole===oldRole && mutationBody && typeof mutationBody==='object') {
      mutationBody={...mutationBody};delete mutationBody.targetRole;
    }
    const groups = mutationGroups(path,mutationBody);
    if(selection){
      const previous=careerContext();
      if(!acceptCareerContext({owner:accountId()!,activeCareer:selection,evidenceRevision:previous?.evidenceRevision,automationRevision:previous?.automationRevision}))throw new axios.CanceledError('Older career selection');
    }
    invalidateCareer(groups);
    announceCareerMutation(groups);
    const owner = accountId();
    const epoch = sessionEpoch();
    const predicate = (query: { queryKey: readonly unknown[] }) =>
      query.queryKey[0] === "account" && query.queryKey[1] === owner &&
      query.queryKey[2] === epoch && groups.includes(String(query.queryKey[3]));
    if(path==='/career-automation/job-preferences' && response.data?.data?.activeCareer) {
      const key=apiQueryKey(owner,epoch,'/career-automation/active-career');
      const current=queryClient.getQueryData<{data:{activeCareer:CareerSelection}}>(key)?.data.activeCareer;
      if(canApplyCareerSelection(current,response.data.data.activeCareer))queryClient.setQueryData(key,{success:true,data:{activeCareer:response.data.data.activeCareer}});
    }
    // Mark related reads stale without racing the mutation's authoritative result.
    void queryClient.cancelQueries({ predicate });
    void queryClient.invalidateQueries({ predicate, refetchType: "none" });
    const automation=response.data?.data?.automation;
    const currentCareer=careerContext()?.activeCareer;
    if(automation && currentCareer && automation.targetRole===currentCareer.targetRole &&
       (automation.__v===undefined || automation.__v>=currentCareer.revision)) {
      const prime=(endpoint:string,body:unknown)=>{
        const key=apiQueryKey(owner,epoch,endpoint),scope=careerScope(endpoint);
        queryClient.setQueryData(scope?[...key,scope]:key,body);
      };
      // Only the authenticated mutation response can seed the new dependency epoch.
      const snapshot={...automation,careerContext:automation.careerContext??{status:'unverified',evidenceFreshness:'unverified',generatedForRole:null,activeTargetRole:automation.targetRole}};
      prime('/career-automation?includeSummary=true',{success:true,data:snapshot,summary:response.data.data.summary??null});
      prime('/career-automation',{success:true,data:snapshot});
      if('summary' in response.data.data)prime('/career-automation/summary',{success:true,data:response.data.data.summary});
    }
  }
  return response;
}, error => {
  if (error.config?.accountEpoch !== undefined && error.config.accountEpoch !== sessionEpoch()) {
    return Promise.reject(new axios.CanceledError("Account session changed"));
  }
  return Promise.reject(error);
});

export default apiClient;