import dns from "node:dns";
import mongoose from "mongoose";

import {
  env,
} from "../config/env";

import {
  fetchSuccessFactorsJobs,
} from "../services/externalJobService";

/*
 * Windows / some routers can reject MongoDB Atlas SRV DNS
 * lookups. Keep the same DNS fallback used by the ATS seed.
 */
dns.setServers([
  "1.1.1.1",
  "8.8.8.8",
]);

/* =========================================================
   DATABASE
========================================================= */

const connectDatabase =
  async (): Promise<void> => {
    if (
      mongoose.connection.readyState ===
      1
    ) {
      return;
    }

    if (
      !env.MONGO_URI
    ) {
      throw new Error(
        "MONGO_URI is missing."
      );
    }

    await mongoose.connect(
      env.MONGO_URI
    );

    console.log(
      "✅ MongoDB connected."
    );
  };

/* =========================================================
   DISPLAY
========================================================= */

const printJob =
  (
    job: Awaited<
      ReturnType<
        typeof fetchSuccessFactorsJobs
      >
    >[number],
    index:
      number
  ): void => {
    console.log(
      ""
    );

    console.log(
      `#${index + 1}`
    );

    console.log({
      title:
        job.title,

      company:
        job.company,

      location:
        job.location,

      remoteType:
        job.remoteType,

      employmentType:
        job.employmentType,

      experienceLevel:
        job.experienceLevel,

      skills:
        job.skills,

      source:
        job.source,

      externalId:
        job.externalId,

      applyUrl:
        job.applyUrl,
    });
  };

/* =========================================================
   TEST
========================================================= */

const run =
  async (): Promise<void> => {
    await connectDatabase();

    console.log(
      ""
    );

    console.log(
      "========================================================="
    );

    console.log(
      " InterviewIQ SuccessFactors / Azerbaijan Jobs Test"
    );

    console.log(
      "========================================================="
    );

    /*
     * IMPORTANT:
     *
     * This is a PROVIDER INGESTION test, not a Backend Developer
     * search.
     *
     * InterviewIQ supports 18 career specializations, including
     * IT, Digital Marketing, Financial Analysis, and Logistics.
     *
     * Therefore we deliberately request ALL SuccessFactors jobs
     * here. Role-specific filtering/ranking belongs later in the
     * job matching layer.
     *
     * externalJobService.ts treats:
     *   "all"
     *   "*"
     *   "any"
     *   ""
     *
     * as broad provider queries.
     */
    const jobs =
      await fetchSuccessFactorsJobs({
        query:
          "all",

        limit:
          100,
      });

    console.log(
      ""
    );

    console.log({
      totalJobs:
        jobs.length,
    });

    if (
      jobs.length ===
        0
    ) {
      console.warn(
        ""
      );

      console.warn(
        "⚠️ SuccessFactors discovered jobs, but none survived the provider return filters."
      );

      console.warn(
        "Expected for this test:"
      );

      console.warn(
        "- query must be \"all\""
      );

      console.warn(
        "- location must be omitted"
      );

      console.warn(
        "- externalJobService must include matchesOptionalJobSearchQuery()"
      );

      console.warn(
        "- Azercell provider should report discovered > 0 and parsed > 0"
      );

      return;
    }

    jobs.forEach(
      printJob
    );

    const azercellJobs =
      jobs.filter(
        (
          job
        ) =>
          job.company
            .toLowerCase()
            .includes(
              "azercell"
            )
      );

    const successFactorsJobs =
      jobs.filter(
        (
          job
        ) =>
          (
            job.source ||
            ""
          )
            .toLowerCase()
            .includes(
              "successfactors"
            )
      );

    const jobsWithSkills =
      jobs.filter(
        (
          job
        ) =>
          Array.isArray(
            job.skills
          ) &&
          job.skills.length >
            0
      );

    const uniqueDetectedSkills =
      [
        ...new Set(
          jobs.flatMap(
            (
              job
            ) =>
              job.skills ||
              []
          )
        ),
      ]
        .sort(
          (
            a,
            b
          ) =>
            a.localeCompare(
              b
            )
        );

    console.log(
      ""
    );

    console.log(
      "========================================================="
    );

    console.log(
      " Validation"
    );

    console.log(
      "========================================================="
    );

    console.log({
      parsedJobs:
        jobs.length,

      azercellJobs:
        azercellJobs.length,

      successFactorsJobs:
        successFactorsJobs.length,

      withTitles:
        jobs.filter(
          (
            job
          ) =>
            Boolean(
              job.title
            )
        ).length,

      withLocations:
        jobs.filter(
          (
            job
          ) =>
            Boolean(
              job.location
            )
        ).length,

      withDescriptions:
        jobs.filter(
          (
            job
          ) =>
            Boolean(
              job.description
            )
        ).length,

      withApplyUrls:
        jobs.filter(
          (
            job
          ) =>
            Boolean(
              job.applyUrl
            )
        ).length,

      withSkills:
        jobsWithSkills.length,

      uniqueDetectedSkills:
        uniqueDetectedSkills.length,
    });

    console.log(
      ""
    );

    console.log(
      "Detected skills:"
    );

    console.log(
      uniqueDetectedSkills
    );

    console.log(
      ""
    );

    console.log(
      "✅ Provider ingestion test completed."
    );

    console.log(
      "Role-specific matching for the 18 InterviewIQ specializations should happen after this broad vacancy pool is loaded."
    );
  };

/* =========================================================
   RUN
========================================================= */

run()
  .catch(
    (
      error
    ) => {
      console.error(
        ""
      );

      console.error(
        "❌ SuccessFactors test failed:"
      );

      console.error(
        error
      );

      process.exitCode =
        1;
    }
  )
  .finally(
    async () => {
      await mongoose.disconnect();
    }
  );
