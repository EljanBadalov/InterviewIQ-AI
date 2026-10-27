const test=require('node:test'),assert=require('node:assert/strict');
const {planCareerLearning,getLearningCurriculum,applyLearningSeeds}=require('../dist/services/careerLearningPlanner');
const {assessSkillEvidence}=require('../dist/services/skillEvidenceAssessment');
const {getCareerLearningTopics,SUPPORTED_LEARNING_ROLES}=require('../dist/data/careerLearningKnowledge');
const {planNarrativeNodes}=require('../dist/services/roadmapNarrativePlanner');
const owner='00000000000000000000006f';
function assessment(topics,score=95,level){return assessSkillEvidence({userId:owner,requiredSkills:topics.map(t=>t.name),interviews:topics.map((t,i)=>({_id:`session-${i}`,user:owner,status:'completed',interviewType:'technical',answers:[{question:`question-${i}`,evaluationStatus:'completed',score}]})),questions:topics.map((t,i)=>({_id:`question-${i}`,interviewType:'technical',tags:[t.name],difficulty:level||t.level}))});}
function plan(role,proof){return planCareerLearning({userId:owner,targetRole:role,assessment:proof});}
for(const role of SUPPORTED_LEARNING_ROLES){
 test(`${role}: unknown evidence selects honest, specific foundations and an acyclic graph`,()=>{
  const result=plan(role);assert.ok(result.nodes.length>=4);assert.ok(result.selected.length>0);assert.deepEqual(result.diagnostics,[]);
  assert.ok(result.selected.every(n=>n.level==='beginner'&&n.state==='unverified'&&n.score===null));
  for(const node of result.nodes){assert.ok(node.subtopics.length>=2);assert.ok(node.exercise.length>35);assert.ok(node.proof.length>35);for(const ref of node.prerequisites)assert.ok(result.nodes.findIndex(n=>n.id===ref)<result.nodes.indexOf(node));}
  assert.ok(result.selected.every(n=>n.explanation.includes('unverified')&&!n.explanation.includes('verified gap')));
 });
 test(`${role}: beginner, intermediate and advanced frontiers follow actual assessment scope`,()=>{
  const topics=getLearningCurriculum(role),base=topics.filter(t=>t.level==='beginner');
  const beginner=plan(role,assessment(base,30));assert.ok(beginner.selected.every(n=>n.level==='beginner'));assert.ok(beginner.selected.every(n=>n.state==='partial_evidence'));
  const intermediate=plan(role,assessment(base));assert.ok(intermediate.selected.some(n=>n.level==='intermediate'));assert.ok(!intermediate.selected.some(n=>n.level==='beginner'));
  const skilled=plan(role,assessment(topics.filter(t=>t.level!=='advanced')));assert.ok(skilled.selected.some(n=>n.level==='advanced'));assert.ok(skilled.selected.every(n=>n.level==='advanced'));
  const advanced=plan(role,assessment(topics));assert.ok(advanced.selected.every(n=>n.level==='advanced'&&n.verified));
 });
}
test('resume claims are not mastery or verified gaps',()=>{const proof=assessSkillEvidence({userId:owner,resume:{user:owner,skillsDetected:['SQL']},interviews:[],questions:[]});const result=plan('Backend Developer',proof);const sql=result.selected.find(n=>n.name==='SQL');assert.equal(sql.state,'partial_evidence');assert.equal(sql.score,null);assert.match(sql.explanation,/mention does not verify mastery/);});
test('two independent poor assessments are a verified gap, unlike no evidence',()=>{const t=getLearningCurriculum('Database Engineer').find(t=>t.name==='SQL'),s={userId:owner,interviews:[0,1].map(i=>({_id:`i${i}`,user:owner,status:'completed',interviewType:'technical',answers:[{question:'q',evaluationStatus:'completed',score:25}]})),questions:[{_id:'q',tags:['SQL'],interviewType:'technical',difficulty:'beginner'}]};const node=plan('Database Engineer',assessSkillEvidence(s)).selected.find(n=>n.id===t.id);assert.equal(node.state,'verified_gap');assert.match(node.explanation,/verified gap/);});
test('high beginner scores do not establish intermediate prerequisite mastery',()=>{const topics=getLearningCurriculum('Backend Developer');const result=plan('Backend Developer',assessment(topics.filter(t=>t.level!=='advanced'),95,'beginner'));assert.ok(!result.selected.some(n=>n.level==='advanced'));assert.ok(result.selected.some(n=>n.level==='intermediate'));});
test('duplicate and reordered evidence cannot change the frontier',()=>{const topics=getLearningCurriculum('Mobile Developer');const a=assessment(topics.filter(t=>t.level==='beginner'));assert.deepEqual(plan('Mobile Developer',a),plan('Mobile Developer',{...a,skills:[...a.skills].reverse()}));});
test('foreign assessment and foreign narrative plan are rejected',()=>{assert.throws(()=>plan('Backend Developer',{...assessment([]),userId:'other'}),/owner mismatch/);assert.throws(()=>planNarrativeNodes([],{userId:'other',targetRole:'Backend Developer',learningPlan:plan('Backend Developer')}),/owner mismatch/);});
test('cycle, dangling prerequisites and duplicate IDs fail closed without infinite traversal',()=>{const topic=(id,prerequisites)=>({id,name:id,level:'beginner',prerequisites,subtopics:[],exercise:'',proof:''});for(const curriculum of [[topic('a',['b']),topic('b',['a'])],[topic('a',['missing'])],[topic('a',[]),topic('a',[])]]){const result=planCareerLearning({userId:owner,targetRole:'Custom',curriculum});assert.equal(result.selected.length,0);assert.ok(result.diagnostics.length>0);}});
test('runtime careers use their own DB knowledge and resolve names or IDs without another role fallback',()=>{const topic={id:'care',name:'Patient Communication',level:'beginner',prerequisites:[],subtopics:['Consent','Teach-back'],practicalScenarios:['Practice a consent conversation'],expectedEvidence:['A reviewed consent checklist']};const knowledge={role:{topics:[topic,{...topic,id:'advanced',name:'Complex Consent',level:'advanced',prerequisites:['Patient Communication']}]}};const result=planCareerLearning({userId:owner,targetRole:'Clinical Specialist',knowledge});assert.deepEqual(result.selected.map(n=>n.name),['Patient Communication']);assert.equal(result.selected[0].exercise,topic.practicalScenarios[0]);assert.deepEqual(plan('Unlisted Career').selected,[]);});
test('mastery cannot be inherited through substring, prerequisite or related tool',()=>{const knowledge={role:{topics:[{id:'sql-advanced',name:'Advanced SQL Performance',level:'advanced',prerequisites:['SQL'],subtopics:['Plans'],practicalScenarios:[],expectedEvidence:[],relatedSkills:['SQL']}]}};const result=planCareerLearning({userId:owner,targetRole:'Database Engineer',knowledge,assessment:assessment([{name:'SQL',level:'beginner'}])});assert.equal(result.nodes.find(n=>n.name==='Advanced SQL Performance').state,'unverified');});
test('specific guidance is diverse, bounded and never manufactures a section readiness',()=>{const result=plan('Backend Developer'),seeds=applyLearningSeeds([],result);assert.equal(seeds[0].readinessScore,undefined);assert.equal(seeds[0].completed,false);const {nodes,sections}=planNarrativeNodes(seeds,{userId:owner,targetRole:'Backend Developer',learningPlan:result});assert.ok(nodes.length<=18);assert.equal(new Set(nodes.map(n=>n.fallback.action)).size,nodes.length);assert.ok(nodes.every(n=>n.deterministic&&n.topics.length>=2));assert.equal(sections[0].readinessScore,undefined);});
test('no framework choice forces all alternative mobile stacks',()=>{const knowledge={role:{topics:['React Native','Flutter','Swift','Kotlin'].map((name,i)=>({id:`stack${i}`,name,level:'advanced',prerequisites:[],subtopics:[],practicalScenarios:[],expectedEvidence:[]}))}};const result=planCareerLearning({userId:owner,targetRole:'Mobile Developer',knowledge});assert.ok(!result.nodes.some(n=>['React Native','Flutter','Swift','Kotlin'].includes(n.name)));assert.match(result.nodes.find(n=>n.name==='Mobile UI').exercise,/Choose one mobile framework/);});
test('existing frontend framework evidence selects that track without React becoming mandatory',()=>{const proof=assessment([{name:'Angular',level:'intermediate'}]);const result=plan('Frontend Developer',proof);assert.ok(result.nodes.some(n=>n.name==='Angular'));assert.ok(!result.nodes.some(n=>n.name==='React'));});

