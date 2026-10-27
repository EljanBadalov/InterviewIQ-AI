import './config/mongoSafety';
import { recoverStaleRoadmapGenerations } from './services/roadmapGenerationService';
import app from './app';
import mongoose from 'mongoose';
import { connectDB } from './config/db';
import { env } from './config/env';

const startServer = async (): Promise<void> => {
  try {
    await connectDB();
    let recovery: ReturnType<typeof setInterval> | undefined;
    // Explicit operational opt-in only; no recovery writes during normal deployment startup.
    if (process.env.ENABLE_STARTUP_RECOVERY === 'true') {
      const recover = () => recoverStaleRoadmapGenerations().catch(() => console.warn('[Roadmap Generation] Recovery failed'));
      await recover(); recovery = setInterval(recover,60000); recovery.unref();
    }
    const server = app.listen(env.PORT,'0.0.0.0',() => console.log(JSON.stringify({backend:'running',port:env.PORT,startupRecovery:process.env.ENABLE_STARTUP_RECOVERY==='true'})));
    const shutdown = () => {
      if (recovery) clearInterval(recovery);
      server.close(() => { void mongoose.disconnect().finally(() => process.exit(0)); });
    };
    process.once('SIGTERM',shutdown); process.once('SIGINT',shutdown);
  } catch (error) {
    console.error(JSON.stringify({startup:'failed',errorType:error instanceof Error ? error.name : 'UnknownError'}));
    process.exitCode=1;
  }
};
void startServer();
