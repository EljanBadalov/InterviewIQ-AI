import dns from "node:dns";

dns.setServers([
  "8.8.8.8",
  "1.1.1.1",
]);

import app from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";

const startServer = async (): Promise<void> => {
  try {
    await connectDB();

    app.listen(env.PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${env.PORT}`);

      if (env.NODE_ENV === "development") {
        console.log(`Local URL: http://localhost:${env.PORT}`);
      }
    });
  } catch (error) {
    console.error("Server start error:", error);
    process.exit(1);
  }
};

void startServer();