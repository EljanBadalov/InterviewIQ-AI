import qwenService, {
  IQwenJSONResult,
} from "./qwenService";

/* =========================================================
   TYPES
========================================================= */

export interface ProgressRoleSkillInsightInput {
  roleTitle: string;

  roleReadiness: number;

  assessedAverage: number;

  coveragePercent: number;

  assessedSkills: number;

  totalSkills: number;

  strongSkills: Array<{
    name: string;
    score: number;
  }>;

  focusSkills: Array<{
    name: string;
    score: number | null;
    status: string;
  }>;

  notAssessedSkills: string[];
}

export interface ProgressInsightInput {
  completedInterviewsCount: number;

  averageScore: number;

  technicalAverage: number;

  behavioralAverage: number;

  technicalRecentAverage: number;

  behavioralRecentAverage: number;

  technicalChange: number;

  behavioralChange: number;

  lastFiveAverage: number;

  previousFiveAverage: number;

  recentChange: number;

  consistencyScore: number;

  bestStreak: number;

  currentDifficulty: string | null;

  difficultyHistory: Array<{
    difficulty: string;
    score: number;
  }>;

  recurringWeaknesses: Array<{
    label: string;
    count: number;
  }>;

  /*
   * Optional because users may not yet have enough
   * role-specific interview history to resolve a role.
   */
  roleSkillProgress?:
    ProgressRoleSkillInsightInput |
    null;
}

export interface ProgressAIInsights {
  typeComparisonSummary: string;

  progressQualitySummary: string;

  difficultySummary: string;

  recurringPatternsSummary: string;

  nextPriority: string;

  roleSkillSummary: string;

  roleSkillNextFocus: string;
}

/* =========================================================
   HELPERS
========================================================= */

const normalizeText = (
  value: unknown,
  fallback: string
): string => {
  if (
    typeof value !==
    "string"
  ) {
    return fallback;
  }

  const cleaned =
    value
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  return (
    cleaned ||
    fallback
  );
};

/* =========================================================
   FALLBACK
========================================================= */

const buildFallbackInsights = (
  input:
    ProgressInsightInput
): ProgressAIInsights => {
  const gap =
    input.behavioralAverage -
    input.technicalAverage;

  const typeComparisonSummary =
    gap === 0
      ? "Your technical and behavioral performance is currently balanced."
      : gap > 0
        ? `Your behavioral performance is ${Math.abs(
            gap
          )} points stronger than your technical performance.`
        : `Your technical performance is ${Math.abs(
            gap
          )} points stronger than your behavioral performance.`;

  const progressQualitySummary =
    input.recentChange > 0
      ? `Your recent five-interview average improved by ${input.recentChange} points compared with the previous five, with ${input.consistencyScore}% consistency.`
      : input.recentChange < 0
        ? `Your recent five-interview average is ${Math.abs(
            input.recentChange
          )} points lower than the previous five, while consistency is ${input.consistencyScore}%.`
        : `Your recent five-interview average is stable, with ${input.consistencyScore}% consistency across completed sessions.`;

  const difficultySummary =
    input.currentDifficulty
      ? `Your current adaptive interview level is ${input.currentDifficulty}. The system may keep the same level across several sessions until your results provide enough evidence to move up or down.`
      : "Complete more interviews so InterviewIQ can estimate your adaptive interview level.";

  const recurringPatternsSummary =
    input.recurringWeaknesses.length >
    0
      ? `The most repeated improvement theme is: ${
          input.recurringWeaknesses[
            0
          ]?.label ??
          "review lower-scoring answers"
        }`
      : "No recurring weakness pattern has been detected yet.";

  const nextPriority =
    input.technicalAverage <
    input.behavioralAverage
      ? "Prioritize technical interview practice while keeping your behavioral performance steady."
      : input.behavioralAverage <
          input.technicalAverage
        ? "Prioritize behavioral interview practice, especially structured examples and clear outcomes."
        : "Keep both interview types balanced and focus on the lowest-scoring individual answers.";

  const role =
    input.roleSkillProgress;

  const roleSkillSummary =
    role
      ? role.assessedSkills >
        0
        ? `For ${role.roleTitle}, InterviewIQ currently has evidence for ${role.assessedSkills} of ${role.totalSkills} mapped skills (${role.coveragePercent}% coverage), with a ${role.assessedAverage}% average across assessed skills.`
        : `InterviewIQ mapped the required skills for ${role.roleTitle}, but there is not enough direct skill evidence yet to estimate mastery.`
      : "Complete role-specific technical interviews to unlock a detailed technology-skill progress map.";

  const firstFocus =
    role?.focusSkills[
      0
    ];

  const roleSkillNextFocus =
    role &&
    firstFocus
      ? firstFocus.score ===
        null
        ? `Collect direct evidence for ${firstFocus.name} next so InterviewIQ can determine your current level in that required skill.`
        : `Prioritize ${firstFocus.name}, currently measured at ${firstFocus.score}%, while maintaining your stronger role skills.`
      : "Complete more technical interview questions so InterviewIQ can identify your next role-specific skill priority.";

  return {
    typeComparisonSummary,

    progressQualitySummary,

    difficultySummary,

    recurringPatternsSummary,

    nextPriority,

    roleSkillSummary,

    roleSkillNextFocus,
  };
};

/* =========================================================
   NORMALIZE
========================================================= */

