// Session-only activation verification. No inference or database operations.
const Module = require('node:module');
const path = require('node:path');
const assert = require('node:assert/strict');
const originalLoad = Module._load;
const originalCompile = Module.prototype._compile;
const compiled = {};
Module.prototype._compile = function(code, filename) {
  if (filename === path.join(process.cwd(), 'src/services/interviewEvaluationService.ts'))
    compiled.truncationGuard = code.includes('EVALUATION_OUTPUT_TRUNCATED');
  if (filename === path.join(process.cwd(), 'src/services/qwenService.ts'))
    compiled.proxyDiagnostics = code.includes('recordInterviewProxyDiagnostics');
  return originalCompile.call(this, code, filename);
};
Module._load = function(request, parent, ...rest) {
  const result = originalLoad.call(this, request, parent, ...rest);
  if (request === path.join(process.cwd(), 'src/app.ts')) {
    const loaded = name => require.cache[path.join(process.cwd(), name)]?.exports;
    const contract = loaded('src/services/interviewEvaluationContract.ts');
    const metrics = loaded('src/services/interviewEvaluationMetrics.ts');
    const mongoose = require(require.resolve('mongoose', {paths:[process.cwd()]}));
    const checks = {
      ...compiled,
      modelUnavailableClassification: contract?.INTERVIEW_EVALUATION_FAILURES?.EVALUATION_MODEL_UNAVAILABLE === 'readiness',
      timeoutClassification: contract?.INTERVIEW_EVALUATION_FAILURES?.EVALUATION_TIMEOUT === 'transport',
      dispatchTelemetry: typeof metrics?.recordInterviewProxyDiagnostics === 'function',
      nodeOptionsInherited: process.env.NODE_OPTIONS === '--preserve-symlinks --preserve-symlinks-main',
      autoIndexDisabled: mongoose.get('autoIndex') === false,
      autoCreateDisabled: mongoose.get('autoCreate') === false,
      recoveryExcluded: !require.cache[path.join(process.cwd(), 'src/server.ts')],
    };
    assert.equal(checks.truncationGuard, true);
    assert.equal(checks.proxyDiagnostics, true);
    assert.ok(Object.values(checks).every(Boolean), 'Mock Interview repair activation failed');
    console.log(JSON.stringify({mockInterviewRepairVersion:'three-fixes-v1',checks}));
    Module._load = originalLoad;
    Module.prototype._compile = originalCompile;
  }
  return result;
};
