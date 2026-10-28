const test=require('node:test'),assert=require('node:assert/strict');
const f=require('./phase4-base-fixture.cjs'),mongoose=require('mongoose');
mongoose.connect=mongoose.createConnection=()=>{throw Error('Live database forbidden');};
for(const key of ['find','findOne','insertOne','updateOne','deleteOne','bulkWrite','createIndex'])mongoose.Collection.prototype[key]=()=>{throw Error('Unmocked database access forbidden');};
const controller=f.load('controllers/interviewController');
const submission=f.load('services/interviewSubmissionService');
const evaluation=f.load('services/interviewEvaluationService');
const metric=f.load('services/interviewEvaluationMetrics');
const contract=f.load('services/interviewEvaluationContract');
const input=()=>({question:questionText,answer,roleSlug:'frontend-developer',difficulty:'advanced',interviewType:'technical'});
const evidence=f.load('services/skillEvidenceService'),realRecordEvidence=evidence.recordInterviewSkillEvidence;
const {Interview}=f.load('models/Interview'),{Question}=f.load('models/Question');
const owner=String(f.ownerA),other=String(f.ownerB),interview=String(f.id(501)),question=String(f.id(601));
const answer='A closure retains access to the variables of its lexical scope after the outer function returns.';
const questionText='Explain JavaScript closures and give an example.';
const clone=value=>JSON.parse(JSON.stringify(value));
let records,questions,skills,posts,queries,telemetry,payloads,failPersistence,failTransport,inTransaction;
const originalInfo=console.info, originalError=console.error, originalLog=console.log;
function output(overrides={}){return {score:78,technicalAccuracy:80,completeness:74,communication:82,strengths:['The explanation correctly describes retained lexical scope.'],weaknesses:['Provide a concrete function example to demonstrate the behavior.'],feedback:'For JavaScript closures, the phrase "A closure retains access" correctly identifies retained scope, but add a concrete example.',improvedAnswer:'In JavaScript, a closure is a function together with access to its lexical environment; a counter function demonstrates retained private state.',answerEvidence:['A closure retains access'],assessmentBasis:{questionQuote:'JavaScript',strengths:['lexical scope'],weaknesses:['example']},...overrides};}

const invalidCases=[
 ['missing JSON','EVALUATION_JSON_MISSING',()=> ''],
 ['malformed JSON','EVALUATION_JSON_INVALID',()=> '{not json'],
 ['non-object JSON','EVALUATION_JSON_INVALID',()=> '[]'],
 ['missing required field','EVALUATION_REQUIRED_FIELDS_MISSING',()=>JSON.stringify(output({feedback:undefined}))],
 ['invalid score','EVALUATION_SCORE_INVALID',()=>JSON.stringify(output({score:'78'}))],
 ['invalid strengths','EVALUATION_OBSERVATIONS_INVALID',()=>JSON.stringify(output({strengths:['short']}))],
 ['invalid weaknesses','EVALUATION_OBSERVATIONS_INVALID',()=>JSON.stringify(output({weaknesses:'not an array'}))],
 ['missing evidence','EVALUATION_EVIDENCE_INVALID',()=>JSON.stringify(output({answerEvidence:undefined}))],
 ['invented evidence','EVALUATION_EVIDENCE_INVALID',()=>JSON.stringify(output({answerEvidence:['PRIVATE fabricated evidence']}))],
 ['ungrounded feedback','EVALUATION_FEEDBACK_UNGROUNDED',()=>JSON.stringify(output({feedback:'This feedback has enough characters but references none of the submitted evidence.'}))],
 ['empty feedback','EVALUATION_FEEDBACK_INVALID',()=>JSON.stringify(output({feedback:''}))],
 ['short improvedAnswer','EVALUATION_IMPROVED_ANSWER_INVALID',()=>JSON.stringify(output({improvedAnswer:'A stronger realistic example answer.'}))],
 ['invalid followup','EVALUATION_FOLLOW_UP_INVALID',()=>JSON.stringify(output({followUpQuestion:123}))],
 ['invented certification','EVALUATION_UNSUPPORTED_CLAIM',()=>JSON.stringify(output({strengths:['You are certified in JavaScript development.']}))],
];
for(const [name,code,raw] of invalidCases)test('classified rejection: '+name,async()=>{
 global.fetch=async()=>{posts++;return new Response(JSON.stringify({response:raw(),finish_reason:'stop'}));};
 const response=await invoke();
 assert.equal(response.statusCode,503);assert.deepEqual(Object.keys(response.body).sort(),['message','success']);
 assert.equal(response.body.message,'AI evaluation could not be completed. Your answer was not skipped. Please submit it again.');
 assert.equal(posts,1);assert.equal(telemetry[0].attempts,1);assert.equal(telemetry[0].retries,0);
 assert.equal(telemetry[0].failureCode,code);assert.equal(telemetry[0].failureStage,code.includes('JSON')?'json':'validation');
 assert.equal(telemetry[0].persistenceMs,0);assert.equal(records.get(interview).answers[0].answerText,undefined);
 assert.equal(records.get(interview).evaluationLease,undefined);assert.deepEqual(skills,[]);
 const diagnostic=JSON.stringify(telemetry)+JSON.stringify(response.body);
 for(const secret of [answer,questionText,owner,'PRIVATE fabricated evidence'])assert.ok(!diagnostic.includes(secret));
});

test('transport failure keeps uncertainty quarantine and structured diagnostics',async()=>{
 failTransport=true;const response=await invoke();assert.equal(response.statusCode,503);
 assert.equal(telemetry[0].failureCode,'EVALUATION_TIMEOUT');assert.equal(telemetry[0].failureStage,'transport');
 assert.equal(telemetry[0].transportUncertain,true);assert.equal(posts,1);assert.equal(telemetry[0].retries,0);
 assert.ok(records.get(interview).evaluationLease);assert.equal(telemetry[0].persistenceMs,0);
});

for(const body of ['{broken envelope','null','[]'])test('invalid proxy envelope is classified without private content: '+body,async()=>{
 global.fetch=async()=>{posts++;return new Response(body);};await invoke();
 assert.equal(posts,1);assert.equal(telemetry[0].failureCode,'EVALUATION_JSON_INVALID');
});

test('unknown failures never expose arbitrary private error messages or forged codes',async()=>{
 let observed;
 await metric.withInterviewMetrics(async()=>{
  metric.recordInterviewEvaluationFailure(new Error('PRIVATE answer, JWT and profile'));
 },()=>503,value=>{observed=value;});
 assert.equal(observed.failureCode,'EVALUATION_VALIDATION_FAILED');assert.equal(observed.failureStage,'validation');
 assert.ok(!JSON.stringify(observed).includes('PRIVATE'));assert.ok(!JSON.stringify(observed).includes('JWT'));
 assert.equal(contract.classifyInterviewEvaluationFailure({code:'PRIVATE CODE'}).failureCode,'EVALUATION_VALIDATION_FAILED');
 const forged=new contract.InterviewEvaluationError('PRIVATE CODE');
 assert.equal(contract.classifyInterviewEvaluationFailure(forged).failureCode,'EVALUATION_VALIDATION_FAILED');
});

for(const sample of [answer,'1234567890','An answer with "quotes", backslash \\ and unicode əşç.','  Evidence\nwith\tspaces and enough text  ', 'a'.repeat(6000)])
test('prompt type-only shape avoids illustrative judgments: '+sample.length,()=>{
 const context={...input(),answer:sample};const prompt=evaluation.createInterviewEvaluationPrompt(context);
 const shape=JSON.parse(prompt.slice(prompt.lastIndexOf('\n{')+1));
 assert.equal(shape.score,'number 0..100');assert.equal(shape.evidenceVersion,'refs-v2');assert.equal('assessmentBasis' in shape,false);
 assert.ok(!prompt.includes('JSON FORMAT EXAMPLE'));assert.ok(!prompt.includes('score: 25'));
 assert.ok(prompt.includes('40-2400'));assert.ok(prompt.includes('8-240'));assert.equal(posts,0);
});

// These cover the confirmed failure class; the original production quote was not logged.
const evidenceFailures=[
 ['missing',undefined,'EVIDENCE_MISSING'],
 ['null',null,'EVIDENCE_NOT_ARRAY'],
 ['string','A closure retains access','EVIDENCE_NOT_ARRAY'],
 ['object',{quote:'A closure retains access'},'EVIDENCE_NOT_ARRAY'],
 ['empty',[],'EVIDENCE_COUNT_INVALID'],
 ['too many',Array(4).fill('A closure retains access'),'EVIDENCE_COUNT_INVALID'],
 ['non-string',[{quote:'A closure retains access'}],'EVIDENCE_ITEM_NOT_STRING'],
 ['short',['closure'],'EVIDENCE_TOO_SHORT'],
 ['long',['A'.repeat(241)],'EVIDENCE_TOO_LONG'],
 ['paraphrase',['A closure remembers its outer variables'],'EVIDENCE_NOT_VERBATIM'],
 ['case changed',['a closure retains access'],'EVIDENCE_NOT_VERBATIM'],
 ['invented',['PRIVATE fabricated evidence'],'EVIDENCE_NOT_VERBATIM'],
];
for(const [name,value,reason] of evidenceFailures)test('strict evidence reason: '+name,()=>{
 let failure;
 try{evaluation.validateInterviewEvaluation(output({answerEvidence:value}),input());}
 catch(error){failure=error;}
 assert.ok(failure);assert.equal(failure.code,'EVALUATION_EVIDENCE_INVALID');
 assert.deepEqual(contract.classifyInterviewEvaluationFailure(failure),{
  failureCode:'EVALUATION_EVIDENCE_INVALID',failureStage:'validation',failureReason:reason,
 });
 assert.ok(!JSON.stringify(failure).includes(answer));
});

