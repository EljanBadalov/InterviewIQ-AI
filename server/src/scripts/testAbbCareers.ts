import {
  discoverAbbCareersJobs,
} from "../services/jobs/providers/abbCareersJobProvider";

const main =
  async (): Promise<void> => {
    console.log(
      "\n========================================"
    );

    console.log(
      " ABB Careers Provider Test"
    );

    console.log(
      "========================================\n"
    );

    const result =
      await discoverAbbCareersJobs({
        careersUrl:
          "https://careers.abb-bank.az/vakansiyalar",

        requestTimeoutMs:
          60_000,

        maxJobs:
          150,

        headless:
          true,
      });

    console.log(
      "\n========================================"
    );

    console.log(
      " RESULT"
    );

    console.log(
      "========================================"
    );

    console.log(
      "Discovered URLs:",
      result.urls.length
    );

    console.log(
      "Jobs:",
      result.jobs.length
    );

    console.log(
      "Diagnostics:",
      result.diagnostics
    );

    console.log(
      "\nSample jobs:"
    );

    console.log(
      JSON.stringify(
        result.jobs.slice(
          0,
          10
        ),
        null,
        2
      )
    );
  };

main().catch(
  (
    error
  ) => {
    console.error(
      "[ABB TEST] Fatal error:",
      error
    );

    process.exit(
      1
    );
  }
);