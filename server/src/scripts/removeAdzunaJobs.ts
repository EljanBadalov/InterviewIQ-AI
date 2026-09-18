import mongoose from "mongoose";

import Job from "../models/Job";

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

    await mongoose.connect(
      mongoUri
    );

    try {
      const result =
        await Job.deleteMany({
          source: {
            $regex:
              /adzuna/i,
          },
        });

      console.log(
        `[CLEANUP] Deleted ${result.deletedCount} Adzuna vacancies.`
      );
    } finally {
      await mongoose.disconnect();
    }
  };

main()
  .then(
    () =>
      process.exit(
        0
      )
  )
  .catch(
    async (
      error
    ) => {
      console.error(
        "[CLEANUP] Failed:",
        error
      );

      try {
        await mongoose.disconnect();
      } catch {
        // Ignore cleanup disconnect errors.
      }

      process.exit(
        1
      );
    }
  );
