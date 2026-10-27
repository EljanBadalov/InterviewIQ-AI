// In-memory source fixtures only. No database connection, network or model inference.
const f=require('./phase4d-generation-fixture.cjs');
const user=String(f.ownerA),other=String(f.ownerB);
const profile={user:f.ownerA,skills:[{name:'SQL',normalizedName:'sql',confidence:.7,level:'intermediate',evidenceCount:2,sources:['technical-question'],evidence:[{source:'technical-question',sourceId:f.id(1),score:95,recordedAt:new Date('2026-01-01')},{source:'technical-question',sourceId:f.id(2),score:30,recordedAt:new Date('2026-01-02')}]}]};
f.UserSkillProfile.findOne=filter=>new f.Query('skills',[profile],filter,true);
module.exports={...f,user,other,profile};
