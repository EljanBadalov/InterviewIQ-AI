const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DATA_DIR = path.join(__dirname, "../../data/behavioral_data");

const VALID_DIFFICULTIES = new Set([
  "beginner",
  "intermediate",
  "advanced",
  "senior",
]);

const EXPECTED_CATEGORIES = new Set([
  "machine-learning",
  "data-analyst",
  "data-engineer",
  "data-scientist",
  "database-engineer",
  "ui-ux",
  "cloud",
  "devops",
  "qa",
  "cybersecurity",
  "backend",
  "frontend",
  "fullstack",
  "mobile",
  "software-engineering",
  "digital-marketing",
  "financial-analysis",
  "logistics-supply-chain",
]);

const EXPECTED_CREATED_BY = "6a7f572a0e854f23a5b70203";

function ObjectId(value) {
  return {
    __objectId: value,
    toString() {
      return value;
    },
  };
}

function loadQuestionFile(filePath) {
  const code = fs.readFileSync(filePath, "utf8");

  // Fayllar JavaScript array-dir və ObjectId(...) istifadə edir.
  const sandbox = {
    ObjectId,
  };

  const result = vm.runInNewContext(`(${code})`, sandbox, {
    filename: filePath,
    timeout: 10000,
  });

  if (!Array.isArray(result)) {
    throw new Error("File does not contain a JavaScript array.");
  }

  return result;
}

