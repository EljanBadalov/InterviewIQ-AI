import fs from "fs";
import path from "path";

import CSLearningCandidate, {
  normalizePhrase,
} from "../models/CSLearningCandidate";

/* =========================================================
   TYPES
========================================================= */

export interface ICSLearningExportItem {
  candidateId: string;

  phrase: string;

  intent: string;

  exported: boolean;

  reason:
    | "EXPORTED"
    | "DUPLICATE"
    | "INVALID_PHRASE"
    | "INVALID_INTENT";
}

export interface ICSLearningExportResult {
  success: boolean;

  datasetPath: string;

  approvedCandidates: number;

  exportedCount: number;

  duplicateCount: number;

  skippedCount: number;

  totalDatasetRows: number;

  items: ICSLearningExportItem[];
}

interface ICSDatasetRow {
  text: string;

  intent: string;
}

/* =========================================================
   CAREER ASSISTANT INTENTS
========================================================= */

const CAREER_INTENTS =
  new Set<string>([
    "CAREER_GOAL",
    "CAREER_PROGRESS",
    "CV_ANALYSIS",
    "CV_IMPROVEMENT",
    "GENERAL_CAREER_HELP",
    "GREETING",
    "INTERVIEW_FEEDBACK",
    "INTERVIEW_PREP",
    "JOB_MATCHING",
    "JOB_SEARCH_HELP",
    "NEXT_STEPS",
    "PROFILE_SUMMARY",
    "SKILL_GAP",
    "THANK_YOU",
  ]);

/* =========================================================
   PATHS
========================================================= */

const SERVER_ROOT =
  path.resolve(
    __dirname,
    "../.."
  );

const DATASET_PATH =
  path.join(
    SERVER_ROOT,
    "ml",
    "data",
    "intents.csv"
  );

const TEMP_DATASET_PATH =
  path.join(
    SERVER_ROOT,
    "ml",
    "data",
    "intents.tmp.csv"
  );

/* =========================================================
   HELPERS
========================================================= */

const normalizeIntent = (
  value: string
): string => {
  return value
    .trim()
    .toUpperCase();
};

const normalizeText = (
  value: string
): string => {
  return value
    .replace(/\s+/g, " ")
    .trim();
};

const isValidCareerIntent = (
  value: string
): boolean => {
  return CAREER_INTENTS.has(
    normalizeIntent(
      value
    )
  );
};

/* =========================================================
   CSV ESCAPING

   Example:

   Hello, can you review my CV?

   becomes:

   "Hello, can you review my CV?"
========================================================= */

const escapeCSVValue = (
  value: string
): string => {
  const needsQuotes =
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r");

  if (
    !needsQuotes
  ) {
    return value;
  }

  const escaped =
    value.replace(
      /"/g,
      '""'
    );

  return `"${escaped}"`;
};

/* =========================================================
   CSV PARSER

   We implement a small parser here instead of introducing
   another dependency.

   Supports:
   - commas
   - quoted fields
   - escaped quotes
   - CRLF / LF
========================================================= */

const parseCSV = (
  content: string
): string[][] => {
  const rows:
    string[][] = [];

  let currentRow:
    string[] = [];

  let currentValue =
    "";

  let insideQuotes =
    false;

  for (
    let index = 0;
    index < content.length;
    index += 1
  ) {
    const character =
      content[index];

    const nextCharacter =
      content[
        index + 1
      ];

    /* =====================================================
       QUOTE
    ===================================================== */

    if (
      character === '"'
    ) {
      if (
        insideQuotes &&
        nextCharacter === '"'
      ) {
        currentValue +=
          '"';

        index +=
          1;

        continue;
      }

      insideQuotes =
        !insideQuotes;

      continue;
    }

    /* =====================================================
       COMMA
    ===================================================== */

    if (
      character === "," &&
      !insideQuotes
    ) {
      currentRow.push(
        currentValue
      );

      currentValue =
        "";

      continue;
    }

    /* =====================================================
       NEW LINE
    ===================================================== */

    if (
      (
        character === "\n" ||
        character === "\r"
      ) &&
      !insideQuotes
    ) {
      /*
       * Handle Windows CRLF.
       */

      if (
        character === "\r" &&
        nextCharacter === "\n"
      ) {
        index +=
          1;
      }

      currentRow.push(
        currentValue
      );

      currentValue =
        "";

      const hasContent =
        currentRow.some(
          (
            item
          ) =>
            item.trim() !==
            ""
        );

      if (
        hasContent
      ) {
        rows.push(
          currentRow
        );
      }

      currentRow =
        [];

      continue;
    }

    currentValue +=
      character;
  }

  /* =======================================================
     FINAL VALUE
  ======================================================= */

  if (
    currentValue.length >
      0 ||
    currentRow.length >
      0
  ) {
    currentRow.push(
      currentValue
    );

    const hasContent =
      currentRow.some(
        (
          item
        ) =>
          item.trim() !==
          ""
      );

    if (
      hasContent
    ) {
      rows.push(
        currentRow
      );
    }
  }

  return rows;
};

