import dns from "node:dns";

import mongoose from "mongoose";

import { env } from "../config/env";

dns.setServers([
  "8.8.8.8",
  "1.1.1.1",
]);

type LegacyExperienceLevel =
  | "entry"
  | "junior"
  | "mid"
  | "senior"
  | "lead";

interface ExperienceRange {
  min: number;
  max: number | null;
}

const getExperienceRange = (
  level: LegacyExperienceLevel
): ExperienceRange => {
  switch (level) {
    case "entry":
      return {
        min: 0,
        max: 1,
      };

    case "junior":
      return {
        min: 1,
        max: 2,
      };

    case "mid":
      return {
        min: 2,
        max: 4,
      };

    case "senior":
      return {
        min: 4,
        max: 6,
      };

    case "lead":
      return {
        min: 6,
        max: null,
      };

    default:
      return {
        min: 0,
        max: 1,
      };
  }
};

const migrateJobExperience =
  async (): Promise<void> => {
    try {
      console.log(
        "Connecting to MongoDB..."
      );

      await mongoose.connect(
        env.MONGO_URI
      );

      console.log(
        "MongoDB connected."
      );

      const collection =
        mongoose.connection.collection(
          "jobs"
        );

      const jobs =
        await collection
          .find({
            experienceLevel: {
              $exists: true,
            },
          })
          .toArray();

      console.log(
        `Found ${jobs.length} jobs to migrate.`
      );

      let migratedCount = 0;

      for (const job of jobs) {
        const level =
          job.experienceLevel as
            LegacyExperienceLevel;

        const range =
          getExperienceRange(
            level
          );

        await collection.updateOne(
          {
            _id: job._id,
          },
          {
            $set: {
              experienceMin:
                range.min,

              experienceMax:
                range.max,
            },

            $unset: {
              experienceLevel: "",
            },
          }
        );

        migratedCount += 1;

        console.log(
          `${job.title} → ${range.min}-${
            range.max === null
              ? "+"
              : range.max
          } years`
        );
      }

      console.log(
        `${migratedCount} jobs migrated successfully.`
      );

      await mongoose.connection.close();

      console.log(
        "MongoDB connection closed."
      );

      process.exit(0);
    } catch (error) {
      console.error(
        "Job experience migration failed:"
      );

      console.error(
        error
      );

      try {
        await mongoose.connection.close();
      } catch {}

      process.exit(1);
    }
  };

void migrateJobExperience();