function normalizeText(text) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function main() {
  console.log("========================================");
  console.log(" InterviewIQ Behavioral Data Validator");
  console.log("========================================\n");

  if (!fs.existsSync(DATA_DIR)) {
    console.error("ERROR: Folder not found:");
    console.error(DATA_DIR);
    process.exit(1);
  }

  const files = fs
    .readdirSync(DATA_DIR)
    .filter((file) => file.endsWith(".js"))
    .sort();

  console.log(`Files found: ${files.length}\n`);

  let totalQuestions = 0;
  let invalidQuestions = 0;

  const categoryCounts = {};
  const difficultyCounts = {};
  const categoryDifficultyCounts = {};

  const exactTextMap = new Map();

  const problems = [];

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);

    let questions;

    try {
      questions = loadQuestionFile(filePath);
    } catch (error) {
      console.error(`FAILED TO PARSE: ${file}`);
      console.error(error.message);
      console.error("");
      continue;
    }

    console.log(`${file}: ${questions.length} questions`);

    totalQuestions += questions.length;

    questions.forEach((q, index) => {
      const location = `${file} -> question ${index + 1}`;

      let invalid = false;

      const expectedFields = [
        "text",
        "category",
        "difficulty",
        "interviewType",
        "tags",
        "isActive",
        "createdBy",
      ];

      const actualFields = Object.keys(q);

      // Missing fields
      for (const field of expectedFields) {
        if (!(field in q)) {
          problems.push(`${location}: missing field "${field}"`);
          invalid = true;
        }
      }

      // Unexpected fields
      for (const field of actualFields) {
        if (!expectedFields.includes(field)) {
          problems.push(`${location}: unexpected field "${field}"`);
          invalid = true;
        }
      }

      // text
      if (typeof q.text !== "string" || !q.text.trim()) {
        problems.push(`${location}: invalid text`);
        invalid = true;
      }

      // category
      if (
        typeof q.category !== "string" ||
        !EXPECTED_CATEGORIES.has(q.category)
      ) {
        problems.push(
          `${location}: unexpected category "${q.category}"`
        );
        invalid = true;
      }

      // difficulty
      if (!VALID_DIFFICULTIES.has(q.difficulty)) {
        problems.push(
          `${location}: invalid difficulty "${q.difficulty}"`
        );
        invalid = true;
      }

      // interviewType
      if (q.interviewType !== "behavioral") {
        problems.push(
          `${location}: interviewType is "${q.interviewType}"`
        );
        invalid = true;
      }

      // tags
      if (
        !Array.isArray(q.tags) ||
        q.tags.length < 2 ||
        q.tags.some((tag) => typeof tag !== "string")
      ) {
        problems.push(`${location}: invalid tags`);
        invalid = true;
      }

      // isActive
      if (q.isActive !== true) {
        problems.push(`${location}: isActive is not true`);
        invalid = true;
      }

      // createdBy
      if (
        !q.createdBy ||
        q.createdBy.__objectId !== EXPECTED_CREATED_BY
      ) {
        problems.push(`${location}: invalid createdBy`);
        invalid = true;
      }

      if (invalid) {
        invalidQuestions++;
      }

      // Statistics
      if (typeof q.category === "string") {
        categoryCounts[q.category] =
          (categoryCounts[q.category] || 0) + 1;
      }

      if (typeof q.difficulty === "string") {
        difficultyCounts[q.difficulty] =
          (difficultyCounts[q.difficulty] || 0) + 1;
      }

      if (
        typeof q.category === "string" &&
        typeof q.difficulty === "string"
      ) {
        const key = `${q.category} | ${q.difficulty}`;

        categoryDifficultyCounts[key] =
          (categoryDifficultyCounts[key] || 0) + 1;
      }

      // Exact duplicate detection
      if (typeof q.text === "string" && q.text.trim()) {
        const normalized = normalizeText(q.text);

        if (!exactTextMap.has(normalized)) {
          exactTextMap.set(normalized, []);
        }

        exactTextMap.get(normalized).push({
          file,
          index: index + 1,
          category: q.category,
          difficulty: q.difficulty,
        });
      }
    });
  }

  const duplicateGroups = [...exactTextMap.entries()].filter(
    ([, locations]) => locations.length > 1
  );

  let extraDuplicateDocuments = 0;

  for (const [, locations] of duplicateGroups) {
    extraDuplicateDocuments += locations.length - 1;
  }

  console.log("\n========================================");
  console.log(" SUMMARY");
  console.log("========================================");

  console.log(`Files:                 ${files.length}`);
  console.log(`Total questions:       ${totalQuestions}`);
  console.log(`Unique question texts: ${exactTextMap.size}`);
  console.log(`Invalid questions:     ${invalidQuestions}`);
  console.log(`Duplicate groups:      ${duplicateGroups.length}`);
  console.log(`Extra duplicates:      ${extraDuplicateDocuments}`);

  console.log("\n========================================");
  console.log(" DIFFICULTY COUNTS");
  console.log("========================================");

  for (const difficulty of [
    "beginner",
    "intermediate",
    "advanced",
    "senior",
  ]) {
    console.log(
      `${difficulty.padEnd(15)} ${difficultyCounts[difficulty] || 0}`
    );
  }

  console.log("\n========================================");
  console.log(" CATEGORY COUNTS");
  console.log("========================================");

  Object.entries(categoryCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([category, count]) => {
      console.log(`${category.padEnd(30)} ${count}`);
    });

  console.log("\n========================================");
  console.log(" CATEGORY + DIFFICULTY");
  console.log("========================================");

  for (const category of [...EXPECTED_CATEGORIES].sort()) {
    console.log(`\n${category}`);

    for (const difficulty of [
      "beginner",
      "intermediate",
      "advanced",
      "senior",
    ]) {
      const key = `${category} | ${difficulty}`;

      console.log(
        `  ${difficulty.padEnd(15)} ${
          categoryDifficultyCounts[key] || 0
        }`
      );
    }
  }

  if (problems.length > 0) {
    console.log("\n========================================");
    console.log(" FIRST 50 PROBLEMS");
    console.log("========================================");

    problems.slice(0, 50).forEach((problem) => {
      console.log(problem);
    });

    if (problems.length > 50) {
      console.log(
        `\n... ${problems.length - 50} additional problems not displayed.`
      );
    }
  }

  if (duplicateGroups.length > 0) {
    console.log("\n========================================");
    console.log(" FIRST 10 DUPLICATE GROUPS");
    console.log("========================================");

    duplicateGroups.slice(0, 10).forEach(([text, locations], i) => {
      console.log(`\nDuplicate ${i + 1}:`);
      console.log(text);

      locations.forEach((location) => {
        console.log(
          `  ${location.file} #${location.index} | ${location.category} | ${location.difficulty}`
        );
      });
    });
  }

  console.log("\n========================================");

  if (
    files.length === 18 &&
    totalQuestions === 72000 &&
    invalidQuestions === 0 &&
    duplicateGroups.length === 0
  ) {
    console.log("VALIDATION PASSED");
    console.log("Dataset appears ready for DB import.");
  } else {
    console.log("VALIDATION NEEDS REVIEW");
    console.log("Do NOT import into MongoDB yet.");
  }

  console.log("========================================");
}

main();