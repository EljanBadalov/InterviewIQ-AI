// Session-only launcher: no application source or persistent configuration changes.
const { createRequire } = require('node:module');
const path = require('node:path');
const dns = require('node:dns');
process.chdir(path.resolve(__dirname, '../../server'));
const localRequire = createRequire(path.join(process.cwd(), 'package.json'));
dns.setServers(['8.8.8.8', '1.1.1.1']);
const fs = require('node:fs');
const esbuild = localRequire('esbuild');
// Transpile current source in memory; avoid tsx's failing Windows userInfo call.
require.extensions['.ts'] = (module, filename) => {
  const result = esbuild.transformSync(fs.readFileSync(filename, 'utf8'), {
    sourcefile: filename, loader: 'ts', target: 'es2022', format: 'cjs',
  });
  module._compile(result.code, filename);
};
const mongoose = localRequire('mongoose');
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
const { env } = localRequire(path.join(process.cwd(), 'src/config/env.ts'));
const app = localRequire(path.join(process.cwd(), 'src/app.ts')).default;
async function start() {
  await mongoose.connect(env.MONGO_URI, {
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 15000,
  });
  await mongoose.connection.db.command({ ping: 1 });
  console.log(JSON.stringify({ mongo: 'connected', ping: 'ok', autoIndex: false, autoCreate: false, startupRecovery: false }));
  // Import app directly: server.ts recovery writes and timers are deliberately excluded.
  const server = app.listen(env.PORT, '127.0.0.1', () => {
    console.log(JSON.stringify({ backend: 'running', url: `http://localhost:${env.PORT}`, pid: process.pid }));
  });
  server.on('error', () => { console.error('Backend listen failed'); process.exit(1); });
  const ipv6 = app.listen(env.PORT, '::1', () => console.log('IPv6 localhost listener ready'));
  ipv6.on('error', () => { console.error('IPv6 listen failed'); process.exit(1); });
}
start().catch(error => {
  // Never print connection strings, database error bodies, credentials, or tokens.
  console.error(JSON.stringify({ startup: 'failed', errorType: error.name, code: error.code || null }));
  process.exit(1);
});
