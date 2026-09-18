import mongoose from "mongoose";

import {
  refreshSharedJobCatalog,
} from "../services/jobAggregationService";

const mongoUri =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI;

const main =
  async (): Promise<void> => {
    if (!mongoUri) {
      throw new Error(
        "MONGO_URI (or MONGODB_URI) is required."
      );
    }

    console.log(
      "[JOB CATALOG] Connecting to MongoDB..."
    );

    await mongoose.connect(
      mongoUri
    );

    try {
      const result =
        await refreshSharedJobCatalog();

      console.log(
        "[JOB CATALOG] Sync result:",
        result
      );
    } finally {
      await mongoose.disconnect();
    }
  };

main()
  .then(
    () => {
      console.log(
        "[JOB CATALOG] Finished successfully."
      );

      process.exit(
        0
      );
    }
  )
  .catch(
    async (
      error
    ) => {
      console.error(
        "[JOB CATALOG] Failed:",
        error
      );

      try {
        await mongoose.disconnect();
      } catch {
        // Ignore disconnect errors during failure cleanup.
      }

      process.exit(
        1
      );
    }
  );
