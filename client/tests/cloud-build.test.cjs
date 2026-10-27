const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),vm=require('node:vm');
const source=ts.createSourceFile('vite.config.ts',fs.readFileSync(path.join(__dirname,'../vite.config.ts'),'utf8'),ts.ScriptTarget.Latest,true);
const node=source.statements.find(ts.isExportAssignment).expression.arguments[0];
function config(env={},values={}){
 const context={exports:{},process:{cwd:()=>'.',env},loadEnv:()=>values,react:()=>({}),URL};
 vm.runInNewContext(ts.transpileModule('export const run = '+node.getText(source),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return context.exports.run({mode:'production'});
}
test('cloud build accepts actual HTTPS API shape',()=>assert.equal(config({VERCEL:'1',VITE_API_URL:'https://api.example.com/api/v1'}).base,'/'));
test('cloud build rejects localhost HTTP and missing API',()=>{
 for(const url of ['http://localhost:5000/api/v1','https://localhost/api/v1','https://api.example.com','https://user:secret@api.example.com/api/v1',''])assert.throws(()=>config({VERCEL:'1',VITE_API_URL:url}));
});
test('local development/preview configuration stays compatible',()=>assert.equal(config({}, {VITE_API_URL:'http://localhost:5000/api/v1'}).base,'/'));
test('SPA rewrite preserves direct navigation',()=>{
 const file=JSON.parse(fs.readFileSync(path.join(__dirname,'../vercel.json'),'utf8'));assert.ok(file.rewrites.some(r=>r.destination==='/index.html'));
});