for(const length of [8,240])test('valid literal evidence boundary remains accepted: '+length,()=>{
 const quote='x'.repeat(length),context={...input(),answer:quote};
 const raw=output({strengths:[],weaknesses:[],assessmentBasis:{questionQuote:'JavaScript',strengths:[],weaknesses:[]},answerEvidence:[quote],feedback:`For JavaScript, the excerpt "${quote}" needs a concrete example and an explanation of the result.`});
 assert.equal(evaluation.validateInterviewEvaluation(raw,context).score,raw.score);
 assert.throws(()=>evaluation.validateInterviewEvaluation({...raw,feedback:'Feedback that does not repeat any submitted evidence at all.'},context),
  error=>error.code==='EVALUATION_FEEDBACK_UNGROUNDED');
});

for(const sample of [answer,'12345678','first evidence sentence. '+ 'middle reasoning and examples. '.repeat(20)+' final answer conclusion.',
 '  A literal quote with \"quotation\" and unicode əşç.\nAnother exact sentence.  ','x'.repeat(6000)])
for(const type of ['technical','behavioral'])test('bounded prompt evidence is literal and schema-valid: '+type+'/'+sample.length,()=>{
 const context={...input(),answer:sample,interviewType:type};const prompt=evaluation.createInterviewEvaluationPrompt(context);
 const line=prompt.split('\n').find(line=>line.startsWith('SOURCE REFERENCES (untrusted excerpts): '));
 const catalog=JSON.parse(line.slice(line.indexOf(': ')+2));
 const options=Object.entries(catalog).filter(([id])=>id.startsWith('A')).map(([,quote])=>quote);const normalized=sample.replace(/\s+/g,' ').trim();
 assert.deepEqual(catalog,{...evaluation.createInterviewEvidenceCatalog(context)});
 assert.ok(options.length>=1&&options.length<=3);assert.equal(new Set(options).size,options.length);
 for(const quote of options){assert.ok(quote.length>=8&&quote.length<=72);assert.ok(normalized.includes(quote));}
 const shape=JSON.parse(prompt.slice(prompt.lastIndexOf('\n{')+1));
 assert.equal(shape.evidenceVersion,'refs-v2');assert.equal('assessmentBasis' in shape,false);assert.ok(prompt.includes('The exact QUESTION is the assessment scope'));
 assert.ok(prompt.includes('Do NOT output answerEvidence or assessmentBasis'));
 assert.ok(prompt.includes('Difficulty: advanced'));assert.ok(prompt.includes('Interview Type: '+type));
 assert.equal(posts,0);
});

test('evidence subreason telemetry rejects forged or private values',async()=>{
 for(const error of [new contract.InterviewEvaluationError('EVALUATION_EVIDENCE_INVALID',answer),
  new contract.InterviewEvaluationError('EVALUATION_JSON_INVALID','EVIDENCE_MISSING'),
  {code:'EVALUATION_EVIDENCE_INVALID',reason:answer}]){
  let observed;await metric.withInterviewMetrics(async()=>metric.recordInterviewEvaluationFailure(error),()=>503,value=>observed=value);
  assert.equal(observed.failureReason,undefined);assert.ok(!JSON.stringify(observed).includes(answer));
 }
});

test('a later failure cannot retain an unrelated evidence reason in telemetry',async()=>{
 let observed;await metric.withInterviewMetrics(async()=>{
  metric.recordInterviewEvaluationFailure(new contract.InterviewEvaluationError('EVALUATION_EVIDENCE_INVALID','EVIDENCE_MISSING'));
  metric.recordInterviewEvaluationFailure(new contract.InterviewEvaluationError('EVALUATION_JSON_INVALID'));
 },()=>503,value=>observed=value);
 assert.equal(observed.failureCode,'EVALUATION_JSON_INVALID');assert.equal(observed.failureReason,undefined);
});

test('completed stop inference with invalid evidence preserves pending state and permits explicit retry',async()=>{
 records.set(interview,row(interview,owner,'technical'));
 const initial=clone(records.get(interview));
 global.fetch=async()=>{posts++;return new Response(JSON.stringify({
  response:JSON.stringify(output({answerEvidence:['PRIVATE fabricated evidence']})),finish_reason:'stop',
  usage:{prompt_tokens:808,completion_tokens:325},diagnostics:{stage:'completed',inferenceDispatched:true},
 }));};
 const response=await invoke();assert.equal(response.statusCode,503);
 assert.equal(posts,1);assert.equal(telemetry[0].failureCode,'EVALUATION_EVIDENCE_INVALID');
 assert.equal(telemetry[0].failureReason,'EVIDENCE_NOT_VERBATIM');assert.equal(telemetry[0].failureStage,'validation');
 assert.equal(telemetry[0].proxyFailureStage,'completed');assert.equal(telemetry[0].inferenceDispatched,true);
 assert.equal(telemetry[0].promptTokens,808);assert.equal(telemetry[0].completionTokens,325);
 assert.equal(telemetry[0].retries,0);assert.equal(telemetry[0].persistenceMs,0);
 assert.deepEqual(records.get(interview).answers,initial.answers);assert.deepEqual(skills,[]);
 assert.equal(records.get(interview).evaluationLease,undefined);
 assert.deepEqual(Object.keys(response.body).sort(),['message','success']);
 const safe=JSON.stringify(telemetry)+JSON.stringify(response.body);
 for(const value of [answer,questionText,'PRIVATE fabricated evidence'])assert.ok(!safe.includes(value));
 global.fetch=async()=>{posts++;return new Response(JSON.stringify({response:JSON.stringify(output()),finish_reason:'stop'}));};
 // A second explicit caller action, never an automatic inference retry.
 const retried=await invoke();assert.equal(retried.statusCode,200);assert.equal(posts,2);
 assert.equal(records.get(interview).answers[0].answerText,answer);assert.equal(skills.length,1);
});

test('impossible evidence input fails before dispatch with a safe input code',async()=>{
 await assert.rejects(evaluation.evaluateInterviewAnswer({...input(),answer:'a       b'}),error=>error.code==='EVALUATION_INPUT_INVALID');
 assert.equal(posts,0);
});

test('evaluation preserves inference budget and public shape without fallback fields',async()=>{
 records.set(interview,row(interview,owner,'technical'));
 const response=await invoke();assert.equal(response.statusCode,200);assert.equal(posts,1);
 assert.equal(payloads[0].request_budget_ms,60000);assert.equal(payloads[0].max_tokens,1024);
 assert.deepEqual(Object.keys(clone(response.body).data.evaluation).sort(),['score','technicalAccuracy','completeness','communication','strengths','weaknesses','feedback','improvedAnswer'].sort());
 assert.equal(telemetry[0].failureCode,undefined);assert.equal(telemetry[0].retries,0);
 assert.equal(skills.length,1);assert.ok(telemetry[0].persistenceMs>0);
});

for(const raw of [JSON.stringify(output()),'{truncated'])test('truncation rejects before persistence even when parseable: '+raw.length,async()=>{
 global.fetch=async()=>{posts++;return new Response(JSON.stringify({response:raw,finish_reason:'length',diagnostics:{stage:'completed',inferenceDispatched:true}}));};
 const result=await invoke();assert.equal(result.statusCode,503);assert.equal(posts,1);
 assert.equal(telemetry[0].failureCode,'EVALUATION_OUTPUT_TRUNCATED');assert.equal(telemetry[0].failureStage,'validation');
 assert.equal(telemetry[0].inferenceDispatched,true);assert.equal(telemetry[0].persistenceMs,0);assert.equal(telemetry[0].retries,0);
 assert.equal(records.get(interview).answers[0].evaluationStatus,'pending');assert.equal(records.get(interview).answers[0].answerText,undefined);
 assert.equal(records.get(interview).evaluationLease,undefined);assert.deepEqual(skills,[]);
});

