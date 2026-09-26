import "dotenv/config";

import dns from "dns";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

import {
  Question,
  type IQuestion,
  type QuestionDifficulty,
  type InterviewType,
} from "../models/Question";

/* =========================================================
   DNS CONFIG
========================================================= */

/*
 * Some local networks/router DNS servers reject MongoDB Atlas
 * SRV lookups used by mongodb+srv:// connection strings.
 *
 * Force Node.js to use public DNS resolvers before Mongoose
 * attempts the Atlas connection.
 */
dns.setServers([
  "1.1.1.1",
  "8.8.8.8",
]);

console.log(
  "[IMPORT] DNS resolvers:",
  dns.getServers()
);
/* =========================================================
   CONFIG
========================================================= */

const QUESTION_BANK_DIR =
  path.resolve(
    process.cwd(),
    "data",
    "question-bank"
  );

const BATCH_SIZE = 500;

const VALID_DIFFICULTIES =
  new Set<QuestionDifficulty>([
    "beginner",
    "intermediate",
    "advanced",
    "senior",
  ]);

const VALID_INTERVIEW_TYPES =
  new Set<InterviewType>([
    "technical",
    "behavioral",
  ]);

/*
 * New question bank categories -> canonical Career Field slugs.
 *
 * We store canonical slugs in MongoDB going forward.
 * The aliases in interviewController.ts keep legacy questions working.
 */
const CATEGORY_TO_ROLE_SLUG:
  Record<string, string> = {
    "machine-learning":
      "machine-learning-engineer",

    "machine-learning-engineering":
      "machine-learning-engineer",

    "data-analysis":
      "data-analyst",

    "data-analytics":
      "data-analyst",

    "data-engineering":
      "data-engineer",

    "data-science":
      "data-scientist",

    "database-engineering":
      "database-engineer",

    "database":
      "database-engineer",

    "ui-ux-design":
      "ui-ux-designer",

    "ui-ux":
      "ui-ux-designer",

    "cloud-engineering":
      "cloud-engineer",

    "cloud":
      "cloud-engineer",

    "devops":
      "devops-engineer",

    "devops-engineering":
      "devops-engineer",

    "quality-assurance":
      "qa-engineer",

    "qa":
      "qa-engineer",

    "software-testing":
      "qa-engineer",

    "cybersecurity":
      "cybersecurity-engineer",

    "cyber-security":
      "cybersecurity-engineer",

    "security-engineering":
      "cybersecurity-engineer",

    "backend-development":
      "backend-developer",

    "backend":
      "backend-developer",

    "frontend-development":
      "frontend-developer",

    "frontend":
      "frontend-developer",

    "full-stack-development":
      "full-stack-developer",

    "fullstack-development":
      "full-stack-developer",

    "full-stack":
      "full-stack-developer",

    "fullstack":
      "full-stack-developer",

    "mobile-development":
      "mobile-developer",

    "mobile":
      "mobile-developer",

    "software-engineering":
      "software-engineer",

    "digital-marketing":
      "digital-marketing-specialist",

    "marketing":
      "digital-marketing-specialist",

    "financial-analysis":
      "financial-analyst",

    "finance":
      "financial-analyst",

    "logistics-supply-chain":
      "logistics-supply-chain-specialist",

    "logistics":
      "logistics-supply-chain-specialist",

    "supply-chain":
      "logistics-supply-chain-specialist",
  };

/* =========================================================
   TYPES
========================================================= */

interface RawQuestion {
  text?: unknown;

  category?: unknown;

  difficulty?: unknown;

  interviewType?: unknown;

  tags?: unknown;

  isActive?: unknown;

  createdBy?: unknown;
}

interface NormalizedQuestion {
  text: string;

  category: string;

  difficulty:
    QuestionDifficulty;

  interviewType:
    InterviewType;

  tags: string[];

  isActive: boolean;

  createdBy:
    mongoose.Types.ObjectId;
}

/* =========================================================
   HELPERS
========================================================= */