test('all seed catalogue topics lacking subtopics have source-controlled supplemental guidance',()=>{
 const fs=require('node:fs'),path=require('node:path'),ts=require('../../client/node_modules/typescript');
 const {getSupplementalGuidance}=require('../dist/data/careerLearningGuidance');
 const source=ts.createSourceFile('seed',fs.readFileSync(path.join(__dirname,'../src/scripts/seedCareerKnowledgeIT.ts'),'utf8'),ts.ScriptTarget.Latest,true);
 let covered=0;
 function walk(node){if(ts.isCallExpression(node)&&node.expression.getText(source)==='topic'){
  const fields=node.arguments[0].properties,name=fields.find(p=>p.name?.getText(source)==='name').initializer.text;
  if(!fields.some(p=>p.name?.getText(source)==='subtopics')){const guide=getSupplementalGuidance(name);assert.ok(guide,name);assert.ok(guide.subtopics.length>=2);assert.ok(guide.proof.length>40);covered++;}
 }ts.forEachChild(node,walk);}walk(source);assert.equal(covered,98);
});
test('reference content is fresh per request and cannot be poisoned by another caller',()=>{const topics=getLearningCurriculum('Mobile Developer'),before=JSON.stringify(getLearningCurriculum('Mobile Developer'));topics[0].subtopics.push('Mutated reference');assert.equal(JSON.stringify(getLearningCurriculum('Mobile Developer')),before);});
test('unconnected advanced catalogue topics require intermediate foundations and use specific supplemental criteria',()=>{
 const topic={id:'mobile-security',name:'Mobile Security',level:'production',prerequisites:[],subtopics:[],practicalScenarios:['Protect local secrets and sensitive API communication'],expectedEvidence:['Can secure storage, transport and session handling']};
 const knowledge={role:{topics:[topic]}},base=getLearningCurriculum('Mobile Developer').filter(t=>t.level==='beginner');
 const result=planCareerLearning({userId:owner,targetRole:'Mobile Developer',knowledge,assessment:assessment(base)});
 assert.ok(result.blocked.includes('mobile-security'));const security=result.nodes.find(n=>n.id==='mobile-security');assert.ok(security.subtopics.some(s=>s.includes('token lifecycle')));assert.match(security.proof,/logout cleanup/);
});
test('custom advanced-only knowledge with missing prerequisites is explicitly incomplete and blocked',()=>{
 const result=planCareerLearning({userId:owner,targetRole:'Custom',knowledge:{role:{topics:[{id:'advanced',name:'Specialist Decisions',level:'advanced',prerequisites:[],subtopics:[],practicalScenarios:[],expectedEvidence:[]}]}}});
 assert.equal(result.selected.length,0);assert.match(result.diagnostics.join(' '),/prerequisite-coverage/);
});