for(const [code,stage,dispatched,status,expected,uncertain] of [
 ['QWEN_MODEL_UNAVAILABLE','readiness',false,503,'EVALUATION_MODEL_UNAVAILABLE',false],
 ['GENERATION_EXPIRED','queue',false,504,'EVALUATION_TIMEOUT',false],
 ['QWEN_TIMEOUT','inference',true,504,'EVALUATION_TIMEOUT',true],
 ['QWEN_TRANSPORT_FAILED','inference',true,502,'EVALUATION_TRANSPORT_FAILED',true],
 ['QWEN_PROXY_FAILED','inference',true,500,'EVALUATION_TRANSPORT_FAILED',true],
 ['QWEN_RESPONSE_INVALID_JSON','response',true,502,'EVALUATION_JSON_INVALID',false],
 ['QWEN_RESPONSE_EMPTY','response',true,502,'EVALUATION_JSON_MISSING',false],
])test('safe proxy classification and lease state: '+code,async()=>{
 global.fetch=async()=>{posts++;return new Response(JSON.stringify({detail:{code,stage,inferenceDispatched:dispatched,message:'PRIVATE upstream answer and JWT'}}),{status});};
 const response=await invoke();assert.equal(response.statusCode,503);assert.equal(posts,1);
 assert.equal(telemetry[0].failureCode,expected);assert.equal(telemetry[0].proxyFailureCode,code);
 assert.equal(telemetry[0].proxyFailureStage,stage);assert.equal(telemetry[0].inferenceDispatched,dispatched);
 assert.equal(telemetry[0].transportUncertain,uncertain);assert.equal(!!records.get(interview).evaluationLease,uncertain);
 assert.equal(telemetry[0].persistenceMs,0);assert.equal(telemetry[0].retries,0);assert.deepEqual(skills,[]);
 assert.ok(!JSON.stringify(telemetry).includes('PRIVATE'));assert.ok(!JSON.stringify(response.body).includes('PRIVATE'));
 if(!dispatched)assert.ok(!response.body.message.includes('completion is uncertain'));
});

test('unreachable proxy retains uncertain dispatch instead of falsely reporting zero model calls',async()=>{
 global.fetch=async()=>{posts++;throw Error('PRIVATE connection failure');};await invoke();
 assert.equal(telemetry[0].failureCode,'EVALUATION_TRANSPORT_FAILED');assert.equal(telemetry[0].inferenceDispatched,'unknown');
 assert.equal(telemetry[0].transportUncertain,true);assert.ok(records.get(interview).evaluationLease);assert.equal(posts,1);
});

test('unstructured gateway timeout remains quarantined even when JSON parsing fails',async()=>{
 global.fetch=async()=>{posts++;return new Response('PRIVATE gateway failure',{status:504});};await invoke();
 assert.equal(telemetry[0].transportUncertain,true);assert.ok(records.get(interview).evaluationLease);assert.equal(posts,1);
});

test('legacy 5xx without dispatch diagnostics remains uncertain and is not automatically retried',async()=>{
 global.fetch=async()=>{posts++;return new Response(JSON.stringify({detail:'Unavailable'}),{status:503});};await invoke();
 assert.equal(telemetry[0].inferenceDispatched,'unknown');assert.equal(telemetry[0].transportUncertain,true);
 assert.ok(records.get(interview).evaluationLease);assert.equal(posts,1);
});

