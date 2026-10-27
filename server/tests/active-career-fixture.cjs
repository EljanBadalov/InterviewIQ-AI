// Isolated controller fixture. Network/database connections remain fail-closed.
const f=require('./phase4d-generation-fixture.cjs');
const fields=f.load('services/careerFieldService');
const state={fieldReads:0,saves:0};
const names=['Backend Developer','Frontend Developer','Mobile Developer','Data Analyst','Product Designer'];
fields.resolveCareerField=async value=>{state.fieldReads++;await new Promise(r=>setTimeout(r,2));const key=String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-');const name=names.find(name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'-')===key);return name?{field:{slug:key,name},matchedBy:'slug',exactMatch:true}:null;};
const save=f.Automation.prototype.save;
f.Automation.prototype.save=async function(options){const existing=f.store.get(String(this.userId));if(this.isNew&&existing)throw Object.assign(new Error('Fixture duplicate owner'),{code:11000});if(!this.isNew){this.$where={userId:this.userId,__v:this.__v===undefined?{$exists:false}:this.__v};}state.saves++;const result=await save.call(this,options);if(!options?.session)f.change(String(this.userId),'roadmapAutomationRevision');return result;};
async function seed(){f.reset();state.fieldReads=state.saves=0;await f.service.createCareerAutomation(f.input());f.resetCounters();f.inference.calls.length=0;state.fieldReads=state.saves=0;}
module.exports={...f,state,names,seed};