/* =========================================================
   LOAD CURRENT DATASET
========================================================= */

const loadDataset =
  (): ICSDatasetRow[] => {
    if (
      !fs.existsSync(
        DATASET_PATH
      )
    ) {
      throw new Error(
        `Career Assistant training dataset not found: ${DATASET_PATH}`
      );
    }

    const content =
      fs.readFileSync(
        DATASET_PATH,
        "utf-8"
      );

    const rawRows =
      parseCSV(
        content
      );

    if (
      rawRows.length ===
      0
    ) {
      return [];
    }

    const header =
      rawRows[0].map(
        (
          item
        ) =>
          item
            .trim()
            .toLowerCase()
      );

    const textIndex =
      header.indexOf(
        "text"
      );

    const intentIndex =
      header.indexOf(
        "intent"
      );

    if (
      textIndex === -1 ||
      intentIndex === -1
    ) {
      throw new Error(
        "intents.csv must contain 'text' and 'intent' columns."
      );
    }

    const dataset:
      ICSDatasetRow[] = [];

    for (
      const row
      of rawRows.slice(1)
    ) {
      const text =
        normalizeText(
          row[
            textIndex
          ] ??
            ""
        );

      const intent =
        normalizeIntent(
          row[
            intentIndex
          ] ??
            ""
        );

      if (
        !text ||
        !intent
      ) {
        continue;
      }

      /*
       * Ignore any stale or invalid intent rows.
       * This prevents old e-commerce intents from being
       * treated as valid Career Assistant training data.
       */

      if (
        !isValidCareerIntent(
          intent
        )
      ) {
        continue;
      }

      dataset.push({
        text,

        intent,
      });
    }

    return dataset;
  };

/* =========================================================
   BUILD DUPLICATE KEY

   The same phrase under different intents is NOT considered
   the same training row.

   Example:

   "How can I improve?"

   + CV_IMPROVEMENT

   differs from:

   "How can I improve?"

   + SKILL_GAP
========================================================= */

const buildDatasetKey = (
  text: string,
  intent: string
): string => {
  return [
    normalizePhrase(
      text
    ),

    normalizeIntent(
      intent
    ),
  ].join(
    "::"
  );
};

/* =========================================================
   WRITE DATASET

   We write to a temporary file first and then replace the
   real dataset to reduce the chance of corrupting the CSV.
========================================================= */

const writeDataset = (
  rows: ICSDatasetRow[]
): void => {
  const directory =
    path.dirname(
      DATASET_PATH
    );

  fs.mkdirSync(
    directory,
    {
      recursive:
        true,
    }
  );

  const lines:
    string[] = [
      "text,intent",
    ];

  for (
    const row
    of rows
  ) {
    lines.push(
      [
        escapeCSVValue(
          row.text
        ),

        escapeCSVValue(
          row.intent
        ),
      ].join(
        ","
      )
    );
  }

  const content =
    `${lines.join(
      "\n"
    )}\n`;

  fs.writeFileSync(
    TEMP_DATASET_PATH,
    content,
    "utf-8"
  );

  fs.copyFileSync(
    TEMP_DATASET_PATH,
    DATASET_PATH
  );

  fs.unlinkSync(
    TEMP_DATASET_PATH
  );
};

/* =========================================================
   MARK CANDIDATE EXPORTED
========================================================= */

const markCandidateExported =
  async (
    candidateId: string,
    options: {
      exported: boolean;

      duplicate?: boolean;
    }
  ): Promise<void> => {
    await CSLearningCandidate.findByIdAndUpdate(
      candidateId,

      {
        $set: {
          "metadata.exportedToDataset":
            options.exported,

          "metadata.exportDuplicate":
            options.duplicate ??
            false,

          "metadata.exportedAt":
            new Date(),

          "metadata.datasetPath":
            "ml/data/intents.csv",
        },
      },

      {
        runValidators:
          true,
      }
    );
  };

/* =========================================================
   EXPORT APPROVED CANDIDATES
========================================================= */

