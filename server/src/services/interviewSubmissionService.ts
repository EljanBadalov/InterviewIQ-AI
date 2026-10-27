import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import mongoose, { type ClientSession } from 'mongoose';
import { Interview, type IInterviewAnswer } from '../models/Interview';
import { Question } from '../models/Question';
import { interviewTransportUncertain, timeInterviewStage, setInterviewInferenceGuard } from './interviewEvaluationMetrics';

export class InterviewSubmissionError extends Error {
  constructor(public status:number, public code:string){super(code);}
}
interface Lease { owner:string; interview:string; question:string; token:string; until:Date; committed?:boolean }
const scope=new AsyncLocalStorage<Lease>();
// One session document is serialized; independent users/sessions never share a lock.
const LEASE_MS=150_000;
const options={maxTimeMS:5000,writeConcern:{w:'majority' as const,wtimeoutMS:5000}};
export const interviewSubmissionStore={
  async claim(lease:Lease){
    const changed=await Interview.collection.updateOne({_id:new mongoose.Types.ObjectId(lease.interview),user:new mongoose.Types.ObjectId(lease.owner),status:'in_progress',answers:{$elemMatch:{question:new mongoose.Types.ObjectId(lease.question),evaluationStatus:{$ne:'completed'}}},$or:[{evaluationLease:{$exists:false}},{$and:[{'evaluationLease.until':{$lte:new Date()}},{'evaluationLease.dispatched':false}]}]},{$set:{evaluationLease:{token:lease.token,question:lease.question,until:lease.until,dispatched:false}}},options);
    return changed.modifiedCount===1;
  },
  async release(lease:Lease,session?:ClientSession){
    return Interview.collection.updateOne({_id:new mongoose.Types.ObjectId(lease.interview),user:new mongoose.Types.ObjectId(lease.owner),'evaluationLease.token':lease.token},{$unset:{evaluationLease:''}},session?{session,maxTimeMS:5000}:options);
  },
  async valid(lease:Lease,session:ClientSession){
    return Boolean(await Interview.collection.findOne({_id:new mongoose.Types.ObjectId(lease.interview),user:new mongoose.Types.ObjectId(lease.owner),status:'in_progress',answers:{$elemMatch:{question:new mongoose.Types.ObjectId(lease.question),evaluationStatus:{$ne:'completed'}}},'evaluationLease.token':lease.token,'evaluationLease.until':{$gt:new Date()}},{session,projection:{_id:1},maxTimeMS:5000}));
  },
  async dispatched(lease:Lease){
    const result=await Interview.collection.updateOne({_id:new mongoose.Types.ObjectId(lease.interview),user:new mongoose.Types.ObjectId(lease.owner),'evaluationLease.token':lease.token,'evaluationLease.until':{$gt:new Date()},'evaluationLease.dispatched':false},{$set:{'evaluationLease.dispatched':true}},options);
    if(result.modifiedCount!==1)throw new InterviewSubmissionError(409,'INTERVIEW_DISPATCH_CONFLICT');
  },
};
export async function withInterviewSubmission<T>(owner:string,interview:string,question:string,work:()=>Promise<T>):Promise<T>{
  const lease:Lease={owner,interview,question,token:randomUUID(),until:new Date(Date.now()+LEASE_MS)};
  if(!await timeInterviewStage('coordinationMs',()=>interviewSubmissionStore.claim(lease)))throw new InterviewSubmissionError(409,'INTERVIEW_SUBMISSION_BUSY_OR_CHANGED');
  return scope.run(lease,async()=>{
    const clearGuard=setInterviewInferenceGuard(()=>timeInterviewStage('coordinationMs',()=>interviewSubmissionStore.dispatched(lease)));
    try{return await work();}
    finally{
      clearGuard();
      // Expired dispatched work is quarantined: remote completion must be verified before recovery.
      if(!lease.committed&&!interviewTransportUncertain())try{await timeInterviewStage('coordinationMs',()=>interviewSubmissionStore.release(lease));}catch{console.warn('[Interview Submission] Lease recovery required');}
    }});
}
export async function commitInterviewSubmission<T>(work:(session:ClientSession)=>Promise<T>):Promise<T>{
  const lease=scope.getStore();if(!lease)throw new InterviewSubmissionError(409,'INTERVIEW_LEASE_REQUIRED');
  const result=await timeInterviewStage('persistenceMs',()=>mongoose.connection.transaction(async session=>{
    if(!await interviewSubmissionStore.valid(lease,session))throw new InterviewSubmissionError(409,'INTERVIEW_LEASE_EXPIRED');
    const result=await work(session);
    const released=await interviewSubmissionStore.release(lease,session);
    if(released.modifiedCount!==1)throw new InterviewSubmissionError(409,'INTERVIEW_COMMIT_CONFLICT');
    return result;
  },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'},readPreference:'primary',maxCommitTimeMS:15000}));
  lease.committed=true;
  return result;
}
export interface EvaluationQuestion {text:string;interviewType:'technical'|'behavioral';difficulty:'beginner'|'intermediate'|'advanced'|'senior';category:string;tags:string[]}
export function validateEvaluationQuestion(value:unknown,text:string):EvaluationQuestion{
  const item=value as Partial<EvaluationQuestion>|null;
  if(!item||!['technical','behavioral'].includes(String(item.interviewType))||!['beginner','intermediate','advanced','senior'].includes(String(item.difficulty))||typeof item.category!=='string'||!item.category.trim()||typeof item.text!=='string'||item.text.trim()!==text.trim()||!Array.isArray(item.tags)||!item.tags.every(t=>typeof t==='string'))throw new InterviewSubmissionError(409,'INTERVIEW_QUESTION_METADATA_UNAVAILABLE');
  return {...item,text:text.trim(),tags:[...item.tags]} as EvaluationQuestion;
}
export async function resolveEvaluationQuestion(answer:IInterviewAnswer):Promise<EvaluationQuestion>{
  return timeInterviewStage('contextMs',async()=>{
    if(answer.questionSnapshot)return validateEvaluationQuestion(answer.questionSnapshot,answer.questionText);
    // Legacy snapshots retain their original text; changed/deleted source questions fail explicitly.
    const row=await Question.findById(answer.question).select('text interviewType difficulty category tags').maxTimeMS(5000).lean();
    return validateEvaluationQuestion(row,answer.questionText);
  });
}
