import {
  discoverGlorriJobs,
} from "../services/jobs/providers/glorriJobProvider";

const main =
  async (): Promise<void> => {
    console.log(
      "\n========================================"
    );

    console.log(
      " InterviewIQ Glorri - FULL TEST"
    );

    console.log(
      " All configured companies / all jobs"
    );

    console.log(
      "========================================\n"
    );

    const result =
      await discoverGlorriJobs({
        /*
         * companies intentionally omitted.
         *
         * The provider will use its complete
         * GLORRI_COMPANIES configuration.
         */

        headless:
          true,

        /*
         * maxJobs intentionally omitted.
         *
         * No global 10-job test limit.
         * The provider can discover all
         * available vacancies.
         */

        detailConcurrency:
          3,

        requestTimeoutMs:
          60_000,
      });

    console.log(
      "\n========== SUMMARY =========="
    );

    console.log(
      JSON.stringify(
        {
          totalUrls:
            result.urls.length,

          totalJobs:
            result.jobs.length,

          diagnostics:
            result.diagnostics,
        },
        null,
        2
      )
    );

    console.log(
      "\n========== COMPANY RESULTS =========="
    );

    for (
      const company of
      result.diagnostics
        .companyResults
    ) {
      console.log({
        slug:
          company.slug,

        name:
          company.name,

        discovered:
          company.discovered,

        accepted:
          company.accepted,

        error:
          company.error,
      });
    }

    console.log(
      "\n========== JOBS =========="
    );

    console.log(
      JSON.stringify(
        result.jobs,
        null,
        2
      )
    );

    console.log(
      "\n========== FINAL =========="
    );

    console.log({
      companiesRequested:
        result.diagnostics
          .companiesRequested,

      companiesFetched:
        result.diagnostics
          .companiesFetched,

      companiesFailed:
        result.diagnostics
          .companiesFailed,

      discoveredLinks:
        result.diagnostics
          .discoveredLinks,

      detailPagesFetched:
        result.diagnostics
          .detailPagesFetched,

      acceptedJobs:
        result.diagnostics
          .acceptedJobs,

      rejectedJobs:
        result.diagnostics
          .rejectedJobs,

      errors:
        result.diagnostics
          .errors.length,
    });
  };

main().catch(
  (
    error
  ) => {
    console.error(
      "[TEST GLORRI] Fatal:",
      error
    );

    process.exit(
      1
    );
  }
);