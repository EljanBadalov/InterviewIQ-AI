// Isolated fixtures only: all database persistence and inference are in memory.
const test = require('node:test'), assert = require('node:assert/strict');
const f = require('./active-career-fixture.cjs'), owner = String(f.ownerA);
const goal = f.load('services/careerGoalService');
const narrative = f.load('services/roadmapNarrativeService');
const cache = f.load('services/roadmapNarrativeCache');
const metrics = f.load('services/careerChatMetrics');
const dynamic = f.load('services/careerDynamicResponseService');
const chat = f.load('services/csChatService');
test.beforeEach(() => { f.reset(); cache.clearRoadmapNarrativeCache(); });

test('chat goal context uses deterministic evidence without inference or database writes', async () => {
  const before = JSON.stringify(f.resumes);
  const result = await goal.buildCareerGoalChatContext(f.input());
  assert.equal(result.found, true);
  assert.ok(result.data.milestones.length);
  assert.ok(result.data.milestones.flatMap(m => m.recommendations).length);
  assert.equal(f.inference.calls.length, 0);
  assert.equal(f.counters.writes, 0);
  assert.equal(JSON.stringify(f.resumes), before);
});

test('explicit roadmap generation remains generative and saved roadmap stays intact during chat reads', async () => {
  const saved = await f.service.createCareerAutomation(f.input());
  const before = JSON.stringify(f.store.get(owner));
  cache.clearRoadmapNarrativeCache(); f.inference.calls.length = 0; f.resetCounters();
  const context = await goal.buildCareerGoalChatContext(f.input());
  assert.equal(context.found, true); assert.ok(saved.roadmap.length);
  assert.equal(f.inference.calls.length, 0); assert.equal(f.counters.writes, 0);
  assert.equal(JSON.stringify(f.store.get(owner)), before);
  const observation = narrative.getRoadmapNarrativeMetrics(context.data.milestones);
  assert.ok(observation.hits > 0, 'Reuse compatible saved narrative through existing validation');
  assert.equal(observation.calls, 0);
  cache.clearRoadmapNarrativeCache();
  await goal.buildCareerGoalContext({...f.input(), careerGoal:'A new explicit generation goal'});
  assert.equal(f.inference.calls.length, 1);
});

test('read-only context still rejects ungrounded cached text and never rewrites saved data', async () => {
  await f.service.createCareerAutomation(f.input());
  const saved=f.store.get(owner);
  const planner=f.load('services/roadmapNarrativePlanner');
  for(const section of saved.roadmap)for(const node of section.metadata?.roadmapNarrative?.nodes || []){
    node.text={whyItMatters:'Your AWS expertise is verified at 99 percent.',action:'Use your verified AWS mastery to lead production work.',proofOfCompletion:'Your verified AWS mastery proves completion.'};
    node.textHash=planner.stableHash(node.text);
  }
  const before=JSON.stringify(saved);cache.clearRoadmapNarrativeCache();f.resetCounters();f.inference.calls.length=0;
  const result=await goal.buildCareerGoalChatContext(f.input());
  assert.ok(!JSON.stringify(result.data.milestones).includes('99 percent'));
  assert.equal(JSON.stringify(saved),before);assert.equal(f.counters.writes,0);assert.equal(f.inference.calls.length,0);
});

test('per-turn topic is retained for CAREER_GOAL even without Next Steps, while account context remains background', () => {
  const input={message:'Give one JavaScript exercise for a Frontend Developer',intent:'CAREER_GOAL',focus:'GENERAL',targetRole:'Mobile Developer',conversationSubject:'Frontend Developer',activeCareer:{targetRole:'Mobile Developer',roleKey:'mobile-developer',revision:4}};
  const before=JSON.stringify(input), packet=dynamic.buildQwenCareerDataset(input);
  assert.equal(packet.question.subject,'Frontend Developer');
  assert.equal(packet.accountCareer.targetRole,'Mobile Developer');
  assert.equal(JSON.stringify(input),before);
  assert.equal(dynamic.buildQwenCareerDataset({...input,message:'another exercise'}).question.freshTopicsExhausted,false);
});