test('proxy diagnostic fields are bounded and never echo arbitrary private fields',async()=>{
 let result;await metric.withInterviewMetrics(async()=>{
  metric.recordInterviewProxyDiagnostics({code:'PRIVATE',stage:'PRIVATE',inferenceDispatched:false,answer:'PRIVATE'});
 },()=>503,value=>{result=value;});
 assert.equal(result.proxyFailureCode,undefined);assert.equal(result.proxyFailureStage,undefined);
 assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
function row(id=interview,user=owner,type='behavioral',difficulty='advanced'){
  questions.set(question,{_id:question,text:questionText,interviewType:type,difficulty,category:'frontend-developer',tags:['JavaScript']});
  return {_id:id,user,category:'frontend-developer',difficulty:'beginner',interviewType:'technical',status:'in_progress',answers:[{question,questionText,evaluationStatus:'pending'}]};
}
function query(value){const promise=Promise.resolve(value);promise.select=promise.lean=promise.maxTimeMS=promise.sort=promise.limit=()=>promise;return promise;}
function document(stored){
  const value=clone(stored);
  Object.defineProperty(value,'save',{value:async options=>{
    assert.equal(options.session,inTransaction);assert.ok(inTransaction,'Interview save must share the evidence transaction');
    const current=records.get(String(value._id)),lease=current.evaluationLease;
    records.set(String(value._id),{...clone(value),...(lease?{evaluationLease:lease}:{})});return value;
  }});return value;
}
Interview.findOne=filter=>{queries++;const value=records.get(String(filter._id));return query(value&&String(value.user)===String(filter.user)?document(value):null);};
Question.findById=id=>{queries++;return query(questions.get(String(id))||null);};
Interview.collection.updateOne=async(filter,update)=>{
  const stored=records.get(String(filter._id));if(!stored||String(stored.user)!==String(filter.user))return {modifiedCount:0};
  if(update.$set?.evaluationLease){
    assert.equal(stored.status,filter.status);
    if(stored.answers.find(a=>String(a.question)===String(filter.answers.$elemMatch.question))?.evaluationStatus==='completed')return {modifiedCount:0};
    if(stored.evaluationLease&&(new Date(stored.evaluationLease.until)>new Date()||stored.evaluationLease.dispatched!==false))return {modifiedCount:0};
    stored.evaluationLease=clone(update.$set.evaluationLease);return {modifiedCount:1};
  }
  if(update.$set?.['evaluationLease.dispatched']){
    if(stored.evaluationLease?.token!==filter['evaluationLease.token']||stored.evaluationLease.dispatched!==false||new Date(stored.evaluationLease.until)<=new Date())return {modifiedCount:0};
    stored.evaluationLease.dispatched=true;return {modifiedCount:1};
  }
  if(stored.evaluationLease?.token!==filter['evaluationLease.token'])return {modifiedCount:0};
  delete stored.evaluationLease;return {modifiedCount:1};
};
Interview.collection.findOne=async filter=>{
  const stored=records.get(String(filter._id));
  return stored&&stored.status===filter.status&&String(stored.user)===String(filter.user)&&stored.evaluationLease?.token===filter['evaluationLease.token']&&new Date(stored.evaluationLease.until)>new Date()?{_id:stored._id}:null;
};
mongoose.connection.transaction=async work=>{
  const previous=clone([...records]),previousSkills=clone(skills),session={inTransaction:()=>true};inTransaction=session;
  try{return await work(session);}catch(error){records=new Map(previous);skills=previousSkills;throw error;}finally{inTransaction=undefined;}
};
evidence.recordInterviewSkillEvidence=async input=>{
  assert.equal(input.session,inTransaction);assert.ok(inTransaction,'Evidence must share the interview transaction');
  if(input.interviewType==='technical')skills.push({interview:String(input.interviewId),question:String(input.questionId),score:input.score});
  if(failPersistence)throw Error('Isolated skill persistence failure');return [];
};
async function invoke(id=interview,user=owner,text=answer){
  const res={statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
  await controller.submitInterviewAnswerController({user:{_id:new mongoose.Types.ObjectId(user)},params:{id},body:{questionId:question,answerText:text}},res,error=>{throw error;});return res;
}
test.beforeEach(()=>{
  records=new Map();questions=new Map();skills=[];posts=queries=0;telemetry=[];payloads=[];failPersistence=failTransport=false;inTransaction=undefined;
  records.set(interview,row());
  console.info=(label,value)=>{if(label==='[Interview Evaluation Performance]')telemetry.push(JSON.parse(value));};console.log=console.error=()=>{};
  global.fetch=async(url,request)=>{assert.equal(new URL(url).pathname,'/generate');posts++;payloads.push(JSON.parse(request.body));await new Promise(resolve=>setTimeout(resolve,8));if(failTransport)throw Object.assign(Error('Synthetic transport failure'),{name:'AbortError'});return new Response(JSON.stringify({response:JSON.stringify(output()),usage:{prompt_tokens:120,completion_tokens:80,total_tokens:200},finish_reason:'stop'}));};
});
test.afterEach(()=>{console.info=originalInfo;console.error=originalError;console.log=originalLog;});

for(const type of ['technical','behavioral'])for(const difficulty of ['beginner','intermediate','advanced','senior'])test(`legacy metadata resolves actual ${type}/${difficulty}, not session defaults`,async()=>{
  records.set(interview,row(interview,owner,type,difficulty));
  const response=await invoke();assert.equal(response.statusCode,200);assert.equal(posts,1);
  assert.ok(payloads[0].message.includes('Interview Type: '+type));assert.ok(payloads[0].message.includes('Difficulty: '+difficulty));
  assert.equal(skills.length,type==='technical'?1:0);assert.equal(records.get(interview).status,'completed');
  assert.equal(response.body.data.evaluation.score,78);assert.equal(response.body.data.overallScore,78);
  assert.equal(telemetry[0].attempts,1);assert.equal(telemetry[0].retries,0);assert.equal(telemetry[0].promptTokens,120);assert.equal(telemetry[0].completionTokens,80);
  assert.equal(payloads[0].correlation_id,telemetry[0].correlationId);assert.ok(telemetry[0].success);
});
test('new immutable question snapshot works even after source question removal',async()=>{
  const stored=records.get(interview);stored.answers[0].questionSnapshot={text:questionText,interviewType:'behavioral',difficulty:'senior',category:'frontend-developer',tags:[]};questions.clear();
  assert.equal((await invoke()).statusCode,200);assert.equal(queries,1);assert.ok(payloads[0].message.includes('Difficulty: senior'));
});
test('unreliable legacy metadata fails explicitly before inference',async()=>{
  questions.get(question).text='A different edited question';
  const response=await invoke();assert.equal(response.statusCode,409);assert.equal(posts,0);assert.equal(skills.length,0);assert.equal(records.get(interview).answers[0].evaluationStatus,'pending');
});
test('concurrent duplicates share durable admission and only one inference is dispatched',async()=>{
  const responses=await Promise.all([invoke(),invoke()]);assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,409]);assert.equal(posts,1);assert.equal(records.get(interview).answers[0].evaluationStatus,'completed');
  assert.equal((await invoke()).statusCode,400);assert.equal(posts,1,'Completed interview cannot be reevaluated');
});
test('foreign owners cannot claim or evaluate a session',async()=>{
  assert.equal((await invoke(interview,other)).statusCode,404);assert.equal(posts,0);assert.equal(records.get(interview).evaluationLease,undefined);
});
test('different sessions and users can infer independently without a global submission mutex',async()=>{
  const second=String(f.id(502));records.set(second,row(second,other));
  // Exercise admission alone: fake transactional storage deliberately serializes commits.
  let entered=0;
  await Promise.all([[owner,interview],[other,second]].map(([user,id])=>submission.withInterviewSubmission(user,id,question,async()=>{entered++;await new Promise(resolve=>setTimeout(resolve,5));})));
  assert.equal(entered,2);
});
test('transport uncertainty is quarantined beyond expiry; only verified operator recovery allows another attempt',async()=>{
  failTransport=true;assert.equal((await invoke()).statusCode,503);assert.equal(posts,1);assert.ok(records.get(interview).evaluationLease);
  assert.equal((await invoke()).statusCode,409);assert.equal(posts,1);
  records.get(interview).evaluationLease.until=new Date(Date.now()-1);failTransport=false;
  const blocked=await invoke();assert.equal(blocked.statusCode,409);assert.equal(blocked.body.code,'INTERVIEW_RECOVERY_REQUIRED');assert.equal(posts,1);
  // Isolated operator confirmation: no live lease is cleared by this test or application code.
  delete records.get(interview).evaluationLease;
  assert.equal((await invoke()).statusCode,200);assert.equal(posts,2);assert.equal(records.get(interview).evaluationLease,undefined);
});
test('restart simulation recovers an expired durable lease and fences a live lease',async()=>{
  records.get(interview).evaluationLease={token:'old-process',question,until:new Date(Date.now()+10000),dispatched:false};
  assert.equal((await invoke()).statusCode,409);assert.equal(posts,0);
  records.get(interview).evaluationLease.until=new Date(Date.now()-1);
  assert.equal((await invoke()).statusCode,200);assert.equal(posts,1);
});
test('evidence failure rolls back both interview and evidence, allowing an explicit retry',async()=>{
  records.set(interview,row(interview,owner,'technical'));failPersistence=true;
  assert.equal((await invoke()).statusCode,503);assert.equal(records.get(interview).status,'in_progress');assert.equal(records.get(interview).answers[0].answerText,undefined);assert.deepEqual(skills,[]);
  failPersistence=false;assert.equal((await invoke()).statusCode,200);assert.equal(skills.length,1);
});
test('conditional lease conflict rejects a stale worker without evidence persistence',async()=>{
  await assert.rejects(submission.withInterviewSubmission(owner,interview,question,async()=>{
    records.get(interview).evaluationLease.token='replacement-process';
    return submission.commitInterviewSubmission(async()=>{throw Error('Must not commit stale result');});
  }),error=>error.code==='INTERVIEW_LEASE_EXPIRED');assert.deepEqual(skills,[]);
});
for(const [name,invalid] of [
  ['missing score',output({score:undefined})],['non-numeric score',output({score:'80'})],['out of range',output({technicalAccuracy:101})],
  ['empty feedback',output({feedback:''})],['empty improved answer',output({improvedAnswer:''})],['invalid observations',output({strengths:[12]})],
  ['invented quote',output({answerEvidence:['I am certified in AWS']})],['missing quote',output({answerEvidence:[]})],
  ['unrelated feedback',output({feedback:'This generic feedback is unrelated and offers no evidence from the answer.'})],
  ['unsupported mastery',output({strengths:['You are an expert in JavaScript development.']})],
])test('invalid AI contract rejects '+name,()=>{
  assert.throws(()=>evaluation.validateInterviewEvaluation(invalid,{question:questionText,answer,roleSlug:'frontend-developer',difficulty:'advanced',interviewType:'technical'}));
});
test('empty strengths remain empty instead of fabricated positive claims',()=>{
  const result=evaluation.validateInterviewEvaluation(output({strengths:[],assessmentBasis:{questionQuote:'JavaScript',strengths:[],weaknesses:['example']}}),{question:questionText,answer,roleSlug:'frontend-developer',difficulty:'advanced',interviewType:'technical'});assert.deepEqual(result.strengths,[]);assert.equal('answerEvidence' in result,false,'Private validation contract does not alter public response');
});
test('malformed AI output fails without saving an answer or evidence',async()=>{
  global.fetch=async()=>{posts++;return new Response(JSON.stringify({response:'{invalid JSON',finish_reason:'stop'}));};
  assert.equal((await invoke()).statusCode,503);assert.equal(posts,1);assert.equal(records.get(interview).answers[0].answerText,undefined);assert.deepEqual(skills,[]);assert.equal(records.get(interview).evaluationLease,undefined);
  assert.equal(telemetry[0].failureCode,'EVALUATION_JSON_INVALID');
});
test('telemetry is private, scoped and counts validation/persistence without prompts',async()=>{
  await invoke();const text=JSON.stringify(telemetry);assert.ok(!text.includes(answer));assert.ok(!text.includes(owner));assert.ok(!text.includes(questionText));assert.ok(!text.includes('JWT'));
  assert.ok(telemetry[0].contextMs>0);assert.ok(telemetry[0].validationMs>0);assert.ok(telemetry[0].persistenceMs>0);assert.ok(telemetry[0].qwenRoundtripMs>0);assert.equal(telemetry[0].status,200);
  assert.ok(telemetry[0].totalMs>=telemetry[0].qwenRoundtripMs);
});

test('in-progress success preserves response shape and returns next stored question without extra inference',async()=>{
  const next=String(f.id(602));records.get(interview).answers.push({question:next,questionText:'Explain event delegation.',evaluationStatus:'pending'});
  const response=await invoke();assert.equal(response.statusCode,200);assert.equal(response.body.data.completed,false);assert.equal(String(response.body.data.nextQuestion.questionId),next);
  assert.equal(posts,1);assert.equal(records.get(interview).status,'in_progress');assert.equal(records.get(interview).answers[1].answerText,undefined);assert.equal('answerEvidence' in response.body.data.evaluation,false);
});
test('actual skill-evidence adapter joins the supplied transaction instead of creating a separate commit',async()=>{
  const {UserSkillProfile}=f.load('models/UserSkillProfile');
  const previousFind=UserSkillProfile.findOne,previousSave=UserSkillProfile.prototype.save;
  const profile=new UserSkillProfile({user:f.ownerA,skills:[],totalEvidenceCount:0}),session={inTransaction:()=>true};let saved=0;
  UserSkillProfile.findOne=()=>{const value=query(profile);value.session=s=>{assert.equal(s,session);return value;};return value;};
  UserSkillProfile.prototype.save=async function(options){assert.equal(options.session,session);saved++;return this;};
  try{await realRecordEvidence({userId:f.ownerA,interviewId:f.id(501),questionId:f.id(601),questionTags:['JavaScript'],score:78,technicalAccuracy:80,interviewType:'technical',category:'frontend-developer',session});assert.equal(saved,1);assert.equal(profile.skills.length,1);assert.equal(profile.skills[0].evidence.length,1);}
  finally{UserSkillProfile.findOne=previousFind;UserSkillProfile.prototype.save=previousSave;}
});
test('new interview creation records each selected question metadata, including behavioral/stretch variants',async()=>{
  const previousFind=Interview.find,previousCreate=Interview.create,previousAggregate=Question.aggregate;
  const profile=f.load('services/careerSkillProfileService'),previousProfile=profile.buildCareerSkillProfile;
  let captured,counter=700;
  Interview.find=()=>query([]);profile.buildCareerSkillProfile=async()=>({verifiedSkills:[],strongestSkills:[]});
  Question.aggregate=async stages=>Array.from({length:stages[1].$sample.size},()=>({_id:f.id(counter++),text:'Describe the chosen competency.',category:'frontend-developer',difficulty:stages[0].$match.difficulty,interviewType:stages[0].$match.interviewType,tags:['JavaScript']}));
  Interview.create=async value=>{captured=value;return {_id:f.id(800),...value};};
  const res={statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
  try{await controller.startInterviewController({user:{_id:f.ownerA},body:{roleSlug:'frontend-developer'}},res,error=>{throw error;});assert.equal(res.statusCode,201);assert.equal(captured.answers.length,6);
    assert.equal(captured.answers.filter(a=>a.questionSnapshot.interviewType==='behavioral').length,3);
    assert.ok(captured.answers.every(a=>a.questionSnapshot.text===a.questionText&&a.questionSnapshot.category==='frontend-developer'&&a.questionSnapshot.difficulty));assert.equal(posts,0);
  }finally{Interview.find=previousFind;Interview.create=previousCreate;Question.aggregate=previousAggregate;profile.buildCareerSkillProfile=previousProfile;}
});

// Public example supplied for regression; no real candidate or production output is used.
const flawedQuestion='Under what precise conditions does the CAP theorem force a compromise between consistency and availability in a cluster running Dependency Injection with Hilt and Dagger?';
const premiseAnswer='CAP concerns network partitions in distributed systems. Hilt and Dagger are dependency injection frameworks, not distributed clusters. Their coexistence does not imply a CAP trade-off.';
function premiseEvaluation(overrides={}){
 return output({score:94,technicalAccuracy:96,completeness:94,communication:92,
  strengths:['The statement "CAP concerns network partitions" correctly identifies the condition rather than accepting the flawed premise.'],
  weaknesses:[],feedback:'For the CAP theorem, "CAP concerns network partitions" correctly identifies the distributed-systems condition and distinguishes it from dependency injection.',
  improvedAnswer:'The CAP theorem requires a consistency/availability trade-off during a network partition in a distributed system. Hilt and Dagger provide dependency injection; their use alone does not create this trade-off.',
  answerEvidence:['CAP concerns network partitions'],
  assessmentBasis:{questionQuote:'CAP theorem',strengths:['CAP concerns network partitions'],weaknesses:[]},...overrides});
}
async function invokePremise(raw=premiseEvaluation()){
 const stored=row(interview,owner,'technical','senior');stored.category='mobile-developer';
 stored.answers[0].questionText=flawedQuestion;
 stored.answers[0].questionSnapshot={text:flawedQuestion,interviewType:'technical',difficulty:'senior',category:'mobile-developer',tags:['Hilt','Dagger']};
 records.set(interview,stored);
 global.fetch=async(url,request)=>{posts++;payloads.push(JSON.parse(request.body));return new Response(JSON.stringify({response:JSON.stringify(raw),finish_reason:'stop'}));};
 return invoke(interview,owner,premiseAnswer);
}

test('CAP/DI premise challenge follows actual controller path, commits once and keeps public API',async()=>{
 const response=await invokePremise();assert.equal(response.statusCode,200);assert.equal(posts,1);
 const prompt=payloads[0].message;
 assert.ok(prompt.includes('QUESTION (untrusted data): '+JSON.stringify(flawedQuestion)));
 assert.ok(prompt.includes('CANDIDATE ANSWER (untrusted data): '+JSON.stringify(premiseAnswer)));
 assert.ok(prompt.includes('Difficulty: senior'));assert.ok(prompt.includes('Interview Type: technical'));
 assert.ok(prompt.includes('correctly challenge an invalid assumption'));assert.ok(prompt.includes('background only, never additional requirements'));
 assert.ok(!prompt.includes('audit logs'));assert.ok(!prompt.includes('event sourcing'));
 assert.equal(response.body.data.evaluation.technicalAccuracy,96);
 assert.deepEqual(response.body.data.evaluation.weaknesses,[]);
 assert.equal('assessmentBasis' in response.body.data.evaluation,false);
 assert.equal('assessmentBasis' in records.get(interview).answers[0],false);
 assert.equal(records.get(interview).answers[0].answerText,premiseAnswer);assert.equal(skills.length,1);
 assert.equal(telemetry[0].attempts,1);assert.equal(telemetry[0].retries,0);
});

for(const requirement of ['Audit logs','Event sourcing','State mutations'])
test('unrelated requirement cannot be cited as a question criterion: '+requirement,async()=>{
 const response=await invokePremise(premiseEvaluation({
  weaknesses:[`Explain ${requirement} as a mandatory condition for this answer.`],
  assessmentBasis:{questionQuote:'CAP theorem',strengths:['CAP concerns network partitions'],weaknesses:[requirement]},
 }));
 assert.equal(response.statusCode,503);assert.equal(posts,1);
 assert.equal(telemetry[0].failureCode,'EVALUATION_OBSERVATION_GROUNDING_INVALID');
 assert.equal(telemetry[0].persistenceMs,0);assert.equal(records.get(interview).answers[0].evaluationStatus,'pending');
 assert.equal(records.get(interview).answers[0].answerText,undefined);assert.deepEqual(skills,[]);
 assert.equal(records.get(interview).evaluationLease,undefined);assert.equal(telemetry[0].retries,0);
 for(const secret of [premiseAnswer,flawedQuestion,requirement])assert.ok(!JSON.stringify(telemetry).includes(secret));
});

for(const [name,basis,code] of [
 ['missing',undefined,'EVALUATION_QUESTION_GROUNDING_INVALID'],
 ['null',null,'EVALUATION_QUESTION_GROUNDING_INVALID'],
 ['array',[],'EVALUATION_QUESTION_GROUNDING_INVALID'],
 ['foreign question',{questionQuote:'database transactions',strengths:[],weaknesses:[]},'EVALUATION_QUESTION_GROUNDING_INVALID'],
 ['missing strengths',{questionQuote:'JavaScript',weaknesses:['example']},'EVALUATION_OBSERVATION_GROUNDING_INVALID'],
 ['fabricated strength',{questionQuote:'JavaScript',strengths:['Expert on distributed clusters'],weaknesses:['example']},'EVALUATION_OBSERVATION_GROUNDING_INVALID'],
 ['reference count mismatch',{questionQuote:'JavaScript',strengths:[],weaknesses:['example']},'EVALUATION_OBSERVATION_GROUNDING_INVALID'],
 ['nonstring reference',{questionQuote:'JavaScript',strengths:[{}],weaknesses:['example']},'EVALUATION_OBSERVATION_GROUNDING_INVALID'],
 ['unlinked strength quote',{questionQuote:'JavaScript',strengths:['outer function returns'],weaknesses:['example']},'EVALUATION_OBSERVATION_GROUNDING_INVALID'],
])test('assessment source contract fails closed: '+name,async()=>{
 global.fetch=async()=>{posts++;return new Response(JSON.stringify({response:JSON.stringify(output({assessmentBasis:basis})),finish_reason:'stop'}));};
 const response=await invoke();assert.equal(response.statusCode,503);assert.equal(posts,1);
 assert.equal(telemetry[0].failureCode,code);assert.equal(telemetry[0].failureStage,'validation');
 assert.equal(telemetry[0].persistenceMs,0);assert.deepEqual(skills,[]);
 assert.equal(records.get(interview).answers[0].answerText,undefined);
});

test('missing question scope in improved answer is rejected despite valid answer evidence',async()=>{
 const response=await invokePremise(premiseEvaluation({improvedAnswer:'Use an audit log and event sourcing to record state changes and increase system reliability.'}));
 assert.equal(response.statusCode,503);assert.equal(telemetry[0].failureCode,'EVALUATION_QUESTION_GROUNDING_INVALID');
 assert.equal(telemetry[0].persistenceMs,0);assert.equal(posts,1);
});

test('question quote cannot be removed from feedback while retaining only answer evidence',async()=>{
 const response=await invokePremise(premiseEvaluation({feedback:'The phrase "CAP concerns network partitions" is the only statement being considered for this assessment.'}));
 assert.equal(response.statusCode,503);assert.equal(telemetry[0].failureCode,'EVALUATION_QUESTION_GROUNDING_INVALID');
 assert.equal(posts,1);assert.deepEqual(skills,[]);
});

test('weak answer can receive a grounded low score without invented praise',async()=>{
 const context={...input(),answer:'A closure copies every variable value and cannot access outer scope.'};
 const raw=output({score:18,technicalAccuracy:10,completeness:20,communication:35,strengths:[],
  weaknesses:['For "closures", distinguish lexical environment access from copying every variable.'],
  feedback:'For JavaScript, "A closure copies every variable value" incorrectly describes lexical environment access as value copying.',
  answerEvidence:['A closure copies every variable value'],
  assessmentBasis:{questionQuote:'JavaScript',strengths:[],weaknesses:['closures']}});
 global.fetch=async()=>{posts++;return new Response(JSON.stringify({response:JSON.stringify(raw),finish_reason:'stop'}));};
 const result=await evaluation.evaluateInterviewAnswer(context);assert.equal(result.score,18);assert.deepEqual(result.strengths,[]);
 assert.equal(posts,1);assert.equal('assessmentBasis' in result,false);
});

test('different flawed premise is not handled using a hardcoded CAP exception',async()=>{
 const context={...input(),question:'Why does binary search correctly find a value in every unsorted array?',
  answer:'Binary search requires sorted input. It is not guaranteed to find a value in an unsorted array.'};
 const raw=output({score:95,technicalAccuracy:98,completeness:95,communication:93,
  strengths:['The observation "Binary search requires sorted input" correctly challenges the premise.'],weaknesses:[],
  feedback:'For binary search, "Binary search requires sorted input" correctly rejects the universal unsorted-array premise.',
  improvedAnswer:'For binary search to reliably eliminate half the search space each step, the input must be sorted with a compatible ordering. An unsorted array does not guarantee correctness.',
  answerEvidence:['Binary search requires sorted input'],
  assessmentBasis:{questionQuote:'binary search',strengths:['Binary search requires sorted input'],weaknesses:[]}});
 global.fetch=async()=>{posts++;return new Response(JSON.stringify({response:JSON.stringify(raw),finish_reason:'stop'}));};
 assert.equal((await evaluation.evaluateInterviewAnswer(context)).score,95);assert.equal(posts,1);
 const prompt=evaluation.createInterviewEvaluationPrompt(context);assert.ok(!prompt.includes('CAP theorem'));
});

test('snapshot text mismatch and corrupt type fail before inference, never replace displayed question',async()=>{
 for(const replacement of [{text:'A stale question',interviewType:'technical'}, {text:questionText,interviewType:'invented'}]){
  const stored=row();stored.answers[0].questionSnapshot={text:questionText,interviewType:'technical',difficulty:'advanced',category:'mobile-developer',tags:[],...replacement};
  records.set(interview,stored);const response=await invoke();assert.equal(response.statusCode,409);assert.equal(posts,0);
  assert.deepEqual(skills,[]);assert.equal(records.get(interview).answers[0].evaluationStatus,'pending');
 }
});

function referenceOutput(context=input(),overrides={}){
 const catalog=evaluation.createInterviewEvidenceCatalog(context);
 const a=Object.keys(catalog).find(id=>id.startsWith('A')),q=Object.keys(catalog).find(id=>id.startsWith('Q'));
 return output({evidenceVersion:'refs-v1',answerEvidence:[a],
  assessmentBasis:{questionQuote:q,strengths:[a],weaknesses:[q]},
  strengths:[`The statement [${a}] describes the mechanism being assessed.`],
  weaknesses:[`For [${q}], provide a concrete example and explain the resulting behavior.`],
  feedback:`For [${q}], the statement [${a}] describes the mechanism; demonstrate its behavior with a concrete example.`,
  improvedAnswer:`For [${q}], explain the mechanism, show a concrete example and justify its behavior using the relevant reasoning.`,...overrides});
}

for(const type of ['technical','behavioral'])test('source references resolve authentic text through controller and atomic commit: '+type,async()=>{
 records.set(interview,row(interview,owner,type));const raw=referenceOutput();
 global.fetch=async()=>{posts++;return new Response(JSON.stringify({response:JSON.stringify(raw),finish_reason:'stop'}));};
 const response=await invoke();assert.equal(response.statusCode,200);assert.equal(posts,1);
 const result=response.body.data.evaluation,catalog=evaluation.createInterviewEvidenceCatalog(input());
 assert.ok(result.feedback.includes(catalog.A1));assert.ok(result.feedback.includes(catalog.Q1));
 assert.ok(result.strengths[0].includes(catalog.A1));assert.ok(result.weaknesses[0].includes(catalog.Q1));
 assert.ok(!result.feedback.includes('[A1]'));assert.ok(!result.improvedAnswer.includes('[Q1]'));
 for(const key of ['answerEvidence','assessmentBasis','evidenceVersion']){
  assert.equal(key in result,false);assert.equal(key in records.get(interview).answers[0],false);
 }
 assert.equal(records.get(interview).answers[0].answerText,answer);assert.equal(skills.length,type==='technical'?1:0);
 assert.equal(telemetry[0].attempts,1);assert.equal(telemetry[0].retries,0);
});

for(const sample of ['12345678','  A literal answer\r\nwith repeated   whitespace and enough content. ',
 'Cafe\u0301 and Café remain distinct source representations, not model-edited quotations.',
 'Unicode əşç, smart “quotes”, ASCII "quotes", emoji 🚀 and nonbreaking\u00a0space remain authentic.',
 'Repeated authentic phrase. '.repeat(240), '🚀'.repeat(3000)])
test('reference catalog preserves literal source, deduplicates and stays bounded: '+sample.length,()=>{
 const context={...input(),answer:sample};const catalog=evaluation.createInterviewEvidenceCatalog(context);
 assert.deepEqual(catalog,evaluation.createInterviewEvidenceCatalog(context));
 const entries=Object.entries(catalog),normalized=sample.replace(/\s+/g,' ').trim();
 const a=entries.filter(([id])=>id.startsWith('A'));
 assert.ok(a.length>=1&&a.length<=3);assert.equal(new Set(a.map(([,quote])=>quote)).size,a.length);
 for(const [id,quote] of entries){assert.match(id,/^[AQ][1-3]$/);assert.ok(quote.length<=72);
  assert.ok((id.startsWith('A')?normalized:context.question).includes(quote));
  assert.ok(!/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(quote),'No broken surrogate pairs');
 }
 const raw=referenceOutput(context),result=evaluation.validateInterviewEvaluation(raw,context);
 assert.ok(result.feedback.includes(catalog.A1));assert.equal(raw.feedback.includes('[A1]'),true,'Model object is not mutated');
});

for(const [name,overrides,code,reason] of [
 ['unknown answer ID',{answerEvidence:['A99']},'EVALUATION_EVIDENCE_INVALID','EVIDENCE_ID_INVALID'],
 ['wrong source ID',{answerEvidence:['Q1']},'EVALUATION_EVIDENCE_INVALID','EVIDENCE_ID_INVALID'],
 ['duplicate ID',{answerEvidence:['A1','A1']},'EVALUATION_EVIDENCE_INVALID','EVIDENCE_ID_INVALID'],
 ['mixed quote and ID',{answerEvidence:['A1','A closure retains access']},'EVALUATION_EVIDENCE_INVALID','EVIDENCE_ID_INVALID'],
 ['unknown version',{evidenceVersion:'refs-v9'},'EVALUATION_EVIDENCE_INVALID','EVIDENCE_MODE_INVALID'],
 ['empty IDs',{answerEvidence:[]},'EVALUATION_EVIDENCE_INVALID','EVIDENCE_ID_INVALID'],
 ['object ID',{answerEvidence:[{id:'A1'}]},'EVALUATION_EVIDENCE_INVALID','EVIDENCE_ID_INVALID'],
 ['padded ID',{answerEvidence:[' A1 ']},'EVALUATION_EVIDENCE_INVALID','EVIDENCE_ID_INVALID'],
 ['unknown marker',{feedback:'For [Q1], the statement [A1] is assessed against the question, but an invalid [A99] must not be resolved.'},'EVALUATION_EVIDENCE_INVALID','EVIDENCE_ID_INVALID'],
 ['question from answer',{assessmentBasis:{questionQuote:'A1',strengths:['A1'],weaknesses:['Q1']}},'EVALUATION_QUESTION_GROUNDING_INVALID'],
 ['strength from question',{assessmentBasis:{questionQuote:'Q1',strengths:['Q1'],weaknesses:['Q1']}},'EVALUATION_OBSERVATION_GROUNDING_INVALID','OBSERVATION_REFERENCE_INVALID'],
 ['weakness from answer',{assessmentBasis:{questionQuote:'Q1',strengths:['A1'],weaknesses:['A1']}},'EVALUATION_OBSERVATION_GROUNDING_INVALID','OBSERVATION_REFERENCE_INVALID'],
 ['unlinked strength',{strengths:['The answer contains a description without its required source marker.']},'EVALUATION_OBSERVATION_GROUNDING_INVALID','OBSERVATION_MARKER_MISSING'],
 ['missing feedback link',{feedback:'For [Q1], the answer should contain a concrete example, but no source reference is present here.'},'EVALUATION_FEEDBACK_UNGROUNDED'],
 ['missing improved scope',{improvedAnswer:'Explain a completely different mechanism with a detailed concrete example and a limitation.'},'EVALUATION_QUESTION_GROUNDING_INVALID'],
 ['markers-only feedback',{feedback:'[A1] [Q1]'},'EVALUATION_FEEDBACK_INVALID'],
 ['markers-only strength',{strengths:['[A1]']},'EVALUATION_OBSERVATIONS_INVALID'],
 ['markers-only improvement',{improvedAnswer:'[Q1]'},'EVALUATION_IMPROVED_ANSWER_INVALID'],
])test('invalid reference output never persists or retries: '+name,async()=>{
 const initial=clone(records.get(interview).answers),raw=referenceOutput(input(),overrides);
 global.fetch=async()=>{posts++;return new Response(JSON.stringify({response:JSON.stringify(raw),finish_reason:'stop',diagnostics:{stage:'completed',inferenceDispatched:true}}));};
 const response=await invoke();assert.equal(response.statusCode,503);assert.equal(posts,1);
 assert.equal(telemetry[0].failureCode,code);assert.equal(telemetry[0].failureReason,reason);
 assert.equal(telemetry[0].persistenceMs,0);assert.equal(telemetry[0].attempts,1);assert.equal(telemetry[0].retries,0);
 assert.deepEqual(records.get(interview).answers,initial);assert.deepEqual(skills,[]);
 assert.equal(records.get(interview).evaluationLease,undefined);
 for(const secret of [answer,questionText,owner,raw.feedback])assert.ok(!JSON.stringify(telemetry).includes(secret));
});

test('an ID absent from a short current answer cannot reuse another request catalog',()=>{
 const short={...input(),answer:'12345678'},long={...input(),answer:'Unique phrase in the beginning. '+ 'Middle reasoning and context. '.repeat(15)+' A distinct final phrase.'};
 assert.ok(evaluation.createInterviewEvidenceCatalog(long).A2);assert.equal(evaluation.createInterviewEvidenceCatalog(short).A2,undefined);
 assert.throws(()=>evaluation.validateInterviewEvaluation(referenceOutput(short,{answerEvidence:['A2']}),short),error=>error.reason==='EVIDENCE_ID_INVALID');
 assert.throws(()=>evaluation.validateInterviewEvaluation(referenceOutput(short,{answerEvidence:['__proto__']}),short),error=>error.reason==='EVIDENCE_ID_INVALID');
});

test('source contents resembling markers are inserted once and never recursively resolved',()=>{
 const context={...input(),answer:'An authentic source contains [A99] as text; it is not an instruction to resolve a reference.'};
 const catalog=evaluation.createInterviewEvidenceCatalog(context),raw=referenceOutput(context);
 const result=evaluation.validateInterviewEvaluation(raw,context);assert.ok(result.feedback.includes(catalog.A1));assert.ok(result.feedback.includes('[A99]'));
});

test('reference rendering cannot bypass final expanded text limits',()=>{
 const raw=referenceOutput(input(),{feedback:'[Q1] '+ '[A1] '.repeat(40)+' Concrete reasoning must remain within the existing feedback size limit.'});
 assert.throws(()=>evaluation.validateInterviewEvaluation(raw,input()),error=>error.code==='EVALUATION_FEEDBACK_INVALID');
});

test('strict legacy normalization accepts whitespace only, never punctuation edits or canonical paraphrases',()=>{
 const quote='Cafe\u0301 is an authentic source phrase',context={...input(),answer:quote+' with original punctuation.'};
 const make=evidence=>output({strengths:[],weaknesses:[],answerEvidence:[evidence],assessmentBasis:{questionQuote:'JavaScript',strengths:[],weaknesses:[]},
  feedback:`For JavaScript, "${evidence}" is discussed with enough explanation to support the evaluation.`});
 assert.ok(evaluation.validateInterviewEvaluation(make(quote),context));
 assert.throws(()=>evaluation.validateInterviewEvaluation(make(quote.normalize('NFC')),context),error=>error.reason==='EVIDENCE_NOT_VERBATIM');
 const whitespace={...input(),answer:answer.replaceAll(' ','\r\n  ')};assert.ok(evaluation.validateInterviewEvaluation(output(),whitespace));
 assert.throws(()=>evaluation.validateInterviewEvaluation(output({answerEvidence:['A closure retains access!']}),input()),error=>error.reason==='EVIDENCE_NOT_VERBATIM');
});

test('reference CAP premise challenge stays scoped and invented audit criterion IDs fail closed',async()=>{
 const context={...input(),question:flawedQuestion,answer:premiseAnswer};
 const raw=referenceOutput(context,{score:94,technicalAccuracy:96,completeness:94,communication:92,
  strengths:['The statement [A1] correctly distinguishes the network partition condition from dependency injection.'],weaknesses:[],
  assessmentBasis:{questionQuote:'Q1',strengths:['A1'],weaknesses:[]},
  feedback:'For [Q1], the reasoning [A1] correctly challenges the premise rather than inventing a connection to dependency injection.',
  improvedAnswer:'For [Q1], a network partition in a distributed system is the relevant condition. Hilt and Dagger are dependency injection frameworks, whose use alone does not create a CAP trade-off.'});
 const response=await invokePremise(raw);assert.equal(response.statusCode,200);assert.equal(response.body.data.evaluation.technicalAccuracy,96);assert.equal(posts,1);
 assert.deepEqual(response.body.data.evaluation.weaknesses,[]);
 const bad=referenceOutput(context,{weaknesses:['Explain mandatory event sourcing and audit logs for [Q99].'],
  assessmentBasis:{questionQuote:'Q1',strengths:['A1'],weaknesses:['Q99']}});
 assert.throws(()=>evaluation.validateInterviewEvaluation(bad,context),error=>error.code==='EVALUATION_OBSERVATION_GROUNDING_INVALID');
});

test('reference output cannot bypass valid JSON truncation rejection',async()=>{
 global.fetch=async()=>{posts++;return new Response(JSON.stringify({response:JSON.stringify(referenceOutput()),finish_reason:'length'}));};
 const response=await invoke();assert.equal(response.statusCode,503);assert.equal(telemetry[0].failureCode,'EVALUATION_OUTPUT_TRUNCATED');
 assert.equal(posts,1);assert.equal(telemetry[0].persistenceMs,0);assert.deepEqual(skills,[]);
});


test('reference-mode duplicate submissions retain one inference and one committed evaluation',async()=>{
 records.set(interview,row(interview,owner,'technical'));
 global.fetch=async()=>{posts++;await new Promise(resolve=>setTimeout(resolve,8));return new Response(JSON.stringify({response:JSON.stringify(referenceOutput()),finish_reason:'stop'}));};
 const responses=await Promise.all([invoke(),invoke()]);assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,409]);
 assert.equal(posts,1);assert.equal(skills.length,1);assert.equal(records.get(interview).answers[0].evaluationStatus,'completed');
});

