const test=require('node:test'),assert=require('node:assert/strict');
const f=require('./active-career-fixture.cjs'),owner=String(f.ownerA);
const chat=f.load('services/csChatService'),memory=f.load('services/csMemoryService'),intents=f.load('services/csIntentService'),resolver=f.load('services/careerConversationContextService');
test('actual chat pipeline applies the account default without persisting it or replacing a conversation topic',async()=>{
 await f.seed();f.store.get(owner).targetRole='Mobile Developer';
 const old={get:memory.getOrCreateConversation,predict:intents.predictCSIntent,resolve:resolver.resolveCareerConversationIntent,log:console.log};
 let topic;let captured;const stop=new Error('Fixture stopped before inference');
 memory.getOrCreateConversation=async()=>({userId:f.ownerA,sessionId:'isolated-b4',messages:[],memory:{targetRole:topic,metadata:{careerSubject:'SQL',recommendedTopics:['joins']}}});
 intents.predictCSIntent=async()=>({intent:'GENERAL_CAREER_HELP',confidence:.9,needsClarification:false});
 resolver.resolveCareerConversationIntent=input=>{captured=input;throw stop;};console.log=()=>{};
 try{
  await assert.rejects(chat.processCustomerMessage({sessionId:'isolated-b4',message:'Fixture career question',userId:owner}),e=>e===stop);assert.equal(captured.targetRole,'Mobile Developer');
  topic='Data Analyst';await assert.rejects(chat.processCustomerMessage({sessionId:'isolated-b4',message:'Fixture continuation',userId:owner}),e=>e===stop);assert.equal(captured.targetRole,'Data Analyst');
  assert.equal(f.inference.calls.length,0);assert.equal(f.counters.writes,0);
 }finally{memory.getOrCreateConversation=old.get;intents.predictCSIntent=old.predict;resolver.resolveCareerConversationIntent=old.resolve;console.log=old.log;}
});
test('the actual Qwen dataset receives account career as background without changing explicit topic input',()=>{
 const {buildQwenCareerDataset}=f.load('services/careerDynamicResponseService');const active={targetRole:'Mobile Developer',roleKey:'mobile-developer',revision:2};
 const input={message:'Explain SQL joins',intent:'GENERAL_CAREER_HELP',focus:'GENERAL',targetRole:'Data Analyst',activeCareer:active};const before=JSON.stringify(input);
 const dataset=buildQwenCareerDataset(input);assert.deepEqual(dataset.accountCareer,active);assert.equal(input.targetRole,'Data Analyst');assert.equal(JSON.stringify(input),before);assert.equal(f.inference.calls.length,0);
});
