const test=require('node:test'),assert=require('node:assert/strict');
const f=require('./phase4d-generation-fixture.cjs'),g=f.load('services/roadmapNarrativeGrounding'),q=f.load('services/qwenService'),cache=f.load('services/roadmapNarrativeCache');
const fields=['whyItMatters','action','proofOfCompletion'];
const safe={whyItMatters:'Validating HTTP error handling supports the selected target career.',action:'Build a React application to demonstrate your understanding of hooks.',proofOfCompletion:'Submit a working example with tests for three error paths.'};
const fact=(state='unverified',scope='beginner',proficiency=null)=>({name:'React',scope,state,proficiency,claims:['resume']});
const invalid=[
 ['percentage','Your React proficiency is 99%.'],
 ['mastery','You have mastered React.'],
 ['certification','Your React expertise has already been independently certified.'],
 ['experience','You have five years of professional experience with React.'],
 ['completed project','You have already completed a production React project.'],
 ['verified skill','Your React skill is verified.'],
 ['expert','You are an expert in React.'],
 ['assertion inside proposal','Verify your React proficiency is 99%.'],
 ['presupposition inside proposal','Build a sample using your React expertise to skip the basic exercises.'],
 ['confirmed knowledge','Your React knowledge has been validated.'],
 ['held certificate','You hold a React certificate.'],
 ['past achievement','You completed a production React project.'],
 ['past experience','You worked on React professionally.'],
 ['unverified invented score','Your React proficiency is unverified at 99%.'],
 ['mixed negation','Your SQL proficiency is unverified and your React skill is verified.'],
 ['advanced career','Your advanced backend skills are already verified.'],
 ['presupposed mastery','Use your verified 99% mastery as proof without submitting a working example.'],
 ['presupposed experience','Use your professional experience in React as the required proof.'],
 ['presupposed certificate','Use your React certification to show your readiness.'],
 ['presupposed expertise','Use your React expertise to skip the basic exercises.'],
 ['Azerbaijani mastery','Siz React-i artıq mənimsəmisiniz.'],
 ['Azerbaijani percentage','Sizin React bacarığınız 99 faizdir.'],
 ['Azerbaijani verified','Sizin React biliyiniz artıq təsdiqlənib.'],
 ['Azerbaijani certificate','Sizin React sertifikatınız artıq təsdiqlənib.'],
 ['Azerbaijani experience','Sizin React təcrübəniz artıq sübut olunub.'],
];
for(const field of fields)for(const [category,claim]of invalid)test(`${field}: rejects unsupported ${category}`,()=>{
 for(const state of ['unverified','partial_evidence','verified_gap'])assert.equal(g.narrativeTextGrounded({...safe,[field]:claim},[fact(state,'beginner',state==='verified_gap'?30:null)]),false);
});
const proposals=[
 'Complete a project to demonstrate proficiency.',
 'Complete a project to demonstrate your React proficiency.',
 'Practice React hooks before building a production application.',
 'Create tests to verify your implementation.',
 'Earn a certification after completing the required training.',
 'Build a React application to demonstrate your understanding of hooks.',
 'You will master React through focused exercises.',
 'You can gain professional experience by contributing to a practice project.',
 'Assess your React proficiency with a focused exercise.',
 'Your React proficiency should be assessed with a small project.',
 'Your React proficiency is unverified; validate hooks with tests.',
 'If you have completed a React project, review its error handling.',
 'A certification can verify a defined assessment, rather than every skill.',
 'React ilə bir layihə yaradın və üç xəta halını test edin.',
 'Sizin React bacarığınız hələ təsdiqlənməyib.',
 'Əgər siz React layihəsini tamamlamısınızsa, nəticəni yoxlayın.',
];
for(const field of fields)for(const [index,value]of proposals.entries())test(`${field}: accepts future/educational/unknown statement ${index}`,()=>assert.equal(g.narrativeTextGrounded({...safe,[field]:value},[fact()]),true));
test('verified evidence supports only matching skill, score and scope, never certificates or experience',()=>{
 const facts=[fact('verified_proficiency','beginner',94),fact('unverified','advanced')];
 for(const field of fields){
  assert.equal(g.narrativeTextGrounded({...safe,[field]:'Your React proficiency is 94% in the beginner assessment.'},facts),true);
  assert.equal(g.narrativeTextGrounded({...safe,[field]:'Your React proficiency is 94% in the advanced assessment.'},facts),false);
  assert.equal(g.narrativeTextGrounded({...safe,[field]:'You have mastered React.'},facts),false);
  assert.equal(g.narrativeTextGrounded({...safe,[field]:'Your Python skill is verified.'},facts),false);
  assert.equal(g.narrativeTextGrounded({...safe,[field]:'You are certified in React.'},facts),false);
 }
 assert.equal(g.narrativeGrounded('Your advanced React skill is verified.',[fact('verified_proficiency','advanced',95)]),true);
 assert.equal(g.narrativeGrounded('Your React weakness is a verified gap.',[fact('verified_gap','beginner',30)]),true);
 assert.equal(g.narrativeGrounded('Your React weakness is a verified gap.',[fact()]),false);
 assert.equal(g.narrativeGrounded('Your React proficiency is unverified but you have mastered Python.',facts),false);
});
test('unassessed proficiency is not a verified lack of knowledge',()=>{
 assert.equal(g.narrativeGrounded('You have not mastered React.',[fact()]),false);
 assert.equal(g.narrativeGrounded('Your beginner React weakness is a verified gap.',[fact('verified_gap','beginner',30)]),true);
});