test('invalid reference is recoverable only by a separate explicit submission, no automatic retry',async()=>{
 records.set(interview,row(interview,owner,'technical'));
 global.fetch=async()=>{posts++;return new Response(JSON.stringify({response:JSON.stringify(referenceOutput(input(),{answerEvidence:['A99']})),finish_reason:'stop'}));};
 assert.equal((await invoke()).statusCode,503);assert.equal(posts,1);assert.equal(records.get(interview).evaluationLease,undefined);
 assert.equal(records.get(interview).answers[0].evaluationStatus,'pending');assert.equal(skills.length,0);
 global.fetch=async()=>{posts++;return new Response(JSON.stringify({response:JSON.stringify(referenceOutput()),finish_reason:'stop'}));};
 assert.equal((await invoke()).statusCode,200);assert.equal(posts,2);assert.equal(skills.length,1);
 assert.equal(telemetry[0].retries,0);assert.equal(telemetry[1].retries,0);
});

test('reference catalog contains only this request sources, not another user answer',()=>{
 const first={...input(),answer:'First isolated answer with authentic lexical context and explanation.'};
 const second={...input(),answer:'Second isolated answer with entirely separate candidate reasoning.'};
 const before={...evaluation.createInterviewEvidenceCatalog(first)};
 const current=evaluation.createInterviewEvidenceCatalog(second);
 assert.equal(Object.values(current).some(text=>text.includes('First isolated answer')),false);
 assert.deepEqual({...evaluation.createInterviewEvidenceCatalog(first)},before);
 const response=evaluation.validateInterviewEvaluation(referenceOutput(second),second);
 assert.ok(response.feedback.includes(current.A1));assert.ok(!response.feedback.includes('First isolated answer'));
});