test('switching framework changes semantic node identity without claiming equivalent mastery',()=>{
 const react=plan('Frontend Developer'),angular=plan('Frontend Developer',assessment([{name:'Angular',level:'intermediate'}]));
 assert.notEqual(react.nodes.find(n=>n.name==='Component UI Development').id,angular.nodes.find(n=>n.name==='Angular').id);
});

test('many strong beginner answers cannot mask a weak intermediate answer in the same session',()=>{
 const questions=Array.from({length:20},(_,i)=>({_id:`b${i}`,tags:['Database Transactions'],interviewType:'technical',difficulty:'beginner'}));
 questions.push({_id:'higher',tags:['Database Transactions'],interviewType:'technical',difficulty:'intermediate'});
 const proof=assessSkillEvidence({userId:owner,includeScopeScores:true,interviews:[{_id:'mixed',user:owner,status:'completed',interviewType:'technical',answers:questions.map(q=>({question:q._id,evaluationStatus:'completed',score:q._id==='higher'?10:100}))}],questions});
 assert.equal(proof.skills[0].state,'verified_proficiency');
 const result=plan('Backend Developer',proof),transactions=result.nodes.find(n=>n.name==='Database Transactions');
 assert.equal(transactions.verified,false);assert.equal(transactions.score,10);assert.equal(transactions.state,'partial_evidence');assert.ok(result.blocked.some(id=>id.includes('distributed')));
});
test('strong higher-scope evidence within mixed sessions remains usable without duplicate counting',()=>{
 const proof=assessSkillEvidence({userId:owner,includeScopeScores:true,interviews:[{_id:'mixed',user:owner,status:'completed',interviewType:'technical',answers:[{question:'b',evaluationStatus:'completed',score:30},{question:'a',evaluationStatus:'completed',score:95}]}],questions:[{_id:'b',tags:['Database Transactions'],interviewType:'technical',difficulty:'beginner'},{_id:'a',tags:['Database Transactions'],interviewType:'technical',difficulty:'intermediate'}]});
 const result=plan('Backend Developer',proof),transactions=result.nodes.find(n=>n.name==='Database Transactions');assert.equal(transactions.score,95);assert.equal(transactions.verified,true);
});
test('legacy mixed-level aggregates are conservatively unverified at higher scope',()=>{
 const proof=assessment([{name:'Database Transactions',level:'beginner'}]);proof.skills[0].assessments[0].levels=['beginner','advanced'];
 assert.equal(plan('Backend Developer',proof).nodes.find(n=>n.name==='Database Transactions').verified,false);
});

test('unknown frontend stack asks for one choice rather than assigning React mastery or a compulsory framework',()=>{
 const result=plan('Frontend Developer'),component=result.nodes.find(n=>n.name==='Component UI Development');
 assert.match(component.exercise,/Choose one component framework/);assert.equal(component.score,null);assert.equal(component.verified,false);assert.ok(!result.nodes.some(n=>n.name==='React'));
});

test('foundational priority follows assessment need and never inherits a legacy CV score',()=>{
 const learningPlan=plan('Backend Developer'),seeds=applyLearningSeeds([],learningPlan);
 const result=planNarrativeNodes(seeds,{userId:owner,targetRole:'Backend Developer',learningPlan,careerSkillProfile:{skills:[{name:'Git',normalizedName:'git',skillScore:100,confidence:1,sources:['resume']}]}});
 assert.ok(result.nodes.every(node=>node.priority==='high'));assert.ok(result.nodes.every(node=>node.context.skillEvidence.length===0));
});
