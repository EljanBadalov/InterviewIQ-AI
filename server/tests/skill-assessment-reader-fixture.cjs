const f=require('./phase4d-generation-fixture.cjs');
const {ResumeAnalysis}=f.load('models/resumeAnalysis'),{UserSkillProfile}=f.load('models/UserSkillProfile'),{Interview}=f.load('models/Interview'),{Question}=f.load('models/Question');
const rows={resumes:[],profiles:[],interviews:[],questions:[]};
const state={reads:[],fail:undefined,injectForeign:false,delayMs:2};
function reset(){
 state.reads=[];state.fail=undefined;state.injectForeign=false;
 rows.resumes=[{_id:f.id(900),user:f.ownerA,skillsDetected:['SQL','JavaScript'],updatedAt:new Date('2026-01-01'),rawText:'PRIVATE CV',fileName:'PRIVATE FILE'},{_id:f.id(901),user:f.ownerB,skillsDetected:['Docker']}];
 rows.profiles=[{user:f.ownerA,skills:[{name:'SQL',sources:['technical-question'],averageScore:99,evidence:[{source:'technical-question',sourceId:f.id(1),score:99,note:'PRIVATE NOTE'}]}]},{user:f.ownerB,skills:[]}];
 rows.interviews=[{_id:f.id(1),user:f.ownerA,status:'completed',interviewType:'technical',completedAt:new Date('2026-02-01'),answers:[{question:f.id(800),score:20,evaluationStatus:'completed',answerText:'PRIVATE ANSWER'}]},{_id:f.id(2),user:f.ownerA,status:'completed',interviewType:'technical',completedAt:new Date('2026-02-02'),answers:[{question:f.id(800),score:30,evaluationStatus:'completed'}]},{_id:f.id(3),user:f.ownerA,status:'in_progress',interviewType:'technical',answers:[{question:f.id(800),score:100,evaluationStatus:'completed'}]},{_id:f.id(4),user:f.ownerB,status:'completed',interviewType:'technical',completedAt:new Date('2026-02-02'),answers:[{question:f.id(800),score:99,evaluationStatus:'completed'}]}];
 rows.questions=[{_id:f.id(800),tags:['SQL'],interviewType:'technical',difficulty:'beginner',updatedAt:new Date('2026-01-01'),text:'PRIVATE QUESTION CONTENT'}];
}
const pick=(row,keys)=>Object.fromEntries(keys.filter(key=>row[key]!==undefined).map(key=>[key,row[key]]));
function project(name,row){
 if(name==='resumes')return pick(row,['_id','user','skillsDetected','updatedAt']);
 if(name==='profiles')return {user:row.user,skills:row.skills.map(s=>({name:s.name,sources:s.sources,evidence:s.evidence?.map(e=>pick(e,['source','sourceId']))}))};
 if(name==='interviews')return {...pick(row,['_id','user','status','interviewType','completedAt']),answers:row.answers.map(a=>pick(a,['question','score','technicalAccuracy','evaluationStatus']))};
 return pick(row,['_id','tags','interviewType','difficulty','updatedAt']);
}
class Query{
 constructor(name,filter,one){this.name=name;this.filter=filter;this.one=one;}
 read(value){this.preference=value;return this;}readConcern(value){this.concern=value;return this;}maxTimeMS(value){this.timeout=value;return this;}select(value){this.projection=value;return this;}sort(value){this.order=value;return this;}lean(){return this;}
 async exec(){await new Promise(r=>setTimeout(r,state.delayMs));state.reads.push({name:this.name,filter:this.filter,projection:this.projection,read:this.preference,concern:this.concern,maxTimeMS:this.timeout});if(state.fail===this.name)throw new Error('Fixture source unavailable');
 let values=rows[this.name].filter(row=>Object.entries(this.filter).every(([k,v])=>v?.$in?v.$in.some(id=>String(id)===String(row[k])):String(row[k])===String(v)));
 if(this.name==='interviews'&&state.injectForeign)values.push(rows.interviews.find(row=>String(row.user)===String(f.ownerB)));
 if(this.one)values=values.slice(0,1);const result=values.map(row=>project(this.name,row));return f.clone(this.one?result[0]||null:result);
 }
 then(resolve,reject){return this.exec().then(resolve,reject);}
}
ResumeAnalysis.findOne=filter=>new Query('resumes',filter,true);
UserSkillProfile.findOne=filter=>new Query('profiles',filter,true);
Interview.find=filter=>new Query('interviews',filter,false);
Question.find=filter=>new Query('questions',filter,false);
reset();module.exports={...f,rows,state,reset};
