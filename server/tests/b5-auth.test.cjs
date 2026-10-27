const test=require('node:test'),assert=require('node:assert/strict');
process.env.JWT_SECRET='isolated-b5-fixture-secret';
const f=require('./phase3-fixture.cjs'),{User}=f.load('models/User'),{protect}=f.load('middleware/authMiddleware'),jwt=require('jsonwebtoken');
const original=User.findById;test.after(()=>User.findById=original);
async function request(token){let next=false;const req={headers:token?{authorization:'Bearer '+token}:{},method:'GET',path:'/progress'};const res={statusCode:200,status(v){this.statusCode=v;return this;},json(body){this.body=body;return this;}};await protect(req,res,()=>{next=true;});return {req,res,next};}
test('career read reuses one authenticated User query and keeps hidden counters out of req.user',async()=>{
 let reads=0,projection;User.findById=id=>{reads++;assert.equal(id,String(f.ownerA));const user=User.hydrate({_id:f.ownerA,fullName:'Fixture',email:'fixture@example.invalid',role:'user',roadmapEvidenceRevision:4,roadmapAutomationRevision:6});return {select(value){projection=value;return this;},read(){return this;},readConcern(){return this;},then(resolve){return Promise.resolve(user).then(resolve);}};};
 const r=await request(jwt.sign({id:String(f.ownerA)},process.env.JWT_SECRET));assert.equal(r.next,true);assert.equal(reads,1);assert.ok(projection.includes('roadmapEvidenceRevision'));assert.deepEqual(r.req.careerReadVersions,{evidenceRevision:4,automationRevision:6});assert.equal(r.req.user.toObject().roadmapEvidenceRevision,undefined);
});
test('missing or invalid authentication never reads evidence or exposes internal counters',async()=>{
 User.findById=()=>{throw Error('Unexpected unauthorized database read');};for(const token of [undefined,'invalid']){const r=await request(token);assert.equal(r.res.statusCode,401);assert.equal(r.next,false);assert.equal(r.req.careerReadVersions,undefined);assert.equal('careerContext' in r.res.body,false);}
});
