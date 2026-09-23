const fs = require("fs");
const path = require("path");
const vm = require("vm");
const dns = require("dns");

// Node.js SRV lookup üçün public DNS istifadə et
dns.setServers([
  "8.8.8.8",
  "1.1.1.1"
]);

const mongoose = require("mongoose");
const dotenv = require("dotenv");

// ======================================================
// CONFIG
// ======================================================

const SERVER_DIR = path.resolve(__dirname, "../..");
const DATA_DIR = path.join(SERVER_DIR, "data", "behavioral_data");
const ENV_PATH = path.join(SERVER_DIR, ".env");

const BATCH_SIZE = 1000;
const CONNECTION_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

const EXPECTED_CREATED_BY = "6a7f572a0e854f23a5b70203";

dotenv.config({
  path: ENV_PATH,
});

// ======================================================
// HELPERS
// ======================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function FakeObjectId(value) {
  return {
    __objectId: value,
    toString() {
      return value;
    },
  };
}

function normalizeText(text) {
  return String(text)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function makeDuplicateKey(question) {
  return [
    normalizeText(question.text),
    String(question.category).trim().toLowerCase(),
    String(question.difficulty).trim().toLowerCase(),
    String(question.interviewType).trim().toLowerCase(),
  ].join("|||");
}

// ======================================================
// LOAD DATASET FILE
// ======================================================

function loadQuestionFile(filePath) {
  const code = fs.readFileSync(filePath, "utf8");

  const sandbox = {
    ObjectId: FakeObjectId,
  };

  const result = vm.runInNewContext(
    `(${code})`,
    sandbox,
    {
      filename: filePath,
      timeout: 30000,
    }
  );

  if (!Array.isArray(result)) {
    throw new Error(
      `File does not contain a JavaScript array: ${filePath}`
    );
  }

  return result;
}

// ======================================================
// MONGOOSE SCHEMA
// ======================================================

const questionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    difficulty: {
      type: String,
      enum: [
        "beginner",
        "intermediate",
        "advanced",
        "senior",
      ],
      required: true,
    },

    interviewType: {
      type: String,
      enum: [
        "technical",
        "behavioral",
      ],
      required: true,
    },

    tags: {
      type: [String],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

questionSchema.index({
  category: 1,
  difficulty: 1,
  interviewType: 1,
  isActive: 1,
});

const Question =
  mongoose.models.Question ||
  mongoose.model("Question", questionSchema);

// ======================================================
// MONGODB CONNECTION WITH RETRY
// ======================================================

async function connectMongoDB() {
  if (!process.env.MONGO_URI) {
    throw new Error(
      `MONGO_URI not found in ${ENV_PATH}`
    );
  }

  for (
    let attempt = 1;
    attempt <= CONNECTION_RETRIES;
    attempt++
  ) {
    try {
      console.log(
        `MongoDB connection attempt ${attempt}/${CONNECTION_RETRIES}...`
      );

      await mongoose.connect(
        process.env.MONGO_URI,
        {
          serverSelectionTimeoutMS: 30000,
          connectTimeoutMS: 30000,
          socketTimeoutMS: 120000,
          maxPoolSize: 10,
        }
      );

      console.log("MongoDB connected successfully.");
      console.log(
        `Host: ${mongoose.connection.host}`
      );
      console.log(
        `Database: ${mongoose.connection.name}`
      );
      console.log(
        `Collection: ${Question.collection.name}`
      );

      return;
    } catch (error) {
      console.error(
        `Connection attempt ${attempt} failed:`
      );

      console.error(
        error?.message || error
      );

      if (attempt === CONNECTION_RETRIES) {
        throw error;
      }

      console.log(
        `Waiting ${RETRY_DELAY_MS / 1000} seconds before retry...\n`
      );

      await sleep(RETRY_DELAY_MS);
    }
  }
}

// ======================================================
// READ AND PREPARE DATASET
// ======================================================

function loadDataset() {
  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(
      `Dataset folder not found:\n${DATA_DIR}`
    );
  }

  const files = fs
    .readdirSync(DATA_DIR)
    .filter((file) =>
      file.toLowerCase().endsWith(".js")
    )
    .sort();

  console.log("\n========================================");
  console.log(" DATASET");
  console.log("========================================");

  console.log(`Files found: ${files.length}`);

  if (files.length !== 18) {
    throw new Error(
      `Expected 18 .js files but found ${files.length}.`
    );
  }

  const allQuestions = [];

  for (const file of files) {
    const filePath = path.join(
      DATA_DIR,
      file
    );

    const questions =
      loadQuestionFile(filePath);

    console.log(
      `${file.padEnd(48)} ${questions.length}`
    );

    if (questions.length !== 4000) {
      throw new Error(
        `${file} should contain 4000 questions, but contains ${questions.length}.`
      );
    }

    for (const q of questions) {
      if (
        !q.text ||
        !q.category ||
        !q.difficulty ||
        !q.interviewType
      ) {
        throw new Error(
          `Invalid question found in ${file}`
        );
      }

      if (
        q.interviewType !== "behavioral"
      ) {
        throw new Error(
          `Non-behavioral question found in ${file}`
        );
      }

      const createdByValue =
        q.createdBy?.__objectId ||
        EXPECTED_CREATED_BY;

      if (
        !mongoose.Types.ObjectId.isValid(
          createdByValue
        )
      ) {
        throw new Error(
          `Invalid createdBy ObjectId in ${file}: ${createdByValue}`
        );
      }

      allQuestions.push({
        text: String(q.text).trim(),

        category: String(
          q.category
        )
          .trim()
          .toLowerCase(),

        difficulty: String(
          q.difficulty
        )
          .trim()
          .toLowerCase(),

        interviewType: "behavioral",

        tags: Array.isArray(q.tags)
          ? q.tags.map((tag) =>
              String(tag)
                .trim()
                .toLowerCase()
            )
          : [],

        isActive: true,

        createdBy:
          new mongoose.Types.ObjectId(
            createdByValue
          ),
      });
    }
  }

  console.log(
    `\nTotal loaded: ${allQuestions.length}`
  );

  if (allQuestions.length !== 72000) {
    throw new Error(
      `Expected 72000 questions, but loaded ${allQuestions.length}.`
    );
  }

  return allQuestions;
}

// ======================================================
// MAIN IMPORT
// ======================================================

async function main() {
  console.log(
    "========================================"
  );
  console.log(
    " InterviewIQ Behavioral Question Import"
  );
  console.log(
    "========================================"
  );

  console.log(`ENV: ${ENV_PATH}`);
  console.log(`DATA: ${DATA_DIR}\n`);

  // --------------------------------------------
  // 1. Connect
  // --------------------------------------------

  await connectMongoDB();

  // --------------------------------------------
  // 2. Verify DB access
  // --------------------------------------------

  console.log(
    "\nTesting database access..."
  );

  const beforeCount =
    await Question.countDocuments({
      interviewType: "behavioral",
    });

  console.log(
    `Behavioral questions currently in DB: ${beforeCount}`
  );

  // --------------------------------------------
  // 3. Load 72K dataset
  // --------------------------------------------

  const allQuestions =
    loadDataset();

  // --------------------------------------------
  // 4. Dataset duplicate safety check
  // --------------------------------------------

  console.log(
    "\nChecking dataset duplicates..."
  );

  const datasetKeys =
    new Set();

  const uniqueDatasetQuestions = [];

  let datasetDuplicates = 0;

  for (const question of allQuestions) {
    const key =
      makeDuplicateKey(question);

    if (datasetKeys.has(key)) {
      datasetDuplicates++;
      continue;
    }

    datasetKeys.add(key);

    uniqueDatasetQuestions.push(
      question
    );
  }

  console.log(
    `Unique dataset questions: ${uniqueDatasetQuestions.length}`
  );

  console.log(
    `Dataset duplicates skipped: ${datasetDuplicates}`
  );

  if (datasetDuplicates !== 0) {
    console.log(
      "WARNING: Dataset contains duplicates."
    );
  }

  // --------------------------------------------
  // 5. Read existing behavioral questions
  // --------------------------------------------

  console.log(
    "\nReading existing behavioral questions..."
  );

  const existing =
    await Question.find(
      {
        interviewType: "behavioral",
      },
      {
        text: 1,
        category: 1,
        difficulty: 1,
        interviewType: 1,
      }
    )
      .lean()
      .exec();

  console.log(
    `Existing behavioral documents read: ${existing.length}`
  );

  const existingKeys =
    new Set();

  for (const question of existing) {
    existingKeys.add(
      makeDuplicateKey(question)
    );
  }

  console.log(
    `Existing unique keys: ${existingKeys.size}`
  );

  // --------------------------------------------
  // 6. Determine what actually needs insertion
  // --------------------------------------------

  const questionsToInsert = [];

  let skippedExisting = 0;

  for (
    const question of
    uniqueDatasetQuestions
  ) {
    const key =
      makeDuplicateKey(question);

    if (existingKeys.has(key)) {
      skippedExisting++;
      continue;
    }

    questionsToInsert.push(
      question
    );
  }

  console.log(
    "\n========================================"
  );
  console.log(
    " PRE-IMPORT REPORT"
  );
  console.log(
    "========================================"
  );

  console.log(
    `Dataset total:              ${allQuestions.length}`
  );

  console.log(
    `Dataset unique:             ${uniqueDatasetQuestions.length}`
  );

  console.log(
    `Dataset duplicates:         ${datasetDuplicates}`
  );

  console.log(
    `Already existing in DB:     ${skippedExisting}`
  );

  console.log(
    `Ready to insert:            ${questionsToInsert.length}`
  );

  console.log(
    `Behavioral currently in DB: ${beforeCount}`
  );

  console.log(
    "========================================"
  );

  if (
    questionsToInsert.length === 0
  ) {
    console.log(
      "\nNothing new to insert."
    );

    return;
  }

  // --------------------------------------------
  // 7. Batch insert
  // --------------------------------------------

  console.log(
    `\nStarting import using batches of ${BATCH_SIZE}...\n`
  );

  let inserted = 0;
  let failed = 0;

  const total =
    questionsToInsert.length;

  const totalBatches =
    Math.ceil(
      total / BATCH_SIZE
    );

  for (
    let start = 0, batchNumber = 1;
    start < total;
    start += BATCH_SIZE, batchNumber++
  ) {
    const batch =
      questionsToInsert.slice(
        start,
        start + BATCH_SIZE
      );

    try {
      const result =
        await Question.insertMany(
          batch,
          {
            ordered: false,
          }
        );

      inserted +=
        result.length;
    } catch (error) {
      // ordered:false can partially succeed.
      // Count successful inserts when available.
      const successfulCount =
        error?.insertedDocs?.length ||
        0;

      inserted +=
        successfulCount;

      const failedThisBatch =
        batch.length -
        successfulCount;

      failed +=
        failedThisBatch;

      console.error(
        `\nBatch ${batchNumber} reported an error:`
      );

      console.error(
        error?.message || error
      );

      console.error(
        `Successful in this batch: ${successfulCount}`
      );

      console.error(
        `Failed/unknown in this batch: ${failedThisBatch}`
      );

      console.error(
        "Import will continue with the next batch.\n"
      );
    }

    const processed =
      Math.min(
        start + batch.length,
        total
      );

    const percent =
      (
        (processed / total) *
        100
      ).toFixed(1);

    console.log(
      `Batch ${batchNumber}/${totalBatches} | Processed ${processed}/${total} | Inserted ${inserted} | ${percent}%`
    );
  }

  // --------------------------------------------
  // 8. Final DB verification
  // --------------------------------------------

  console.log(
    "\nRunning final verification..."
  );

  const finalCount =
    await Question.countDocuments({
      interviewType: "behavioral",
    });

  const actualIncrease =
    finalCount - beforeCount;

  console.log(
    "\n========================================"
  );
  console.log(
    " IMPORT COMPLETE"
  );
  console.log(
    "========================================"
  );

  console.log(
    `Behavioral before:      ${beforeCount}`
  );

  console.log(
    `Dataset total:          ${allQuestions.length}`
  );

  console.log(
    `Already existing:       ${skippedExisting}`
  );

  console.log(
    `Attempted new:          ${questionsToInsert.length}`
  );

  console.log(
    `Reported inserted:      ${inserted}`
  );

  console.log(
    `Reported failed:        ${failed}`
  );

  console.log(
    `Actual DB increase:     ${actualIncrease}`
  );

  console.log(
    `Behavioral now in DB:   ${finalCount}`
  );

  console.log(
    "========================================"
  );

  if (
    actualIncrease ===
    questionsToInsert.length
  ) {
    console.log(
      "\nSUCCESS: All expected questions were inserted."
    );
  } else {
    console.log(
      "\nWARNING: Actual DB increase does not match expected insertion count."
    );
  }
}

// ======================================================
// RUN
// ======================================================

main()
  .catch((error) => {
    console.error(
      "\n========================================"
    );
    console.error(
      " IMPORT FAILED"
    );
    console.error(
      "========================================"
    );

    console.error(
      error?.stack ||
      error?.message ||
      error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      if (
        mongoose.connection.readyState !== 0
      ) {
        await mongoose.disconnect();
      }

      console.log(
        "\nMongoDB disconnected."
      );
    } catch (error) {
      console.error(
        "Disconnect error:",
        error?.message || error
      );
    }
  });