import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';

const startServer = async (): Promise<void> => {
    try {
        await connectDB();
        app.listen(env.PORT, () => {
            console.log(`Server running on port http://localhost:${env.PORT}`)
        })
    } catch (error) {
        console.error("Server start error:", error);
        process.exit(1);
    }
}

startServer()