const normalizeInsights = (
  raw: unknown,
  fallback:
    ProgressAIInsights
): ProgressAIInsights => {
  if (
    typeof raw !==
      "object" ||
    raw === null ||
    Array.isArray(
      raw
    )
  ) {
    return fallback;
  }

  const data =
    raw as
      Record<
        string,
        unknown
      >;

  return {
    typeComparisonSummary:
      normalizeText(
        data
          .typeComparisonSummary,
        fallback
          .typeComparisonSummary
      ),

    progressQualitySummary:
      normalizeText(
        data
          .progressQualitySummary,
        fallback
          .progressQualitySummary
      ),

    difficultySummary:
      normalizeText(
        data
          .difficultySummary,
        fallback
          .difficultySummary
      ),

    recurringPatternsSummary:
      normalizeText(
        data
          .recurringPatternsSummary,
        fallback
          .recurringPatternsSummary
      ),

    nextPriority:
      normalizeText(
        data.nextPriority,
        fallback.nextPriority
      ),

    roleSkillSummary:
      normalizeText(
        data
          .roleSkillSummary,
        fallback
          .roleSkillSummary
      ),

    roleSkillNextFocus:
      normalizeText(
        data
          .roleSkillNextFocus,
        fallback
          .roleSkillNextFocus
      ),
  };
};

/* =========================================================
   PROMPT
========================================================= */

const createPrompt = (
  input:
    ProgressInsightInput
): string => {
  return `
You are the progress analyst for InterviewIQ.

Write concise, professional, personalized interview-progress insights using ONLY the supplied metrics.

STRICT RULES:
- Do not invent scores, trends, reasons, dates, skills, achievements, or evidence.
- Do not change any supplied percentage.
- "Not assessed" means unknown. Never describe an unassessed skill as weak.
- Resume evidence is supporting evidence, not the same as interview verification.
- Explain what the metrics mean in plain English.
- Avoid generic motivational language.

IMPORTANT ABOUT ADAPTIVE DIFFICULTY:
- Beginner = foundational questions.
- Intermediate = practical junior/mid-level questions.
- Advanced = deeper technical or professional reasoning and harder scenarios.
- Senior = architecture, leadership, trade-offs, ownership, and high-level judgment.
- Repeating the same difficulty across several interviews is normal.
- Difficulty can move up OR down when recent evidence changes.

OVERALL DATA
Completed interviews: ${input.completedInterviewsCount}
Overall average: ${input.averageScore}
Technical average: ${input.technicalAverage}
Behavioral average: ${input.behavioralAverage}
Technical recent average: ${input.technicalRecentAverage}
Behavioral recent average: ${input.behavioralRecentAverage}
Technical recent change: ${input.technicalChange}
Behavioral recent change: ${input.behavioralChange}
Last 5 average: ${input.lastFiveAverage}
Previous 5 average: ${input.previousFiveAverage}
Recent overall change: ${input.recentChange}
Consistency score: ${input.consistencyScore}
Best 80%+ streak: ${input.bestStreak}
Current adaptive difficulty: ${input.currentDifficulty ?? "unknown"}
Difficulty history: ${JSON.stringify(
    input
      .difficultyHistory
  )}
Recurring weaknesses: ${JSON.stringify(
    input
      .recurringWeaknesses
  )}

ROLE SKILL PROGRESS
${JSON.stringify(
  input.roleSkillProgress ??
    null,
  null,
  2
)}

Return ONLY valid JSON with exactly these fields:
{
  "typeComparisonSummary": "1 short sentence explaining technical vs behavioral performance",
  "progressQualitySummary": "1 short sentence explaining recent improvement and consistency",
  "difficultySummary": "1-2 short sentences explaining the adaptive level and meaningful level changes",
  "recurringPatternsSummary": "1 short sentence summarizing the most useful recurring improvement pattern",
  "nextPriority": "1 short actionable sentence about overall interview performance",
  "roleSkillSummary": "1-2 short sentences explaining the user's role-specific skill coverage/mastery without inventing skills",
  "roleSkillNextFocus": "1 short actionable sentence identifying the highest-value role skill to assess or improve next"
}
`.trim();
};

/* =========================================================
   CACHE
========================================================= */

const CACHE_TTL_MS =
  10 *
  60 *
  1000;

const cache =
  new Map<
    string,
    {
      expiresAt:
        number;

      data:
        ProgressAIInsights;
    }
  >();

/* =========================================================
   MAIN
========================================================= */

export const generateProgressInsights =
  async (
    input:
      ProgressInsightInput
  ): Promise<ProgressAIInsights> => {
    const fallback =
      buildFallbackInsights(
        input
      );

    const cacheKey =
      JSON.stringify(
        input
      );

    const cached =
      cache.get(
        cacheKey
      );

    if (
      cached &&
      cached.expiresAt >
        Date.now()
    ) {
      return cached.data;
    }

    try {
      const response:
        IQwenJSONResult<ProgressAIInsights> =
        await qwenService.generateQwenJSON<ProgressAIInsights>({
          messages: [
            {
              role:
                "user",

              content:
                createPrompt(
                  input
                ),
            },
          ],

          temperature:
            0.15,
        });

      if (
        !response.success ||
        !response.data
      ) {
        return fallback;
      }

      const normalized =
        normalizeInsights(
          response.data,
          fallback
        );

      cache.set(
        cacheKey,
        {
          expiresAt:
            Date.now() +
            CACHE_TTL_MS,

          data:
            normalized,
        }
      );

      return normalized;
    } catch (
      error
    ) {
      console.error(
        "[Progress Insight Service] Qwen insight generation failed:",
        error
      );

      return fallback;
    }
  };

export default {
  generateProgressInsights,
};
