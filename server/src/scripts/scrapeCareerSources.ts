import fs from "fs/promises";
import path from "path";

import {
  discoverBirCareersJobs,
  type IBirCareersJob,
} from "../services/jobs/providers/birCareersJobProvider";

import {
  discoverAbbCareersJobs,
  type IAbbCareersJob,
} from "../services/jobs/providers/abbCareersJobProvider";

/* =========================================================
   TYPES
========================================================= */

interface ICareerSourceResult {
  id: string;
  name: string;
  updatedAt: string;
  success: boolean;
  count: number;
  jobs: unknown[];
  diagnostics?: unknown;
  error?: string;
}

interface ICareerSourceConfig {
  id: string;
  name: string;

  scrape:
    () => Promise<ICareerSourceResult>;
}

/* =========================================================
   OUTPUT HELPERS
========================================================= */

const OUTPUT_DIRECTORY =
  path.resolve(
    process.cwd(),
    "data",
    "career-sources"
  );

const getSourceOutputPath =
  (
    sourceId: string
  ): string => {
    return path.join(
      OUTPUT_DIRECTORY,
      `${sourceId}.json`
    );
  };

const writeSourceFile =
  async (
    result: ICareerSourceResult
  ): Promise<void> => {
    await fs.mkdir(
      OUTPUT_DIRECTORY,
      {
        recursive:
          true,
      }
    );

    const outputPath =
      getSourceOutputPath(
        result.id
      );

    await fs.writeFile(
      outputPath,
      JSON.stringify(
        result,
        null,
        2
      ),
      "utf-8"
    );

    console.log(
      "[CAREER SCRAPER] Source file written:",
      {
        source:
          result.id,

        count:
          result.count,

        outputPath,
      }
    );
  };

/* =========================================================
   BIR CAREERS
========================================================= */

const scrapeBirCareers =
  async (): Promise<ICareerSourceResult> => {
    console.log(
      "[CAREER SCRAPER] Starting Bir Careers..."
    );

    try {
      const result =
        await discoverBirCareersJobs({
          careersUrl:
            "https://careers.bir.az/vacancies",

          requestTimeoutMs:
            60_000,

          maxJobs:
            150,

          headless:
            true,

          detailConcurrency:
            3,
        });

      const jobs:
        IBirCareersJob[] =
        result.jobs;

      if (
        jobs.length ===
        0
      ) {
        return {
          id:
            "bir-careers",

          name:
            "Bir Careers",

          updatedAt:
            new Date().toISOString(),

          success:
            false,

          count:
            0,

          jobs:
            [],

          diagnostics:
            result.diagnostics,

          error:
            "Bir Careers returned 0 jobs; previous snapshot preserved.",
        };
      }

      return {
        id:
          "bir-careers",

        name:
          "Bir Careers",

        updatedAt:
          new Date().toISOString(),

        success:
          true,

        count:
          jobs.length,

        jobs,

        diagnostics:
          result.diagnostics,
      };
    } catch (
      error
    ) {
      return {
        id:
          "bir-careers",

        name:
          "Bir Careers",

        updatedAt:
          new Date().toISOString(),

        success:
          false,

        count:
          0,

        jobs:
          [],

        error:
          error instanceof Error
            ? error.message
            : String(
                error
              ),
      };
    }
  };

/* =========================================================
   ABB CAREERS
========================================================= */

const scrapeAbbCareers =
  async (): Promise<ICareerSourceResult> => {
    console.log(
      "[CAREER SCRAPER] Starting ABB Careers..."
    );

    try {
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

          detailConcurrency:
            3,
        });

      const jobs:
        IAbbCareersJob[] =
        result.jobs;

      if (
        jobs.length ===
        0
      ) {
        return {
          id:
            "abb-careers",

          name:
            "ABB Careers",

          updatedAt:
            new Date().toISOString(),

          success:
            false,

          count:
            0,

          jobs:
            [],

          diagnostics:
            result.diagnostics,

          error:
            "ABB Careers returned 0 jobs; previous snapshot preserved.",
        };
      }

      return {
        id:
          "abb-careers",

        name:
          "ABB Careers",

        updatedAt:
          new Date().toISOString(),

        success:
          true,

        count:
          jobs.length,

        jobs,

        diagnostics:
          result.diagnostics,
      };
    } catch (
      error
    ) {
      return {
        id:
          "abb-careers",

        name:
          "ABB Careers",

        updatedAt:
          new Date().toISOString(),

        success:
          false,

        count:
          0,

        jobs:
          [],

        error:
          error instanceof Error
            ? error.message
            : String(
                error
              ),
      };
    }
  };