test('claim work is bounded and evidence order cannot change a decision',()=>{
 assert.equal(g.narrativeGrounded('x'.repeat(1801),[]),false);
 assert.equal(g.narrativeGrounded('Your React skill is verified.',Array(129).fill(fact())),false);
 const facts=[fact('verified_proficiency','beginner',94),fact('unverified','advanced')];
 assert.equal(g.narrativeTextGrounded({...safe,action:'Your React proficiency is 94% in the beginner assessment.'},facts),g.narrativeTextGrounded({...safe,action:'Your React proficiency is 94% in the beginner assessment.'},facts.reverse()));
});
for(const field of fields)test(`pipeline ${field}: rejection uses coherent node fallback, valid peers reuse, repaired content can recover`,async()=>{
 f.reset();const original=q.generateQwenJSON;let rejectedId;
 q.generateQwenJSON=async options=>{const response=await original(options);rejectedId=response.data.nodes[0].id;response.data.nodes[0][field]='Your Node.js expertise has already been independently certified.';return response;};
 let result;
 try{result=await f.service.createCareerAutomation(f.input());const metrics=f.narrativeMetrics.at(-1);assert.equal(metrics.groundingRejectedNodes,1);assert.equal(metrics.fallbackNodes,1);assert.equal(metrics.validNodes,metrics.generatedNodes-1);
 const note=result.roadmap.flatMap(section=>section.metadata.roadmapNarrative.nodes).find(node=>node.id===rejectedId);assert.equal(note.ai,false);assert.ok(!JSON.stringify(note.text).includes('certified'));assert.ok(note.text.action.length>=12);assert.ok(note.text.proofOfCompletion.length>=12);
 }finally{q.generateQwenJSON=original;}
 f.inference.calls.length=0;const next=await f.service.replanCareerAutomation({userId:String(f.ownerA),preserveCompletedTasks:true,reason:'repair'});
 assert.equal(f.inference.calls.length,1);assert.equal(f.narrativeMetrics.at(-1).generatedNodes,1);assert.equal(f.narrativeMetrics.at(-1).fallbackNodes,0);
 assert.deepEqual(next.roadmap.map(section=>section.id),result.roadmap.map(section=>section.id));
});
test('two invalid attempts suppress only the affected owner/node/version; expiry and valid writes recover',()=>{
 cache.clearRoadmapNarrativeCache();const owner=String(f.ownerA),other=String(f.ownerB),id='n-semantic',version='evidence-v2';
 cache.recordInvalidNarrative(owner,id,version);assert.equal(cache.canRequestNarrative(owner,id,version),true);
 cache.recordInvalidNarrative(owner,id,version);assert.equal(cache.canRequestNarrative(owner,id,version),false);
 assert.equal(cache.canRequestNarrative(other,id,version),true);assert.equal(cache.canRequestNarrative(owner,id,'changed-evidence'),true);
 const now=Date.now;Date.now=()=>now()+300001;try{assert.equal(cache.canRequestNarrative(owner,id,version),true);}finally{Date.now=now;}
 cache.recordInvalidNarrative(owner,id,version);cache.recordInvalidNarrative(owner,id,version);cache.putNarrativeText(owner,id,version,safe);assert.equal(cache.canRequestNarrative(owner,id,version),true);
});
test('pipeline bounds repeated invalid content without another inference or successful cache pollution',async()=>{
 f.reset();const original=q.generateQwenJSON;
 q.generateQwenJSON=async options=>{const response=await original(options);response.data.nodes[0].action='Your advanced backend skills are already verified.';return response;};
 try{
  await f.service.createCareerAutomation(f.input());await f.service.replanCareerAutomation({userId:String(f.ownerA),reason:'retry-invalid-once'});
  f.inference.calls.length=0;await f.service.replanCareerAutomation({userId:String(f.ownerA),reason:'suppress-invalid-third'});
  const metrics=f.narrativeMetrics.at(-1);assert.equal(f.inference.calls.length,0);assert.equal(metrics.fallbackNodes,1);assert.equal(metrics.missingNodes,1);assert.equal(metrics.hits,metrics.totalNodes-metrics.deterministicNodes-1);
 }finally{q.generateQwenJSON=original;}
});
test('generic activity and presentation-only duplicate triples are rejected, useful peers survive',async()=>{
 f.reset();const original=q.generateQwenJSON;
 q.generateQwenJSON=async options=>{const response=await original(options);response.data.nodes[0].action='Learn more about this skill.';const source=response.data.nodes[1];response.data.nodes[2]={...source,id:response.data.nodes[2].id,whyItMatters:source.whyItMatters.toUpperCase(),action:source.action.toUpperCase()};return response;};
 try{await f.service.createCareerAutomation(f.input());const metrics=f.narrativeMetrics.at(-1);assert.equal(metrics.repeatedTextNodes,2);assert.equal(metrics.fallbackNodes,3);assert.equal(metrics.validNodes,metrics.generatedNodes-3);}finally{q.generateQwenJSON=original;}
});

