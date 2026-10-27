const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const { MongoClient } = require('mongoose').mongo;
// Native driver only: never import models, initialize indexes, or write documents.
async function main() {
  if (!process.env.MONGO_URI) throw new Error('Missing MongoDB configuration');
  const client = new MongoClient(process.env.MONGO_URI, { maxPoolSize: 1, serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, socketTimeoutMS: 5000 });
  const result = { readOnly: true, indexes: {}, plans: {} };
  try {
    await client.connect();
    const db = client.db();
    await db.command({ ping: 1 });
    result.connected = true;
    for (const name of ['jobs', 'interviews', 'resumeanalyses', 'careerautomations', 'userskillprofiles']) {
      result.indexes[name] = (await db.collection(name).listIndexes({ maxTimeMS: 2000 }).toArray()).map(index => ({ name: index.name, key: index.key, unique: !!index.unique, sparse: !!index.sparse }));
    }
    const sources = ['Greenhouse', 'Lever', 'Ashby', 'SuccessFactors', 'Bir Careers', 'ABB Careers', 'Glorri'];
    for (const [name, filter] of [['activeJobs', { isActive: true }], ['supportedJobs', { isActive: true, source: { $in: sources } }]]) {
      const plan = await db.collection('jobs').find(filter).sort({ postedAt: -1, createdAt: -1 }).limit(18).maxTimeMS(2000).explain('executionStats');
      const stats = plan.executionStats;
      const stages = [];
      function visit(node) { if (!node || typeof node !== 'object') return; if (node.stage) stages.push({ stage: node.stage, ...(node.indexName ? { indexName: node.indexName } : {}) }); for (const value of Object.values(node)) { if (Array.isArray(value)) value.forEach(visit); else if (typeof value === 'object') visit(value); } }
      visit(plan.queryPlanner.winningPlan);
      result.plans[name] = { executionTimeMillis: stats.executionTimeMillis, nReturned: stats.nReturned, totalKeysExamined: stats.totalKeysExamined, totalDocsExamined: stats.totalDocsExamined, stages };
    }
    const destination = path.resolve(__dirname, '../node_modules/.cache/phase3/mongo-readonly.json');
    fs.writeFileSync(destination, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally { await client.close(); }
}
main().catch(error => { console.error(JSON.stringify({ readOnly: true, connected: false, errorType: error.name, code: error.code ?? null })); process.exitCode = 1; });