function inlineOutput(context=input(),overrides={}){
 const raw=referenceOutput(context);delete raw.answerEvidence;delete raw.assessmentBasis;
 return {...raw,evidenceVersion:'refs-v2',...overrides};
}

for(const [name,version,overrides,reason] of [
 ['literal references absent','legacy',{assessmentBasis:{questionQuote:'JavaScript',weaknesses:['example']}},'OBSERVATION_REFERENCES_MISSING'],
 ['literal count mismatch','legacy',{assessmentBasis:{questionQuote:'JavaScript',strengths:[],weaknesses:['example']}},'OBSERVATION_REFERENCE_COUNT_MISMATCH'],
 ['literal fabricated source','legacy',{assessmentBasis:{questionQuote:'JavaScript',strengths:['invented evidence'],weaknesses:['example']}},'OBSERVATION_REFERENCE_INVALID'],
 ['literal quote missing from observation','legacy',{assessmentBasis:{questionQuote:'JavaScript',strengths:['outer function returns'],weaknesses:['example']}},'OBSERVATION_TEXT_REFERENCE_MISSING'],
 ['v1 references absent','refs-v1',{assessmentBasis:{questionQuote:'Q1',weaknesses:['Q1']}},'OBSERVATION_REFERENCES_MISSING'],
 ['v1 incorrect count','refs-v1',{assessmentBasis:{questionQuote:'Q1',strengths:[],weaknesses:['Q1']}},'OBSERVATION_REFERENCE_COUNT_MISMATCH'],
 ['v1 invalid source','refs-v1',{assessmentBasis:{questionQuote:'Q1',strengths:['Q1'],weaknesses:['Q1']}},'OBSERVATION_REFERENCE_INVALID'],
 ['v1 non-string observation','refs-v1',{strengths:[null]},'OBSERVATION_VALUE_INVALID'],
 ['v1 missing marker','refs-v1',{strengths:['The observation gives reasoning but omits the required reference marker.']},'OBSERVATION_MARKER_MISSING'],
 ['v1 reordered references','refs-v1',{strengths:['This observation is supported by [A1] and explains its meaning.','This second observation is supported by [A2] with concrete reasoning.'],assessmentBasis:{questionQuote:'Q1',strengths:['A2','A1'],weaknesses:['Q1']}},'OBSERVATION_MARKER_MISSING'],
])test('observation branch diagnostic is exact and privacy-safe: '+name,async()=>{
 const raw=version==='legacy'?output(overrides):referenceOutput(input(),overrides);
 global.fetch=async()=>{posts++;return new Response(JSON.stringify({response:JSON.stringify(raw),finish_reason:'stop'}));};
 const response=await invoke();assert.equal(response.statusCode,503);assert.equal(posts,1);
 assert.equal(telemetry[0].failureCode,'EVALUATION_OBSERVATION_GROUNDING_INVALID');assert.equal(telemetry[0].failureReason,reason);
 assert.equal(telemetry[0].evaluationProtocol,version==='legacy'?'legacy-literal':version);
 assert.equal(telemetry[0].evaluationContractVersion,'interview-evaluation-v4-inline-refs');
 assert.equal(telemetry[0].persistenceMs,0);assert.equal(telemetry[0].retries,0);
 assert.equal(records.get(interview).answers[0].answerText,undefined);assert.equal(records.get(interview).evaluationLease,undefined);assert.deepEqual(skills,[]);
 for(const secret of [answer,questionText,owner])assert.ok(!JSON.stringify(telemetry).includes(secret));
});