test('actual CAREER_GOAL service flow uses one mocked response inference and transmits topic/format constraints', async () => {
  const memory=f.load('services/csMemoryService'), intents=f.load('services/csIntentService');
  const active=f.load('services/activeCareerService'), learning=f.load('services/csLearningService');
  const originals=[];
  const patch=(object,key,value)=>{const prior=object[key];originals.push(()=>object[key]=prior);object[key]=value;};
  const conversation={_id:f.id(98765),userId:f.ownerA,sessionId:'synthetic-latency',memory:{targetRole:'Mobile Developer',metadata:{}},messages:[]};
  patch(memory,'getOrCreateConversation',async()=>conversation);
  patch(memory,'addConversationMessage',async value=>{conversation.messages.push({...value,createdAt:new Date()});return conversation;});
  patch(memory,'updateConversationMemory',async(_session,value)=>{Object.assign(conversation.memory,value);return conversation;});
  for(const key of ['setActiveResume','setActiveInterview','setAwaitingField','markIntentResolved'])patch(memory,key,async()=>conversation);
  patch(active,'resolveActiveCareer',async()=>({targetRole:'Mobile Developer',roleKey:'mobile-developer',revision:4}));
  patch(intents,'predictCSIntent',async()=>({intent:'CAREER_GOAL',confidence:.95,needsClarification:false,alternatives:[]}));
  patch(learning,'recordLearningCandidate',async()=>{});
  const message='Suggest one small JavaScript exercise for a Frontend Developer. Exactly two sentences; no roadmap generation or job hunting advice.';
  let posts=0, packet, observed, contextRole;
  const originalContext=goal.buildCareerGoalChatContext;
  patch(goal,'buildCareerGoalChatContext',async input=>{contextRole=input.targetRole;return originalContext(input);});
  patch(global,'fetch',async(url,request)=>{
    assert.equal(new URL(url).pathname,'/generate');assert.equal(++posts,1);
    packet=JSON.parse(request.body);
    return new Response(JSON.stringify({response:'Build a to-do list with DOM event handling. Verify that adding and deleting an item both work.',usage:{prompt_tokens:100,completion_tokens:22,total_tokens:122},finish_reason:'stop'}));
  });
  patch(console,'log',()=>{});
  try{
    const result=await metrics.withCareerChatMetrics(()=>chat.processCustomerMessage({sessionId:conversation.sessionId,message,userId:owner}),value=>observed=value);
    assert.equal(posts,1);assert.equal(observed.qwenCalls,1);assert.equal(f.inference.calls.length,0);
    assert.equal(result.data.responseGeneration.strategy,'QWEN_FRESH_CONTEXTUAL');assert.equal(result.data.cache.hit,false);
    assert.equal(result.memory.targetRole,'Mobile Developer');
    assert.ok(packet.message.includes(message));assert.ok(packet.system.includes('exactly two plain'));
    assert.ok(packet.system.includes('no roadmap and no job-hunting'));
    const dataset=JSON.parse(packet.system.split('CONTEXT:\n')[1]);
    assert.equal(dataset.question.subject,'Frontend Developer');assert.equal(dataset.accountCareer.targetRole,'Mobile Developer');
    assert.equal(contextRole,'Frontend Developer');
    assert.ok(JSON.stringify(dataset.careerGoalEvaluation).includes('Frontend Developer'));
    assert.equal(observed.strategy,'QWEN_FRESH_CONTEXTUAL');assert.equal(observed.cacheHit,false);
    assert.ok(observed.totalMs>=observed.qwenRoundtripMs);
    assert.ok(!JSON.stringify(observed).includes(message));assert.ok(!JSON.stringify(observed).includes(owner));
    assert.equal(f.counters.writes,0,'Context introduced no writes; chat-history writes were mocked separately');
  }finally{for(const restore of originals.reverse())restore();}
});

test('metrics isolate concurrent requests, failures and nested controller/service scopes without logging PII',async()=>{
  const results=[];
  await Promise.all([0,1].map(index=>metrics.withCareerChatMetrics(async()=>{
    const finish=metrics.startChatQwenAttempt();await new Promise(resolve=>setTimeout(resolve,2));finish();finish();
    await metrics.withCareerChatMetrics(async()=>{});
    metrics.careerChatOutcome('QWEN_FRESH_CONTEXTUAL',false);
  },value=>results.push(value))));
  assert.equal(results.length,2);assert.notEqual(results[0].correlationId,results[1].correlationId);
  assert.ok(results.every(value=>value.qwenCalls===1&&value.success));
  let failure;
  await assert.rejects(metrics.withCareerChatMetrics(async()=>{throw new Error('Private fixture input');},value=>failure=value));
  assert.equal(failure.success,false);assert.ok(!JSON.stringify(failure).includes('Private fixture input'));
});
