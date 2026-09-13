import {
  discoverBirCareersJobs,
} from "../services/jobs/providers/birCareersJobProvider";

/* =========================================================
   MAIN
========================================================= */

const main =
  async (): Promise<void> => {
    console.log(
      "\n========================================================="
    );

    console.log(
      " InterviewIQ Bir Careers Detailed Test"
    );

    console.log(
      "=========================================================\n"
    );

    const result =
      await discoverBirCareersJobs({
        /*
         * false:
         * browser açılacaq və prosesi görə biləcəksən.
         *
         * Render/production zamanı true edəcəyik.
         */
        headless:
          false,

        /*
         * İlk test üçün 10 kifayətdir.
         * Hər vacancy detail page ayrıca açılır.
         *
         * Sistem düzgün işləyəndən sonra:
         * 50 / 100 edə bilərik.
         */
        maxJobs:
          10,

        /*
         * Eyni anda neçə detail page işləsin.
         *
         * 3 local test üçün kifayətdir.
         */
        detailConcurrency:
          3,

        /*
         * Bir səhifə üçün max timeout.
         */
        requestTimeoutMs:
          30_000,
      });

    console.log(
      "\n========================================================="
    );

    console.log(
      " SUMMARY"
    );

    console.log(
      "=========================================================\n"
    );

    console.dir(
      {
        totalJobs:
          result.jobs.length,

        totalUrls:
          result.urls.length,

        baseUrl:
          result.baseUrl,

        diagnostics:
          result.diagnostics,
      },
      {
        depth:
          null,
      }
    );

    console.log(
      "\n========================================================="
    );

    console.log(
      " DETAILED JOBS"
    );

    console.log(
      "=========================================================\n"
    );

    if (
      result.jobs.length ===
      0
    ) {
      console.log(
        "⚠️ No jobs were returned."
      );

      if (
        result.diagnostics
          .errors.length >
        0
      ) {
        console.log(
          "\nErrors:"
        );

        for (
          const error of
            result.diagnostics
              .errors
        ) {
          console.log(
            `- ${error}`
          );
        }
      }

      return;
    }

    for (
      let index = 0;
      index <
      result.jobs.length;
      index += 1
    ) {
      const job =
        result.jobs[
          index
        ];

      console.log(
        `\n================ JOB ${index + 1} / ${result.jobs.length} ================\n`
      );

      console.dir(
        {
          externalId:
            job.externalId,

          title:
            job.title,

          company:
            job.company,

          brand:
            job.brand,

          location:
            job.location,

          experienceLevel:
            job.experienceLevel,

          employmentType:
            job.employmentType,

          workMode:
            job.workMode,

          deadline:
            job.deadline,

          postedAt:
            job.postedAt,

          salary: {
            min:
              job.salaryMin,

            max:
              job.salaryMax,

            currency:
              job.salaryCurrency,
          },

          skills:
            job.skills,

          summary:
            job.summary,

          description:
            job.description,

          requirements:
            job.requirements,

          responsibilities:
            job.responsibilities,

          benefits:
            job.benefits,

          source:
            job.source,

          url:
            job.url,

          applyUrl:
            job.applyUrl,
        },
        {
          depth:
            null,

          maxArrayLength:
            null,
        }
      );
    }

    console.log(
      "\n========================================================="
    );

    console.log(
      " TEST COMPLETE"
    );

    console.log(
      "=========================================================\n"
    );

    console.log(
      `✅ Returned jobs: ${result.jobs.length}`
    );

    console.log(
      `✅ Detail pages fetched: ${result.diagnostics.detailPagesFetched}`
    );

    console.log(
      `✅ Accepted jobs: ${result.diagnostics.acceptedJobs}`
    );

    console.log(
      `❌ Rejected jobs: ${result.diagnostics.rejectedJobs}`
    );

    if (
      result.diagnostics
        .errors.length >
      0
    ) {
      console.log(
        "\n⚠️ Errors:"
      );

      for (
        const error of
          result.diagnostics
            .errors
      ) {
        console.log(
          `- ${error}`
        );
      }
    }
  };

/* =========================================================
   RUN
========================================================= */

main().catch(
  (
    error
  ) => {
    console.error(
      "\n[BIR CAREERS TEST] Fatal error:"
    );

    console.error(
      error
    );

    process.exit(
      1
    );
  }
);