// Deterministic in-memory persistence and inference only; no live generation.
const f = require('./phase4c-base-fixture.cjs');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const RealDate = Date;
const fixed = RealDate.parse('2026-10-24T08:00:00.000Z');
global.Date = class Date extends RealDate { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } static [Symbol.hasInstance](value) { return value instanceof RealDate; } };
const mongoose = require('mongoose');
for (const method of ['find','findOne','insertOne','updateOne','deleteOne','createIndex']) mongoose.Collection.prototype[method] = () => { throw new Error(`Unmocked fixture collection operation: ${method}`); };
const store = new Map();
const inference = { calls: [], version: 'Current', fail: false };
for (const resume of f.resumes) Object.assign(resume, { fileId: f.id(8000 + Number(String(resume._id).slice(-2))), atsScore: 70, contentScore: 68, structureScore: 75, skillsScore: 72, experienceScore: 65, summary: 'Fixture resume', strengths: ['TypeScript experience'], weaknesses: ['Add measurable results'], missingSkills: ['Testing'], atsSuggestions: [], formattingFeedback: [], recommendations: ['Document project outcomes'] });
for (const interview of f.interviews) { interview.finalReport = { summary: 'Fixture interview', strengths: ['Clear explanations'], improvements: ['Provide concrete examples'], recommendations: ['Practice API design'] }; interview.answers.forEach(a => { a.questionText = 'Explain a reliable API'; a.strengths = ['Clear']; }); }
f.ResumeAnalysis.find = filter => new f.Query('resumes', f.resumes, filter);
f.Interview.findOne = filter => new f.Query('interviews', f.interviews, filter, true);
class AutomationQuery extends f.Query {
  lean() { this.plain = true; return this; }
  async exec() { const value = await super.exec(); return value && !this.plain ? f.Automation.hydrate(value) : value; }
}
f.Automation.findOne = filter => new AutomationQuery('automations', [...store.values()], filter, true);
f.Automation.prototype.save = async function () { f.counters.writes++; store.set(String(this.userId), f.clone(this.toObject())); return this; };
f.Automation.create = async data => { const doc = f.Automation.hydrate({ _id: f.id(501), ...data, createdAt: new Date(), updatedAt: new Date() }); await doc.save(); return doc; };
const { CareerKnowledge } = f.load('models/CareerKnowledge');
const role = { _id: f.id(700), domain: 'technology', status: 'active', source: 'internal', sourceVersion: 'fixture-v1', role: { slug: 'backend-developer', title: 'Backend Developer', aliases: [], coreSkills: ['SQL'], roleSkills: ['Node.js'], tools: ['Docker'], knowledgeAreas: ['APIs'], responsibilities: ['Build services'], recommendedProjects: ['Build a tested service'], interviewTopics: [], practicalScenarios: [], topics: ['SQL','Node.js','Docker','API Testing'].map((name,i) => ({ id: `topic-${i}`, name, normalizedName: name.toLowerCase(), type: 'skill', category: i ? 'role' : 'core', level: 'intermediate', importance: 'high', prerequisites: [], subtopics: [], practicalScenarios: ['Demonstrate reliable behavior'], expectedEvidence: ['Working project'], relatedTools: [], relatedSkills: [] })) }, tags: [] };
CareerKnowledge.findOne = filter => { const requested = filter['role.slug'] ?? filter['role.title']; const found = typeof requested === 'string' ? requested === 'backend-developer' : requested instanceof RegExp ? requested.test('Backend Developer') : false; return new f.Query('knowledge', found ? [role] : [], {}, true); };
f.load('services/qwenService').generateQwenJSON = async options => {
  const started = performance.now();
  await new Promise(resolve => setTimeout(resolve, 5));
  const modern=!options.messages[1].content.includes('CAREER EVIDENCE:');
  const context = modern?JSON.parse(options.messages[1].content):JSON.parse(options.messages[1].content.split('CAREER EVIDENCE:\n')[1]);
  const record = { ms: performance.now()-started, maxTokens: options.maxCompletionTokens, timeoutMs: options.timeoutMs, retries: options.retries, temperature: options.temperature, topP: options.topP, promptBytes: Buffer.byteLength(JSON.stringify(options.messages)), promptHash:createHash("sha256").update(JSON.stringify(options.messages)).digest("hex"), sections:modern?new Set(context.nodes.map(node=>node.category)).size:context.sections.length, nodes:modern?context.nodes.length:0 };
  record.privateSourceIncluded=[String(f.ownerA),String(f.ownerB),'fixture-0.pdf','fixture private answer','fixture text fixture text'].some(value=>JSON.stringify(options.messages).includes(value));
  inference.calls.push(record);
  if (inference.fail) return { success: false, error: 'Fixture inference unavailable' };
  if(inference.mode==='timeout')throw Object.assign(new Error('Fixture timeout'),{name:'AbortError'});
  if(inference.mode==='jsonerror')return {success:false,error:'Qwen returned invalid JSON format'};
  if(inference.mode==='invalid')return {success:true,data:{nodes:'not an array'}};
  if(modern){
    const data={nodes:context.nodes.map(node=>({id:node.id,whyItMatters:`${inference.version}: ${node.label} directly supports the selected role and current evidence.`,action:`${inference.version}: Implement and review a focused example for ${node.label}.`,proofOfCompletion:'Keep the working example, tests and a short review of the result.'}))};
    if(inference.mode==='malicious')data.nodes.forEach(node=>{node.priority='low';node.readinessScore=100;node.status='completed';});
    if(inference.mode==='partial')data.nodes.pop();
    record.completionBytes=Buffer.byteLength(JSON.stringify(data));
    return {success:true,data};
  }
  return { success: true, data: { milestones: context.sections.map(section => ({ category: section.category, title: `${inference.version} ${section.category}`, description: `Focused ${section.category} plan`, reason: 'Based on supplied evidence', recommendations: [0,1].map(i => ({ title: `${inference.version} ${section.relatedSkills[i] || section.category} action ${i}`, whyItMatters: 'Supports the selected role', whatToLearn: section.relatedSkills.slice(0,2), action: `Demonstrate ${section.relatedSkills[0] || section.category}`, proofOfCompletion: 'A working documented example', priority: 'high', source: 'combined', evidence: section.evidence.slice(0,1) })) })) } };
};
const originalInference=f.load('services/qwenService').generateQwenJSON;
f.load('services/qwenService').generateQwenJSON=async options=>{
 let response;
 try { response=await originalInference(options);return response; }
 finally { const row=inference.calls.at(-1);if(row){row.promptEstimate=Math.ceil(row.promptBytes/4);row.completionBytes=response?.data?Buffer.byteLength(JSON.stringify(response.data)):0;row.completionEstimate=Math.ceil(row.completionBytes/4);} }
};
const narrativeMetrics=[];
if(process.env.PHASE4C_BASELINE!=='1') {
 const narrative=f.load('services/roadmapNarrativeService');
 const generate=narrative.generateRoadmapNarratives;
 narrative.generateRoadmapNarratives=async input=>{
  const result=await generate(input);
  narrativeMetrics.push({...narrative.getRoadmapNarrativeMetrics(result)});
  return result;
 };
}
// Existing planner/narrative contract tests mock the separate coordination boundary.
const fs4d=require('node:fs'), path4d=require('node:path');
if(fs4d.existsSync(path4d.join(f.root,'services/roadmapGenerationService.js')))
 f.load('services/roadmapGenerationService').coordinateRoadmapGeneration=(_owner,_operation,_input,work)=>work();
