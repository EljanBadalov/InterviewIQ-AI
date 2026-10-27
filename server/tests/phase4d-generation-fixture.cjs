// Real coordinator + real commit adapter, with transactional in-memory model operations.
const path=require('node:path');
const buildRoot=path.resolve(__dirname,'..',process.env.B3_BASELINE_ROOT || 'dist');
const coordination=require(path.join(buildRoot,'services/roadmapGenerationService'));
const coordinate=coordination.coordinateRoadmapGeneration;
const f=require('./phase4c-roadmap-fixture.cjs');
coordination.coordinateRoadmapGeneration=coordinate;
const mongoose=require('mongoose');
const {User}=require(path.join(buildRoot,'models/User'));
const {CareerKnowledge}=f.load('models/CareerKnowledge');
f.Query.prototype.session=function(){return this;};
f.Query.prototype.readConcern=function(){return this;};
f.Query.prototype.read=function(){return this;};
CareerKnowledge.find=filter=>new f.Query('knowledge',[f.role],filter);
const accounts=new Map();
const data={failCommit:false,failHeartbeat:false,beforeCommit:undefined,delayInference:0,coordQueries:0,coordReads:0,coordWrites:0,transactions:0};
const clone=value=>f.clone(value);
function matches(row,filter){
 return Object.entries(filter).every(([key,value])=>{
  if(key==='$and')return value.every(item=>matches(row,item));
  if(key==='$or')return value.some(item=>matches(row,item));
  const current=key.split('.').reduce((object,part)=>object?.[part],row);
  if(value&&typeof value==='object'&&!(value instanceof Date)&&!(value instanceof mongoose.Types.ObjectId))return Object.entries(value).every(([op,v])=>op==='$exists'?(current!==undefined)===v:op==='$in'?v.includes(current):op==='$gt'?Number(current)>Number(v):op==='$lte'?Number(current)<=Number(v):false);
  return String(current)===String(value);
 });
}
function assign(row,key,value){const parts=key.split('.');let cursor=row;for(const part of parts.slice(0,-1))cursor=cursor[part]??={};cursor[parts.at(-1)]=clone(value);}
function transactionRow(owner,session){
 if(!session)return accounts.get(owner);
 if(!session.users.has(owner)){session.versions.set(owner,accounts.get(owner)?._storageVersion || 0);session.users.set(owner,clone(accounts.get(owner)));}
 return session.users.get(owner);
}
class AccountQuery {
 constructor(filter,one){this.filter=filter;this.one=one;}
 select(){return this;}sort(){return this;}read(){return this;}readConcern(){return this;}maxTimeMS(){return this;}session(value){this.tx=value;return this;}lean(){return this;}limit(){return this;}
 async exec(){data.coordQueries++;data.coordReads++;await new Promise(resolve=>setTimeout(resolve,2));const rows=[...accounts.values()].map(row=>transactionRow(String(row._id),this.tx)).filter(row=>matches(row,this.filter));return clone(this.one?rows[0]||null:rows);}
 then(resolve,reject){return this.exec().then(resolve,reject);}
}
User.findById=owner=>new AccountQuery({_id:owner},true);
User.find=filter=>new AccountQuery(filter,false);
User.updateOne=async(filter,update,options={})=>{
 data.coordQueries++;data.coordWrites++;
 if(data.failHeartbeat&&update.$set?.['roadmapGeneration.leaseUntil'])return {matchedCount:0,modifiedCount:0};
 const owner=String(filter._id),row=transactionRow(owner,options.session);
 if(!row||!matches(row,filter))return {matchedCount:0,modifiedCount:0};
 for(const [key,value] of Object.entries(update.$set||{}))assign(row,key,value);
 for(const [key,value] of Object.entries(update.$inc||{})){const previous=key.split('.').reduce((v,p)=>v?.[p],row)||0;assign(row,key,previous+value);}
 row._storageVersion=(row._storageVersion||0)+1;
 return {matchedCount:1,modifiedCount:1};
};
mongoose.connection.transaction=async work=>{
 data.transactions++;
 const session={users:new Map(),versions:new Map(),autos:new Map(),inTransaction:()=>true};
 const result=await work(session);
 if(data.beforeCommit)await data.beforeCommit();
 if(data.failCommit)throw new Error('Fixture database write failed');
 for(const [owner,version] of session.versions)if((accounts.get(owner)?._storageVersion||0)!==version)throw Object.assign(new Error('Fixture transaction conflict'),{name:'VersionError'});
 for(const [owner,row] of session.users)accounts.set(owner,row);
 for(const [owner,row] of session.autos)f.store.set(owner,row);
 return result;
};
f.Automation.prototype.save=async function(options={}){
 const owner=String(this.userId),existing=f.store.get(owner);
 if(!this.isNew&&this.$where&&(!existing||!matches(existing,this.$where)))throw Object.assign(new Error('Fixture document changed'),{name:'DocumentNotFoundError'});
 f.counters.writes++;
 this.createdAt=this.createdAt || new Date();this.updatedAt=new Date();
 this.__v=this.isNew?0:(this.__v || 0)+1;this.isNew=false;
 const row=clone(this.toObject());
 if(options.session)options.session.autos.set(owner,row);else f.store.set(owner,row);
 return this;
};
const inference=f.load('services/qwenService').generateQwenJSON;
f.load('services/qwenService').generateQwenJSON=async options=>{if(data.onInference)await data.onInference();if(data.delayInference)await new Promise(resolve=>setTimeout(resolve,data.delayInference));return inference(options);};
const originalReset=f.reset;
function reset(){originalReset();accounts.clear();for(const owner of [f.ownerA,f.ownerB])accounts.set(String(owner),{_id:owner,roadmapEvidenceRevision:0,roadmapAutomationRevision:0,_storageVersion:0});Object.assign(data,{failCommit:false,failHeartbeat:false,beforeCommit:undefined,onInference:undefined,delayInference:0,coordQueries:0,coordReads:0,coordWrites:0,transactions:0});}
function change(owner,field){const row=accounts.get(String(owner));row[field]=(row[field]||0)+1;row._storageVersion++;}
module.exports={...f,reset,accounts,data,change,coordination,matches,User,mongoose};