export const exportApprovedLearningCandidates =
  async (): Promise<ICSLearningExportResult> => {
    /* =====================================================
       STEP 1
       LOAD CURRENT CSV
    ===================================================== */

    const dataset =
      loadDataset();

    const existingKeys =
      new Set<string>();

    for (
      const row
      of dataset
    ) {
      existingKeys.add(
        buildDatasetKey(
          row.text,
          row.intent
        )
      );
    }

    /* =====================================================
       STEP 2
       GET APPROVED CANDIDATES

       We also include already-exported approved candidates
       safely because duplicate detection protects the CSV.

       This makes the export idempotent.
    ===================================================== */

    const candidates =
      await CSLearningCandidate.find({
        status:
          "approved",
      })
        .sort({
          approvedAt:
            1,

          createdAt:
            1,
        });

    const items:
      ICSLearningExportItem[] =
      [];

    let exportedCount =
      0;

    let duplicateCount =
      0;

    let skippedCount =
      0;

    /* =====================================================
       STEP 3
       PROCESS EACH CANDIDATE
    ===================================================== */

    for (
      const candidate
      of candidates
    ) {
      const phrase =
        normalizeText(
          candidate.phrase
        );

      const intent =
        normalizeIntent(
          candidate.suggestedIntent
        );

      const candidateId =
        String(
          candidate._id
        );

      /* ===================================================
         INVALID PHRASE
      =================================================== */

      if (
        !phrase ||
        normalizePhrase(
          phrase
        ).length <
          3
      ) {
        skippedCount +=
          1;

        items.push({
          candidateId,

          phrase,

          intent,

          exported:
            false,

          reason:
            "INVALID_PHRASE",
        });

        continue;
      }

      /* ===================================================
         INVALID INTENT
      =================================================== */

      if (
        !intent ||
        !isValidCareerIntent(
          intent
        )
      ) {
        skippedCount +=
          1;

        items.push({
          candidateId,

          phrase,

          intent,

          exported:
            false,

          reason:
            "INVALID_INTENT",
        });

        continue;
      }

      const key =
        buildDatasetKey(
          phrase,
          intent
        );

      /* ===================================================
         DUPLICATE
      =================================================== */

      if (
        existingKeys.has(
          key
        )
      ) {
        duplicateCount +=
          1;

        items.push({
          candidateId,

          phrase,

          intent,

          exported:
            false,

          reason:
            "DUPLICATE",
        });

        await markCandidateExported(
          candidateId,
          {
            exported:
              true,

            duplicate:
              true,
          }
        );

        continue;
      }

      /* ===================================================
         ADD TO DATASET
      =================================================== */

      dataset.push({
        text:
          phrase,

        intent,
      });

      existingKeys.add(
        key
      );

      exportedCount +=
        1;

      items.push({
        candidateId,

        phrase,

        intent,

        exported:
          true,

        reason:
          "EXPORTED",
      });
    }

    /* =====================================================
       STEP 4
       WRITE DATASET

       Only write if something new was actually added.
    ===================================================== */

    if (
      exportedCount >
      0
    ) {
      writeDataset(
        dataset
      );
    }

    /* =====================================================
       STEP 5
       MARK NEW EXPORTS
    ===================================================== */

    for (
      const item
      of items
    ) {
      if (
        item.reason !==
        "EXPORTED"
      ) {
        continue;
      }

      await markCandidateExported(
        item.candidateId,
        {
          exported:
            true,

          duplicate:
            false,
        }
      );
    }

    /* =====================================================
       RETURN
    ===================================================== */

    return {
      success:
        true,

      datasetPath:
        DATASET_PATH,

      approvedCandidates:
        candidates.length,

      exportedCount,

      duplicateCount,

      skippedCount,

      totalDatasetRows:
        dataset.length,

      items,
    };
  };

/* =========================================================
   GET EXPORT STATUS
========================================================= */

export const getLearningExportStatus =
  async () => {
    const approved =
      await CSLearningCandidate.countDocuments({
        status:
          "approved",
      });

    const exported =
      await CSLearningCandidate.countDocuments({
        status:
          "approved",

        "metadata.exportedToDataset":
          true,
      });

    const pendingExport =
      await CSLearningCandidate.countDocuments({
        status:
          "approved",

        "metadata.exportedToDataset": {
          $ne:
            true,
        },
      });

    const dataset =
      loadDataset();

    return {
      datasetPath:
        DATASET_PATH,

      datasetRows:
        dataset.length,

      approvedCandidates:
        approved,

      exportedCandidates:
        exported,

      pendingExportCandidates:
        pendingExport,

      allowedIntents:
        Array.from(
          CAREER_INTENTS
        ),

      allowedIntentCount:
        CAREER_INTENTS.size,
    };
  };

/* =========================================================
   GET ALLOWED CAREER INTENTS
========================================================= */

export const getAllowedCareerIntents =
  (): string[] => {
    return Array.from(
      CAREER_INTENTS
    );
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  exportApprovedLearningCandidates,

  getLearningExportStatus,

  getAllowedCareerIntents,
};