const service = f.load('services/careerAutomationService');
const controller = f.load('controllers/careerAutomationController');
const goal = f.load('services/careerGoalService');
const input = owner => ({ userId: String(owner || f.ownerA), targetRole: 'Backend Developer', careerGoal: 'Prepare for a backend role', roadmapDurationDays: 90, activeResumeId: String(f.resumes.find(r => String(r.user) === String(owner || f.ownerA))._id), settings: { automaticReplanningEnabled: true, maxDailyTasks: 5, preferredDailyMinutes: 90 } });
function reset() { narrativeMetrics.length=0; store.clear(); inference.calls.length=0; inference.version='Current'; inference.fail=false; inference.mode=undefined; if(process.env.PHASE4C_BASELINE!=='1')f.load('services/roadmapNarrativeCache').clearRoadmapNarrativeCache(); f.resetCounters(); f.matching.clearJobMatchCache?.(); }
async function invoke(handler, body = {}, owner = f.ownerA, params = {}) { const response = { statusCode: 200, status(code) { this.statusCode=code;return this; }, json(value) { this.body=JSON.parse(JSON.stringify(value));return this; } }; await handler({ user: owner ? { _id: owner } : undefined, body, query:{}, params }, response); return response; }
module.exports = { ...f, store, inference, narrativeMetrics, role, service, controller, goal, input, reset, invoke };