const normalizeString = (
  value: unknown
): string => {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeSlug = (
  value: unknown
): string => {
  return normalizeString(
    value
  )
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

const normalizeTags = (
  value: unknown
): string[] => {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter(
          (
            item
          ): item is string =>
            typeof item ===
            "string"
        )
        .map(
          (
            item
          ) =>
            normalizeSlug(
              item
            )
        )
        .filter(Boolean)
    ),
  ];
};

const normalizeCategory = (
  value: unknown
): string => {
  const category =
    normalizeSlug(
      value
    );

  if (!category) {
    return "";
  }

  return (
    CATEGORY_TO_ROLE_SLUG[
      category
    ] ||
    category
  );
};

const parseCreatedBy = (
  value: unknown
):
  | mongoose.Types.ObjectId
  | null => {
  if (
    value instanceof
    mongoose.Types.ObjectId
  ) {
    return value;
  }

  const raw =
    normalizeString(
      value
    );

  /*
   * Supports:
   * 6a7f...
   * ObjectId("6a7f...")
   * ObjectId('6a7f...')
   */
  const match =
    raw.match(
      /([a-fA-F0-9]{24})/
    );

  if (
    !match ||
    !mongoose.Types.ObjectId.isValid(
      match[1]
    )
  ) {
    return null;
  }

  return new mongoose.Types.ObjectId(
    match[1]
  );
};

const normalizeQuestion = (
  raw: RawQuestion
):
  | NormalizedQuestion
  | null => {
  const text =
    normalizeString(
      raw.text
    );

  const category =
    normalizeCategory(
      raw.category
    );

  const difficulty =
    normalizeSlug(
      raw.difficulty
    ) as QuestionDifficulty;

  const interviewType =
    normalizeSlug(
      raw.interviewType
    ) as InterviewType;

  const createdBy =
    parseCreatedBy(
      raw.createdBy
    );

  if (!text) {
    return null;
  }

  if (!category) {
    return null;
  }

  if (
    !VALID_DIFFICULTIES.has(
      difficulty
    )
  ) {
    return null;
  }

  if (
    !VALID_INTERVIEW_TYPES.has(
      interviewType
    )
  ) {
    return null;
  }

  if (!createdBy) {
    return null;
  }

  return {
    text,

    category,

    difficulty,

    interviewType,

    tags:
      normalizeTags(
        raw.tags
      ),

    isActive:
      raw.isActive !==
      false,

    createdBy,
  };
};

/* =========================================================
   JS QUESTION FILE PARSER
========================================================= */