test('poisoned current-version memory and saved text cannot bypass all-field validation',async()=>{
 f.reset();await f.service.createCareerAutomation(f.input());const owner=String(f.ownerA),row=f.store.get(owner);
 const node=row.roadmap.flatMap(section=>section.metadata.roadmapNarrative.nodes).find(node=>node.ai);
 const poison={...node.text,proofOfCompletion:'Use your verified 99% mastery as proof without submitting a working example.'};
 node.text=poison;node.textHash=f.load('services/roadmapNarrativePlanner').stableHash(poison);cache.putNarrativeText(owner,node.id,node.version,poison);
 f.inference.calls.length=0;await f.service.replanCareerAutomation({userId:owner,reason:'revalidate-current-cache'});
 assert.equal(f.inference.calls.length,1);assert.equal(f.narrativeMetrics.at(-1).generatedNodes,1);assert.equal(f.narrativeMetrics.at(-1).fallbackNodes,0);
});
test('old private content versions do not bypass new rules or change public milestone IDs',async()=>{
 f.reset();await f.service.createCareerAutomation(f.input());const owner=String(f.ownerA),row=f.store.get(owner),ids=row.roadmap.map(section=>section.id);
 assert.notEqual(g.NARRATIVE_EVIDENCE_POLICY,'narrative-evidence-v1');
 for(const node of row.roadmap.flatMap(section=>section.metadata.roadmapNarrative.nodes))if(node.ai){node.version='old-v1-private-content';node.text.action='Your advanced backend skills are already verified.';node.textHash=f.load('services/roadmapNarrativePlanner').stableHash(node.text);}
 cache.clearRoadmapNarrativeCache();f.inference.calls.length=0;const result=await f.service.replanCareerAutomation({userId:owner,reason:'policy-invalidation'});
 assert.equal(f.inference.calls.length,1);assert.equal(f.narrativeMetrics.at(-1).hits,0);assert.equal(f.narrativeMetrics.at(-1).fallbackNodes,0);assert.deepEqual(result.roadmap.map(section=>section.id),ids);
});
test('invalid-content bookkeeping is capacity bounded and never an evidence or successful cache entry',()=>{
 cache.clearRoadmapNarrativeCache();const owner=String(f.ownerA);for(let i=0;i<2050;i++){cache.recordInvalidNarrative(owner,`node-${i}`,'version');cache.recordInvalidNarrative(owner,`node-${i}`,'version');}
 assert.equal(cache.canRequestNarrative(owner,'node-0','version'),true);assert.equal(cache.canRequestNarrative(owner,'node-2049','version'),false);
 assert.equal(cache.getNarrativeText(owner,'node-2049','version'),undefined);assert.equal(cache.getRoadmapNarrativeCacheStats().entries,0);cache.clearRoadmapNarrativeCache();
});