/* =========================================================
   SOURCE REGISTRY
========================================================= */

const careerSources:
  ICareerSourceConfig[] =
  [
    {
      id:
        "bir-careers",

      name:
        "Bir Careers",

      scrape:
        scrapeBirCareers,
    },

    {
      id:
        "abb-careers",

      name:
        "ABB Careers",

      scrape:
        scrapeAbbCareers,
    },
  ];

/* =========================================================
   SCRAPE ONE SOURCE
========================================================= */

const scrapeSource =
  async (
    source: ICareerSourceConfig
  ): Promise<ICareerSourceResult> => {
    console.log(
      "========================================================="
    );

    console.log(
      "[CAREER SCRAPER] Starting source:",
      {
        id:
          source.id,

        name:
          source.name,
      }
    );

    const result =
      await source.scrape();

    if (
      result.success &&
      result.count >
        0
    ) {
      await writeSourceFile(
        result
      );
    } else {
      console.warn(
        "[CAREER SCRAPER] Source did not return a valid non-empty snapshot. Previous JSON kept unchanged:",
        {
          id:
            result.id,

          error:
            result.error,
        }
      );
    }

    console.log(
      "[CAREER SCRAPER] Source finished:",
      {
        id:
          result.id,

        success:
          result.success,

        count:
          result.count,
      }
    );

    return result;
  };

/* =========================================================
   MASTER INDEX
========================================================= */

const writeMasterIndex =
  async (
    results:
      ICareerSourceResult[]
  ): Promise<void> => {
    await fs.mkdir(
      OUTPUT_DIRECTORY,
      {
        recursive:
          true,
      }
    );

    const outputPath =
      path.join(
        OUTPUT_DIRECTORY,
        "index.json"
      );

    const totalJobs =
      results.reduce(
        (
          total,
          source
        ) =>
          total +
          source.count,
        0
      );

    const payload = {
      updatedAt:
        new Date().toISOString(),

      sourceCount:
        results.length,

      successfulSources:
        results.filter(
          (
            source
          ) =>
            source.success
        ).length,

      failedSources:
        results.filter(
          (
            source
          ) =>
            !source.success
        ).length,

      totalJobs,

      sources:
        results.map(
          (
            source
          ) => ({
            id:
              source.id,

            name:
              source.name,

            success:
              source.success,

            count:
              source.count,

            updatedAt:
              source.updatedAt,

            error:
              source.error,
          })
        ),
    };

    await fs.writeFile(
      outputPath,
      JSON.stringify(
        payload,
        null,
        2
      ),
      "utf-8"
    );

    console.log(
      "[CAREER SCRAPER] Master index written:",
      {
        outputPath,

        totalJobs,
      }
    );
  };

/* =========================================================
   MAIN
========================================================= */

const main =
  async (): Promise<void> => {
    console.log(
      "\n========================================================="
    );

    console.log(
      " InterviewIQ Career Sources Scraper"
    );

    console.log(
      "=========================================================\n"
    );

    await fs.mkdir(
      OUTPUT_DIRECTORY,
      {
        recursive:
          true,
      }
    );

    const results:
      ICareerSourceResult[] =
      [];

    for (
      const source of
      careerSources
    ) {
      const result =
        await scrapeSource(
          source
        );

      results.push(
        result
      );
    }

    await writeMasterIndex(
      results
    );

    console.log(
      "\n========================================================="
    );

    console.log(
      "[CAREER SCRAPER] All sources finished."
    );

    console.log(
      {
        sources:
          results.length,

        successful:
          results.filter(
            (
              result
            ) =>
              result.success
          ).length,

        failed:
          results.filter(
            (
              result
            ) =>
              !result.success
          ).length,

        totalJobs:
          results.reduce(
            (
              total,
              result
            ) =>
              total +
              result.count,
            0
          ),
      }
    );

    console.log(
      "=========================================================\n"
    );
  };

main().catch(
  (
    error
  ) => {
    console.error(
      "[CAREER SCRAPER] Fatal error:",
      error
    );

    process.exit(
      1
    );
  }
);
