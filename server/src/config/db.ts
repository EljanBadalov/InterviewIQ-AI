import './mongoSafety';
import mongoose from 'mongoose';
import { env } from './env';
export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(env.MONGO_URI, {autoIndex:false, autoCreate:false, serverSelectionTimeoutMS:15000});
    await mongoose.connection.db!.command({ping:1});
    console.log(JSON.stringify({mongo:'connected',ping:'ok',autoIndex:false,autoCreate:false}));
  } catch (error) {
    console.error(JSON.stringify({mongo:'connection_failed',errorType:error instanceof Error ? error.name : 'UnknownError'}));
    throw error;
  }
};