for(const type of ['technical','behavioral'])test('inline protocol derives source links and commits the unchanged public response: '+type,async()=>{
 records.set(interview,row(interview,owner,type));const raw=inlineOutput(),before=clone(raw);
 global.fetch=async()=>{posts++;return new Response(JSON.stringify({response:JSON.stringify(raw),finish_reason:'stop'}));};
 const response=await invoke();assert.equal(response.statusCode,200);assert.equal(posts,1);
 assert.equal(telemetry[0].evaluationProtocol,'refs-v2');assert.equal(telemetry[0].attempts,1);assert.equal(telemetry[0].retries,0);
 assert.deepEqual(raw,before);assert.equal(skills.length,type==='technical'?1:0);
 assert.deepEqual(response.body.data.evaluation,evaluation.validateInterviewEvaluation(referenceOutput(),input()));
 for(const key of ['assessmentBasis','answerEvidence','evidenceVersion']){
  assert.equal(key in response.body.data.evaluation,false);assert.equal(key in records.get(interview).answers[0],false);
 }
});

for(const [name,changes,code,reason] of [
 ['missing inline marker',{strengths:['The answer describes the relevant mechanism but has no source reference.']},'EVALUATION_OBSERVATION_GROUNDING_INVALID','OBSERVATION_MARKER_MISSING'],
 ['wrong source',{strengths:['The explanation [Q1] is not answer evidence supporting a strength.']},'EVALUATION_OBSERVATION_GROUNDING_INVALID','OBSERVATION_REFERENCE_INVALID'],
 ['unknown inline source',{weaknesses:['The missing mandatory audit logs are required by [Q99].']},'EVALUATION_OBSERVATION_GROUNDING_INVALID','OBSERVATION_REFERENCE_INVALID'],
 ['unrelated event-sourcing reference',{weaknesses:['The candidate should discuss event sourcing for [A1].']},'EVALUATION_OBSERVATION_GROUNDING_INVALID','OBSERVATION_REFERENCE_INVALID'],
 ['invalid observation',{strengths:[{}]},'EVALUATION_OBSERVATION_GROUNDING_INVALID','OBSERVATION_VALUE_INVALID'],
 ['mixed protocol',{assessmentBasis:{questionQuote:'Q1'}},'EVALUATION_EVIDENCE_INVALID','EVIDENCE_MODE_INVALID'],
 ['no feedback answer source',{feedback:'For [Q1], this evaluation explains a concept but omits any answer evidence reference.'},'EVALUATION_FEEDBACK_UNGROUNDED',undefined],
 ['no improved question source',{improvedAnswer:'An improved answer without the actual question reference remains invalid despite substantive text.'},'EVALUATION_QUESTION_GROUNDING_INVALID',undefined],
 ['only marker strength',{strengths:['[A1]']},'EVALUATION_OBSERVATIONS_INVALID',undefined],
 ['only marker feedback',{feedback:'[A1] [Q1]'},'EVALUATION_FEEDBACK_INVALID',undefined],
])test('inline protocol rejects unsupported output without persistence: '+name,async()=>{
 global.fetch=async()=>{posts++;return new Response(JSON.stringify({response:JSON.stringify(inlineOutput(input(),changes)),finish_reason:'stop'}));};
 const response=await invoke();assert.equal(response.statusCode,503);assert.equal(posts,1);
 assert.equal(telemetry[0].failureCode,code);assert.equal(telemetry[0].failureReason,reason);assert.equal(telemetry[0].evaluationProtocol,'refs-v2');
 assert.equal(telemetry[0].persistenceMs,0);assert.equal(telemetry[0].retries,0);assert.deepEqual(skills,[]);
 assert.equal(records.get(interview).answers[0].evaluationStatus,'pending');
});

