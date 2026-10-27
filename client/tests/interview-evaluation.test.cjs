const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const transpile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const helper={exports:{}};
vm.runInNewContext(transpile(fs.readFileSync(path.join(__dirname,'../src/pages/dashboard/interviewSessionPage/evaluationContract.ts'),'utf8')),helper);
const valid=helper.exports.isAcceptedInterviewEvaluation;
const source=ts.createSourceFile('page.tsx',fs.readFileSync(path.join(__dirname,'../src/pages/dashboard/interviewSessionPage/InterviewSessionPage.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const handlers={};
function walk(node){if(ts.isVariableDeclaration(node)&&['submitAnswer','handleContinue'].includes(node.name.getText(source)))handlers[node.name.getText(source)]=node.initializer.getText(source);ts.forEachChild(node,walk);}walk(source);
function evaluation(strengths=[],weaknesses=[]){return {score:20,technicalAccuracy:20,completeness:20,communication:30,strengths,weaknesses,feedback:'The submitted answer does not explain the requested mechanism; include a concrete demonstration.',improvedAnswer:'Explain the relevant mechanism and demonstrate it with a concrete example, expected output and a limitation.'};}
function fixture(data){
 const changes=[],ctx={exports:{},isAcceptedInterviewEvaluation:valid,session:{question:{questionId:'q1'},currentQuestionIndex:0,totalQuestions:6},interviewId:'fixture-interview',canSubmit:true,answer:'SYNTHETIC ANSWER',loading:false,completed:false,pendingNextQuestion:null,pendingNextQuestionIndex:null,axios:{isAxiosError:e=>!!e.response},apiClient:{post:async(url,payload)=>{changes.push(['request',url,payload]);return {data:{data}};}}};
 for(const [setter,key] of Object.entries({setSession:'session',setLoading:'loading',setError:'error',setEvaluation:'evaluation',setPendingNextQuestion:'pendingNextQuestion',setPendingNextQuestionIndex:'pendingNextQuestionIndex',setCompleted:'completed',setFinalOverallScore:'overallScore',setShowCompletionScreen:'showCompletionScreen',setAnswer:'answer'}))ctx[setter]=v=>{ctx[key]=typeof v==='function'?v(ctx[key]):v;changes.push([setter,ctx[key]]);};
 vm.runInNewContext(transpile('export const submit='+handlers.submitAnswer+';export const next='+handlers.handleContinue+';'),ctx);
 return {ctx,changes,submit:ctx.exports.submit,next:ctx.exports.next};
}
for(const [strengths,weaknesses] of [[[],[]],[[],['Explain a concrete example.']],[['The response names the relevant concept.'],[]]])test('empty observation arrays are valid without invented content: '+strengths.length+'/'+weaknesses.length,async()=>{
 const result=evaluation(strengths,weaknesses);assert.equal(valid(result),true);
 const f=fixture({evaluation:result,completed:false,nextQuestion:{questionId:'q2',questionText:'Fixture next question'},nextQuestionIndex:1});await f.submit();
 assert.equal(f.ctx.error,'');assert.equal(f.ctx.session.currentQuestionIndex,0,'Show evaluation before Continue');
 assert.equal(JSON.stringify(f.ctx.evaluation.strengths),JSON.stringify(strengths));assert.equal(JSON.stringify(f.ctx.evaluation.weaknesses),JSON.stringify(weaknesses));
 assert.equal(f.changes.filter(x=>x[0]==='request').length,1);
 f.next();assert.equal(f.ctx.session.currentQuestionIndex,1);assert.equal(f.ctx.session.question.questionId,'q2');assert.equal(f.ctx.evaluation,null);
});
for(const bad of [{strengths:undefined},{weaknesses:'invalid'},{strengths:[12]},{score:NaN},{score:101},{feedback:''},{improvedAnswer:'short'}])test('malformed public evaluation remains rejected: '+Object.keys(bad)[0]+String(Object.values(bad)[0]),async()=>{
 const data={...evaluation(),...bad};assert.equal(valid(data),false);const f=fixture({evaluation:data,nextQuestion:{questionId:'q2'}});await f.submit();
 assert.ok(f.ctx.error);assert.equal(f.ctx.evaluation,undefined);assert.equal(f.ctx.pendingNextQuestion,null);assert.equal(f.ctx.session.currentQuestionIndex,0);
});
test('last valid answer with empty arrays retains feedback until Finish',async()=>{
 const f=fixture({evaluation:evaluation(),completed:true,overallScore:25});f.ctx.session.currentQuestionIndex=5;await f.submit();
 assert.equal(f.ctx.completed,true);assert.equal(f.ctx.overallScore,25);assert.equal(f.ctx.pendingNextQuestion,null);assert.ok(f.ctx.evaluation);
 f.next();assert.equal(f.ctx.showCompletionScreen,true);
});
test('legacy flat response remains compatible',async()=>{
 const f=fixture({...evaluation(),nextQuestion:{questionId:'q2'},nextQuestionIndex:1});await f.submit();assert.equal(f.ctx.error,'');assert.ok(f.ctx.evaluation);assert.equal(f.ctx.pendingNextQuestion.questionId,'q2');
});
test('503 keeps answer and current question with no automatic resubmission',async()=>{
 const f=fixture({});let calls=0;f.ctx.apiClient.post=async()=>{calls++;throw {response:{data:{message:'AI service unavailable'}}};};await f.submit();
 assert.equal(calls,1);assert.equal(f.ctx.answer,'SYNTHETIC ANSWER');assert.equal(f.ctx.session.currentQuestionIndex,0);assert.equal(f.ctx.error,'AI service unavailable');assert.equal(f.ctx.loading,false);
});
