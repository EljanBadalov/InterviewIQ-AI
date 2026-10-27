const test=require('node:test'),assert=require('node:assert/strict');
const f=require('./phase4d-generation-fixture.cjs'),g=f.load('services/roadmapNarrativeGrounding'),q=f.load('services/qwenService');
const plan=nodes=>({owner:String(f.ownerA),nodes});
const profile={skills:[{name:'React',skillScore:99,confidence:100,interviewVerified:true,sources:['resume']}]};
test('resume and legacy matching percentages cannot manufacture verified proficiency',()=>{
 const facts=g.narrativeSkillFacts(['React'],undefined,profile);assert.equal(facts[0].state,'partial_evidence');assert.equal(facts[0].proficiency,null);assert.deepEqual(facts[0].claims,['resume']);
 assert.equal(g.narrativeSkillFacts(['Missing'],undefined,profile)[0].state,'unverified');
});
test('scope-specific B2 verified, partial and gap evidence remains distinguishable and order independent',()=>{
 const nodes=[{id:'b',name:'React',level:'advanced',state:'partial_evidence',score:95},{id:'a',name:'React',level:'beginner',state:'verified_proficiency',score:94},{id:'c',name:'SQL',level:'beginner',state:'verified_gap',score:30}];
 const facts=g.narrativeSkillFacts(['SQL','React'],plan(nodes),profile);assert.deepEqual(facts,g.narrativeSkillFacts(['React','SQL'],plan([...nodes].reverse()),profile));assert.equal(facts.find(f=>f.scope==='advanced').proficiency,null);assert.equal(facts.find(f=>f.name==='SQL').proficiency,30);assert.equal(facts.find(f=>f.scope==='beginner'&&f.name==='React').proficiency,94);
});
test('unsupported personalized scores and mastery are rejected while assessment actions remain valid',()=>{
 const fact={name:'C++',scope:'unverified',state:'partial_evidence',proficiency:null,claims:['resume']};
 assert.equal(g.narrativeGrounded('Your C++ proficiency is 95%',[fact]),false);assert.equal(g.narrativeGrounded('Your C++ skill is verified',[fact]),false);assert.equal(g.narrativeGrounded('You have mastered C++',[fact]),false);
 assert.equal(g.narrativeGrounded('Your C++ proficiency is unverified; validate pointer ownership.',[fact]),true);
 assert.equal(g.narrativeGrounded('Your C++ proficiency is 94% within the recorded assessment scope.',[{...fact,state:'verified_proficiency',proficiency:94}]),true);
});
test('all requested non-learning prompts contain typed facts and no legacy confidence percentages',async()=>{
 f.reset();const original=q.generateQwenJSON;let inspected=false;
 q.generateQwenJSON=async options=>{const packet=JSON.parse(options.messages[1].content);for(const node of packet.nodes){const context=node.context??packet.contexts[node.contextRef];for(const fact of context.skills||[]){assert.ok(['verified_proficiency','verified_gap','partial_evidence','unverified'].includes(fact.state));if(['unverified','partial_evidence'].includes(fact.state))assert.equal(fact.proficiency,null);assert.equal('confidence' in fact,false);}}inspected=true;return original(options);};
 try{await f.service.createCareerAutomation(f.input());assert.equal(inspected,true);const m=f.narrativeMetrics.at(-1);assert.equal(m.fallbackNodes,0);assert.equal(m.validNodes,m.generatedNodes);}finally{q.generateQwenJSON=original;}
});
test('repeated generic triples fall back per node without changing What to Learn or IDs',async()=>{
 f.reset();const original=q.generateQwenJSON;
 q.generateQwenJSON=async options=>{const response=await original(options);const first=response.data.nodes[0];response.data.nodes[1]={...first,id:response.data.nodes[1].id};return response;};
 try{const result=await f.service.createCareerAutomation(f.input());const m=f.narrativeMetrics.at(-1);assert.equal(m.repeatedTextNodes,2);assert.equal(m.missingNodes,2);assert.equal(m.fallbackNodes,2);assert.equal(new Set(result.roadmap.map(section=>section.id)).size,result.roadmap.length);assert.ok(result.roadmap.some(section=>section.recommendations.some(row=>row.whatToLearn.length&&row.action.length&&row.proofOfCompletion.length)));}finally{q.generateQwenJSON=original;}
 f.inference.calls.length=0;await f.service.replanCareerAutomation({userId:String(f.ownerA),preserveCompletedTasks:true});assert.equal(f.inference.calls.length,1);assert.equal(f.narrativeMetrics.at(-1).generatedNodes,2);
});
test('unsupported mastery explanations are replaced, not cached as grounded text',async()=>{
 f.reset();const original=q.generateQwenJSON;q.generateQwenJSON=async options=>{const response=await original(options);response.data.nodes[0].whyItMatters='You have mastered every skill required for this career.';return response;};
 try{await f.service.createCareerAutomation(f.input());assert.equal(f.narrativeMetrics.at(-1).groundingRejectedNodes,1);assert.equal(f.narrativeMetrics.at(-1).fallbackNodes,1);}finally{q.generateQwenJSON=original;}
});

test('a verified beginner result cannot be generalized across an unverified advanced scope',()=>{
 const facts=[{name:'React',scope:'beginner',state:'verified_proficiency',proficiency:94,claims:[]},{name:'React',scope:'advanced',state:'unverified',proficiency:null,claims:[]}];
 assert.equal(g.narrativeGrounded('Your React proficiency is 94% in the beginner assessment.',facts),true);
 assert.equal(g.narrativeGrounded('Your React proficiency is 94% across all skill levels.',facts),false);
 assert.equal(g.narrativeGrounded('Your React proficiency is 99% in the advanced assessment.',facts),false);
});

test('CV and interview advice labels are not fabricated skill facts',()=>{
 assert.deepEqual(g.narrativeSkillFacts(['Add measurable results'],undefined,profile,false),[]);
 const facts=g.narrativeSkillFacts(['React'],undefined,profile,false);assert.equal(facts.length,1);assert.equal(facts[0].proficiency,null);
});
