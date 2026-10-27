// Isolated model fixtures: no connection, external fetch, scraping, or real writes.
const path = require("node:path");
const { performance } = require("node:perf_hooks");
process.env.DOTENV_CONFIG_QUIET = "true";
global.fetch = async () => { throw new Error("Network is disabled in performance fixtures"); };
const mongoose = require("mongoose");
mongoose.connect = async () => { throw new Error("Database connection is disabled in fixtures"); };
const root = path.resolve(__dirname, "..", process.env.B4_BUILD_ROOT || (process.env.PHASE3_BASELINE === "1" ? "node_modules/.cache/phase3/baseline-dist" : "dist"));
const load = name => require(path.join(root, name));
const { Job } = load("models/Job");
const Automation = load("models/CareerAutomation").default;
const { ResumeAnalysis } = load("models/resumeAnalysis");
const { UserSkillProfile } = load("models/UserSkillProfile");
const { Interview } = load("models/Interview");
const { Question } = load("models/Question");
const matching = load("services/jobMatchingService");
const counters = { queries: [], computed: 0, matchingMs: 0, writes: 0, external: 0 };
const originalCalculate = matching.calculateJobMatch;
matching.calculateJobMatch = (...args) => {
  counters.computed++;
  const start = performance.now();
  const value = originalCalculate(...args);
  counters.matchingMs += performance.now() - start;
  return value;
};
const id = value => new mongoose.Types.ObjectId(value.toString(16).padStart(24, "0"));
const ownerA = id(111), ownerB = id(222);
const skills = ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "MongoDB", "Docker", "Git", "REST API", "CSS", "HTML", "Python"];
const resumes = [ownerA, ownerB].map((owner, index) => ({ _id: id(900 + index), user: owner, fileName: `fixture-${index}.pdf`, skillsDetected: index ? ["Python", "Docker"] : skills, overallScore: 70, rawText: "fixture text ".repeat(400), createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") }));
const jobs = Array.from({ length: Number(process.env.PHASE3_JOB_COUNT || 2000) }, (_, index) => ({ _id: id(1000 + index), title: index % 3 ? "Backend Developer" : "Frontend Engineer", company: "Fixture Company", source: ["Greenhouse", "Lever", "Ashby"][index % 3], externalId: `fixture-${index}`, location: index % 2 ? "Baku, Azerbaijan" : "Boston, MA", remoteType: index % 2 ? "remote" : "onsite", employmentType: index % 4 ? "full-time" : "contract", experienceMin: index % 5, experienceMax: index % 5 + 2, experienceLevel: "junior", salary: 1000 + index, skills: skills.slice(index % 5, index % 5 + 5), keywords: ["SQL", "API", "Docker"], description: "Fixture vacancy description. ".repeat(30), responsibilities: ["Build reliable services"], requirements: ["Relevant experience"], preferredQualifications: [], isActive: true, postedAt: new Date(1_750_000_000_000 + index * 1000), createdAt: new Date(1_750_000_000_000 + index * 1000), updatedAt: new Date("2026-01-01") }));
const interviews = [
  { _id: id(1), user: ownerA, status: "completed", overallScore: 71, category: "backend", difficulty: "beginner", interviewType: "technical", answers: [], createdAt: new Date("2026-01-01"), completedAt: new Date("2026-01-02") },
  { _id: id(2), user: ownerA, status: "completed", overallScore: 80, category: "backend", difficulty: "intermediate", interviewType: "technical", answers: [], createdAt: new Date("2026-01-03"), completedAt: new Date("2026-01-04") },
  { _id: id(3), user: ownerA, status: "in_progress", answers: [], createdAt: new Date("2026-01-05") },
  { _id: id(4), user: ownerB, status: "completed", overallScore: 99, answers: [], createdAt: new Date("2026-01-06") },
];
// Large fields are deliberately irrelevant to progress analytics.
for (const interview of interviews) {
  interview.finalReport = 'fixture report '.repeat(2000);
  interview.answers = [{ question: id(800), score: 72, technicalAccuracy: 70, completeness: 75, communication: 71, evaluationStatus: 'completed', weaknesses: ['Missing examples'], answerText: 'fixture private answer '.repeat(3000) }];
}
function clone(value) {
  if (value instanceof mongoose.Types.ObjectId) return new mongoose.Types.ObjectId(value.toString());
  if (value instanceof Date) return new Date(value);
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  return value;
}
function matches(row, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$or") return expected.some(part => matches(row, part));
    if (key === "$and") return expected.every(part => matches(row, part));
    const actual = row[key];
    if (expected instanceof RegExp) return expected.test(Array.isArray(actual) ? actual.join(" ") : String(actual || ""));
    if (expected && typeof expected === "object" && !(expected instanceof mongoose.Types.ObjectId)) {
      return Object.entries(expected).every(([operator, value]) => {
        if (operator === "$in") return value.some(item => String(item) === String(actual));
        if (operator === "$nin") return !value.some(item => String(item) === String(actual));
        if (operator === "$gte") return actual >= value;
        if (operator === "$lte") return actual <= value;
        if (operator === "$ne") return actual !== value;
        if (operator === "$exists") return (actual !== undefined) === value;
        if (operator === "$not") return !matches({ value: actual }, { value });
        if (operator === "$regex") return value.test(String(actual));
        throw new Error(`Unsupported fixture operator: ${operator}`);
      });
    }
    return String(actual) === String(expected);
  });
}
class Query {
  constructor(model, rows, filter, one = false, count = false) { Object.assign(this, { model, rows, filter, one, count }); this.offset = 0; this.take = 0; }
  sort(value) { this.order = value; return this; }
  select(value) { this.projection = value; return this; }
  skip(value) { this.offset = value; return this; }
  limit(value) { this.take = value; return this; }
  lean() { return this; }
  maxTimeMS() { return this; }
  read() { return this; }
  readConcern() { return this; }
  async exec() {
    await new Promise(resolve => setTimeout(resolve, 2));
    let result = this.rows.filter(row => matches(row, this.filter));
    if (this.order) result.sort((a, b) => {
      for (const [key, direction] of Object.entries(this.order)) { const difference = Number(a[key] || 0) - Number(b[key] || 0); if (difference) return difference * direction; }
      return 0;
    });
    const total = result.length;
    result = result.slice(this.offset, this.take ? this.offset + this.take : undefined);
    if (this.one) result = result.slice(0, 1);
    if (typeof this.projection === "string") {
      const keys = this.projection.split(/\s+/).filter(key => key && !key.startsWith("-"));
      const answerKeys = keys.filter(key => key.startsWith('answers.')).map(key => key.slice(8));
      result = result.map(row => {
        const selected = Object.fromEntries([...new Set(['_id', ...keys])].filter(key => !key.includes('.') && row[key] !== undefined).map(key => [key, row[key]]));
        if (answerKeys.length) selected.answers = row.answers.map(answer => Object.fromEntries(answerKeys.filter(key => answer[key] !== undefined).map(key => [key, answer[key]])));
        return selected;
      });
    }
    counters.queries.push({ model: this.model, filter: this.filter, returned: this.count ? 0 : result.length, count: this.count, projection: this.projection, bytes: this.count ? 0 : Buffer.byteLength(JSON.stringify(result)) });
    if (this.count) return total;
    const rows = clone(result);
    return this.one ? rows[0] || null : rows;
  }
  then(resolve, reject) { return this.exec().then(resolve, reject); }
}
const fixtureAutomation = owner => ({ _id: id(String(owner) === String(ownerB) ? 502 : 501), userId: owner, status: "active", targetRole: "Backend Developer", activeResumeId: resumes.find(resume => String(resume.user) === String(owner))?._id, jobPreferences: { targetRoles: ["Backend Developer"], experienceLevels: ["junior"] }, jobMatches: [], lastJobSearchAt: new Date("2026-01-01") });
Job.find = filter => new Query("jobs", jobs, filter);
Job.findOne = filter => new Query("jobs", jobs, filter, true);
Job.countDocuments = filter => new Query("jobs", jobs, filter, false, true);
Automation.findOne = filter => new Query("automations", [fixtureAutomation(ownerA), fixtureAutomation(ownerB)], filter, true);
ResumeAnalysis.findOne = filter => new Query("resumes", resumes, filter, true);
UserSkillProfile.findOne = filter => new Query("skills", [{ user: ownerA, skills: [] }, { user: ownerB, skills: [] }], filter, true);
Interview.find = filter => new Query("interviews", interviews, filter);
Interview.countDocuments = filter => new Query("interviews", interviews, filter, false, true);
Question.find = filter => new Query("questions", [], filter);
Interview.aggregate = async pipeline => {
  await new Promise(resolve => setTimeout(resolve, 2));
  const rows = interviews.filter(row => matches(row, pipeline[0].$match));
  const scores = rows.filter(row => row.status === "completed" && typeof row.overallScore === "number").map(row => row.overallScore);
  counters.queries.push({ model: "interview-aggregate", returned: 1 });
  return rows.length ? [{ _id: null, totalInterviews: rows.length, completedInterviews: rows.filter(row => row.status === "completed").length, inProgressInterviews: rows.filter(row => row.status === "in_progress").length, scoreTotal: scores.reduce((a, b) => a + b, 0), scoredCount: scores.length, bestScore: scores.length ? Math.max(...scores) : null }] : [];
};
// Fail closed if an unmocked persistence operation is accidentally introduced.
for (const model of [Job, Automation, ResumeAnalysis, UserSkillProfile, Interview, Question]) {
  for (const method of ["create", "updateOne", "updateMany", "deleteOne", "deleteMany", "findOneAndUpdate", "bulkWrite"]) model[method] = async () => { throw new Error(`Unmocked fixture write: ${method}`); };
}
mongoose.Model.prototype.save = async () => { throw new Error("Unmocked fixture save"); };
const jobsController = load("controllers/jobController");
const dashboard = load("controllers/dashboardController");
// Keep inference and knowledge lookups isolated; neither fixture invokes Qwen.
load('services/progressInsightService').generateProgressInsights = async () => ({ summary: 'Fixture insight' });
load('services/careerKnowledgeService').buildCareerKnowledgeContext = async () => ({ found: false,topics:[],strongTopics:[],priorityTopics:[],coreSkills:[],roleSkills:[],tools:[],interviewTopics:[],practicalScenarios:[] });
load('services/careerFieldService').resolveCareerField=async target=>({field:{name:target,slug:target.toLowerCase().replaceAll(' ','-')}});
const progress = load('controllers/progressController');
async function request(handler, query = {}, owner = ownerA, params = {}) {
  let error;
  const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ user: owner ? { _id: owner } : undefined, query, params }, response, value => { error = value; });
  if (error) throw error;
  return response;
}
function resetCounters() { counters.queries.length = 0; counters.computed = 0; counters.matchingMs = 0; counters.writes = 0; counters.external = 0; }
module.exports = { progress, root, load, jobsController, dashboard, request, resetCounters, counters, matching, jobs, resumes, interviews, ownerA, ownerB, id, Query, clone, Job, Automation, ResumeAnalysis, UserSkillProfile, Interview };