test('inline observations can be reordered without maintaining duplicate reference arrays',()=>{
 const raw=inlineOutput(input(),{strengths:['The first statement [A1] explains the mechanism in the answer.','The second statement [A2] supplies further context from the answer.']});
 const forward=evaluation.validateInterviewEvaluation(raw,input());
 const reversed=evaluation.validateInterviewEvaluation({...raw,strengths:[...raw.strengths].reverse()},input());
 assert.deepEqual(reversed.strengths,[...forward.strengths].reverse());
});

test('inline protocol allows empty observations, still requires substantive grounded feedback',()=>{
 const result=evaluation.validateInterviewEvaluation(inlineOutput(input(),{strengths:[],weaknesses:[]}),input());
 assert.deepEqual(result.strengths,[]);assert.deepEqual(result.weaknesses,[]);assert.ok(result.feedback.length>=40);
});

test('inline CAP/DI premise challenge preserves the technically relevant feedback',async()=>{
 const context={...input(),question:flawedQuestion,answer:premiseAnswer};
 const raw=inlineOutput(context,{score:94,technicalAccuracy:96,completeness:94,communication:92,
  strengths:['The statement [A1] correctly identifies network partitions rather than assuming dependency injection creates a cluster.'],weaknesses:[],
  feedback:'For [Q1], the explanation [A1] correctly challenges the premise and distinguishes distributed-system trade-offs from dependency injection.',
  improvedAnswer:'For [Q1], a network partition in a distributed system is the relevant condition. Hilt and Dagger concern dependency injection and do not themselves create a CAP trade-off.'});
 const response=await invokePremise(raw);assert.equal(response.statusCode,200);assert.equal(response.body.data.evaluation.technicalAccuracy,96);
 assert.deepEqual(response.body.data.evaluation.weaknesses,[]);assert.equal(posts,1);assert.equal(telemetry[0].evaluationProtocol,'refs-v2');
});

test('inline concurrent duplicates dispatch once and preserve lease fencing',async()=>{
 global.fetch=async()=>{posts++;await new Promise(resolve=>setTimeout(resolve,8));return new Response(JSON.stringify({response:JSON.stringify(inlineOutput()),finish_reason:'stop'}));};
 const responses=await Promise.all([invoke(),invoke()]);assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,409]);assert.equal(posts,1);
});

test('observation subreasons cannot log forged private text or cross-category reasons',async()=>{
 for(const error of [new contract.InterviewEvaluationError('EVALUATION_OBSERVATION_GROUNDING_INVALID',answer),
  new contract.InterviewEvaluationError('EVALUATION_OBSERVATION_GROUNDING_INVALID','EVIDENCE_NOT_VERBATIM'),
  new contract.InterviewEvaluationError('EVALUATION_JSON_INVALID','OBSERVATION_MARKER_MISSING')]){
  let value;await metric.withInterviewMetrics(async()=>metric.recordInterviewEvaluationFailure(error),()=>503,result=>value=result);
  assert.equal(value.failureReason,undefined);assert.ok(!JSON.stringify(value).includes(answer));
 }
 const original=process.env.RENDER_GIT_COMMIT;
 try{
  for(const [revision,expected] of [['a'.repeat(40),'a'.repeat(40)],['PRIVATE credential',undefined]]){
   process.env.RENDER_GIT_COMMIT=revision;let value;
   await metric.withInterviewMetrics(async()=>metric.recordInterviewEvaluationProtocol('PRIVATE token'),()=>200,result=>value=result);
   assert.equal(value.buildRevision,expected);assert.equal(value.evaluationProtocol,'unknown');assert.ok(!JSON.stringify(value).includes('PRIVATE'));
  }
 }finally{if(original===undefined)delete process.env.RENDER_GIT_COMMIT;else process.env.RENDER_GIT_COMMIT=original;}
});