const parseQuestionFile = (
  filePath: string
): RawQuestion[] => {
  let source =
    fs.readFileSync(
      filePath,
      "utf8"
    );

  /*
   * The supplied files are JS datasets rather than strict JSON.
   *
   * We convert common JS export wrappers into an expression
   * that can be evaluated locally.
   */

  source = source
    .replace(
      /^\uFEFF/,
      ""
    )
    .trim();

  source = source
    .replace(
      /^\s*export\s+default\s+/,
      ""
    );

  source = source
    .replace(
      /^\s*module\.exports\s*=\s*/,
      ""
    );

  source = source
    .replace(
      /^\s*export\s+const\s+\w+\s*=\s*/,
      ""
    );

  source = source
    .replace(
      /^\s*const\s+\w+\s*=\s*/,
      ""
    );

  source = source
    .replace(
      /;\s*$/,
      ""
    );

  /*
   * Convert Mongo shell ObjectId(...) values to strings.
   */
  source = source.replace(
    /ObjectId\s*\(\s*["']([a-fA-F0-9]{24})["']\s*\)/g,
    '"$1"'
  );

  try {
    const parsed =
      Function(
        `"use strict"; return (${source});`
      )();

    if (
      !Array.isArray(
        parsed
      )
    ) {
      throw new Error(
        "Question file does not export an array."
      );
    }

    return parsed as RawQuestion[];
  } catch (error) {
    throw new Error(
      `Could not parse ${path.basename(
        filePath
      )}: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`
    );
  }
};

/* =========================================================
   LOAD QUESTION BANK
========================================================= */

const loadQuestionBank =
  (): NormalizedQuestion[] => {
    if (
      !fs.existsSync(
        QUESTION_BANK_DIR
      )
    ) {
      throw new Error(
        `Question bank directory does not exist: ${QUESTION_BANK_DIR}`
      );
    }

    const files =
      fs
        .readdirSync(
          QUESTION_BANK_DIR
        )
        .filter(
          (
            file
          ) =>
            file
              .toLowerCase()
              .endsWith(
                ".js"
              )
        )
        .sort();

    if (
      files.length ===
      0
    ) {
      throw new Error(
        `No .js question files found in ${QUESTION_BANK_DIR}`
      );
    }

    console.log(
      `[IMPORT] Found ${files.length} JS files.`
    );

    const questions:
      NormalizedQuestion[] =
      [];

    let rawCount = 0;

    let invalidCount = 0;

    for (
      const file
      of files
    ) {
      const filePath =
        path.join(
          QUESTION_BANK_DIR,
          file
        );

      const rawQuestions =
        parseQuestionFile(
          filePath
        );

      rawCount +=
        rawQuestions.length;

      let validInFile = 0;

      for (
        const raw
        of rawQuestions
      ) {
        const normalized =
          normalizeQuestion(
            raw
          );

        if (!normalized) {
          invalidCount +=
            1;

          continue;
        }

        questions.push(
          normalized
        );

        validInFile +=
          1;
      }

      console.log(
        `[IMPORT] ${file}: ${rawQuestions.length} parsed / ${validInFile} valid`
      );
    }

    console.log(
      `[IMPORT] Raw questions: ${rawCount}`
    );

    console.log(
      `[IMPORT] Valid questions: ${questions.length}`
    );

    console.log(
      `[IMPORT] Invalid questions: ${invalidCount}`
    );

    return questions;
  };

/* =========================================================
   REMOVE DUPLICATES INSIDE IMPORT DATA
========================================================= */

const deduplicateQuestionBank = (
  questions:
    NormalizedQuestion[]
): {
  questions:
    NormalizedQuestion[];

  duplicates: number;
} => {
  const seen =
    new Set<string>();

  const unique:
    NormalizedQuestion[] =
    [];

  let duplicates = 0;

  for (
    const question
    of questions
  ) {
    const key =
      question.text
        .toLowerCase()
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    if (
      seen.has(
        key
      )
    ) {
      duplicates +=
        1;

      continue;
    }

    seen.add(
      key
    );

    unique.push(
      question
    );
  }

  return {
    questions:
      unique,

    duplicates,
  };
};

/* =========================================================
   DATABASE IMPORT
========================================================= */

const importQuestions =
  async (
    questions:
      NormalizedQuestion[]
  ): Promise<{
    inserted: number;

    existing: number;
  }> => {
    let inserted = 0;

    let existing = 0;

    const totalBatches =
      Math.ceil(
        questions.length /
          BATCH_SIZE
      );

    for (
      let index = 0;
      index <
      questions.length;
      index +=
        BATCH_SIZE
    ) {
      const batch =
        questions.slice(
          index,
          index +
            BATCH_SIZE
        );

      const operations =
        batch.map(
          (
            question
          ) => ({
            updateOne: {
              /*
               * Existing legacy questions may have another
               * category but identical question text.
               *
               * Text is therefore the duplicate key.
               */
              filter: {
                text:
                  question.text,
              },

              update: {
                $setOnInsert: {
                  ...question,
                },
              },

              upsert: true,
            },
          })
        );

      const result =
        await Question.bulkWrite(
          operations,
          {
            ordered:
              false,
          }
        );

      const batchInserted =
        result.upsertedCount;

      inserted +=
        batchInserted;

      existing +=
        batch.length -
        batchInserted;

      const batchNumber =
        Math.floor(
          index /
            BATCH_SIZE
        ) + 1;

      console.log(
        `[IMPORT] Batch ${batchNumber}/${totalBatches} | inserted=${batchInserted} | existing=${
          batch.length -
          batchInserted
        }`
      );
    }

    return {
      inserted,
      existing,
    };
  };

/* =========================================================
   FINAL DATABASE STATISTICS
========================================================= */

const printStatistics =
  async (): Promise<void> => {
    const total =
      await Question.countDocuments();

    const active =
      await Question.countDocuments({
        isActive:
          true,
      });

    const byCategory =
      await Question.aggregate([
        {
          $group: {
            _id:
              "$category",

            count: {
              $sum: 1,
            },
          },
        },

        {
          $sort: {
            _id: 1,
          },
        },
      ]);

    const byDifficulty =
      await Question.aggregate([
        {
          $group: {
            _id:
              "$difficulty",

            count: {
              $sum: 1,
            },
          },
        },

        {
          $sort: {
            _id: 1,
          },
        },
      ]);

    const byInterviewType =
      await Question.aggregate([
        {
          $group: {
            _id:
              "$interviewType",

            count: {
              $sum: 1,
            },
          },
        },

        {
          $sort: {
            _id: 1,
          },
        },
      ]);

    console.log(
      "\n============================================"
    );

    console.log(
      "[IMPORT] DATABASE SUMMARY"
    );

    console.log(
      "============================================"
    );

    console.log(
      `[IMPORT] Total questions: ${total}`
    );

    console.log(
      `[IMPORT] Active questions: ${active}`
    );

    console.log(
      "\n[IMPORT] Questions by category:"
    );

    console.table(
      byCategory.map(
        (
          item
        ) => ({
          category:
            item._id,

          count:
            item.count,
        })
      )
    );

    console.log(
      "\n[IMPORT] Questions by difficulty:"
    );

    console.table(
      byDifficulty.map(
        (
          item
        ) => ({
          difficulty:
            item._id,

          count:
            item.count,
        })
      )
    );

    console.log(
      "\n[IMPORT] Questions by interview type:"
    );

    console.table(
      byInterviewType.map(
        (
          item
        ) => ({
          interviewType:
            item._id,

          count:
            item.count,
        })
      )
    );
  };

/* =========================================================
   MAIN
========================================================= */

const main =
  async (): Promise<void> => {
    const mongoUri =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error(
        "MONGO_URI (or MONGODB_URI) is required."
      );
    }

    console.log(
      "[IMPORT] Loading question bank..."
    );

    const loaded =
      loadQuestionBank();

    const deduplicated =
      deduplicateQuestionBank(
        loaded
      );

    console.log(
      `[IMPORT] Internal duplicates removed: ${deduplicated.duplicates}`
    );

    console.log(
      `[IMPORT] Ready for database: ${deduplicated.questions.length}`
    );

    console.log(
      "[IMPORT] Connecting to MongoDB..."
    );

    await mongoose.connect(
      mongoUri
    );

    console.log(
      "[IMPORT] Connected to MongoDB."
    );

    try {
      const before =
        await Question.countDocuments();

      console.log(
        `[IMPORT] Questions currently in DB: ${before}`
      );

      const result =
        await importQuestions(
          deduplicated.questions
        );

      console.log(
        "\n============================================"
      );

      console.log(
        "[IMPORT] IMPORT COMPLETE"
      );

      console.log(
        "============================================"
      );

      console.log(
        `[IMPORT] Parsed: ${loaded.length}`
      );

      console.log(
        `[IMPORT] Internal duplicates: ${deduplicated.duplicates}`
      );

      console.log(
        `[IMPORT] Existing DB questions skipped: ${result.existing}`
      );

      console.log(
        `[IMPORT] Newly inserted: ${result.inserted}`
      );

      await printStatistics();
    } finally {
      console.log(
        "[IMPORT] Disconnecting from MongoDB..."
      );

      await mongoose.disconnect();

      console.log(
        "[IMPORT] MongoDB disconnected."
      );
    }
  };

/* =========================================================
   RUN
========================================================= */

main()
  .then(
    () => {
      console.log(
        "[IMPORT] Finished successfully."
      );

      process.exit(0);
    }
  )
  .catch(
    async (
      error
    ) => {
      console.error(
        "[IMPORT] Failed:",
        error
      );

      try {
        await mongoose.disconnect();
      } catch {
        // Ignore disconnect errors.
      }

      process.exit(1);
    }
  );