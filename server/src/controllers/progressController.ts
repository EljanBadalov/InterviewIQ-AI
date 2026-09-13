import {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import mongoose from "mongoose";

import {
  Interview,
} from "../models/Interview";

import {
  Question,
  type InterviewType,
} from "../models/Question";

import {
  generateProgressInsights,
} from "../services/progressInsightService";

import {
  buildCareerSkillProfile,
  type ICareerSkillProfileItem,
} from "../services/careerSkillProfileService";

import {
  buildCareerKnowledgeContext,
  type ICareerKnowledgeTopicMatch,
} from "../services/careerKnowledgeService";

/* =========================================================
   TYPES
========================================================= */

type DifficultyLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "senior";

type RoleSkillStatus =
  | "not_assessed"
  | "beginner"
  | "developing"
  | "good"
  | "strong";

type RoleSkillKind =
  | "core"
  | "role"
  | "tool"
  | "topic";

interface IScoreProgressionItem {
  interviewId: string;
  date: Date;
  category: string;
  score: number;
}

interface ICategoryPerformanceItem {
  category: string;
  averageScore: number;
  interviewCount: number;
}

interface ICategorySummary {
  category: string;
  averageScore: number;
}

interface ITypeProgressionItem {
  interviewId: string;
  date: Date;
  category: string;
  score: number;
}

interface IDifficultyProgressionItem {
  interviewId: string;
  date: Date;
  difficulty: DifficultyLevel;
  score: number;
}

interface IWeaknessPattern {
  label: string;
  count: number;
}

interface ICompletedAnswerRecord {
  questionId: string;
  score: number;
  technicalAccuracy?: number;
  completeness?: number;
  communication?: number;
  weaknesses: string[];
  fallbackInterviewType: InterviewType;
}

interface IInterviewAnalytics {
  interviewId: string;
  date: Date;
  category: string;
  difficulty: DifficultyLevel;
  overallScore: number;
  technicalScore: number | null;
  behavioralScore: number | null;
}

interface IRoleSkillProgressItem {
  id: string;

  name: string;

  kind:
    RoleSkillKind;

  score:
    number |
    null;

  status:
    RoleSkillStatus;

  confidence:
    number;

  evidenceCount:
    number;

  sources:
    string[];

  interviewVerified:
    boolean;

  presentInResume:
    boolean;

  importance?:
    string;

  level?:
    string;

  reason:
    string;
}

interface IRoleSkillProgress {
  targetRole:
    string;

  roleTitle:
    string;

  roleReadiness:
    number;

  assessedAverage:
    number;

  coveragePercent:
    number;

  totalSkills:
    number;

  assessedSkills:
    number;

  strongSkills:
    number;

  priorityGaps:
    number;

  strongestSkills:
    IRoleSkillProgressItem[];

  focusSkills:
    IRoleSkillProgressItem[];

  notAssessedCount:
    number;

  skills:
    IRoleSkillProgressItem[];
}

/* =========================================================
   CONSTANTS
========================================================= */

const DIFFICULTY_ORDER:
  DifficultyLevel[] = [
    "beginner",
    "intermediate",
    "advanced",
    "senior",
  ];

/* =========================================================
   GENERIC HELPERS
========================================================= */

const getUserId = (
  req: Request
): mongoose.Types.ObjectId | null => {
  if (
    !req.user ||
    !req.user._id
  ) {
    return null;
  }

  return new mongoose.Types.ObjectId(
    String(
      req.user._id
    )
  );
};

const roundScore = (
  value: number
): number => {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        value
      )
    )
  );
};

const average = (
  values:
    number[]
): number => {
  if (
    values.length ===
    0
  ) {
    return 0;
  }

  return values.reduce(
    (
      total,
      value
    ) =>
      total +
      value,
    0
  ) /
    values.length;
};

const averageRounded = (
  values:
    number[]
): number => {
  return roundScore(
    average(
      values
    )
  );
};

const normalizeDifficulty = (
  value:
    unknown
): DifficultyLevel => {
  if (
    typeof value ===
      "string" &&
    DIFFICULTY_ORDER.includes(
      value as
        DifficultyLevel
    )
  ) {
    return value as
      DifficultyLevel;
  }

  return "intermediate";
};

const normalizeWeakness = (
  value:
    unknown
): string => {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value
    .replace(
      /\s+/g,
      " "
    )
    .trim();
};

const calculateConsistencyScore = (
  scores:
    number[]
): number => {
  if (
    scores.length ===
    0
  ) {
    return 0;
  }

  if (
    scores.length ===
    1
  ) {
    return 100;
  }

  const mean =
    average(
      scores
    );

  const variance =
    average(
      scores.map(
        (
          score
        ) =>
          Math.pow(
            score -
              mean,
            2
          )
      )
    );

  const standardDeviation =
    Math.sqrt(
      variance
    );

  return roundScore(
    100 -
      standardDeviation *
        2
  );
};

const calculateBestStreak = (
  scores:
    number[],
  threshold =
    80
): number => {
  let best =
    0;

  let current =
    0;

  for (
    const score
    of scores
  ) {
    if (
      score >=
      threshold
    ) {
      current +=
        1;

      best =
        Math.max(
          best,
          current
        );
    } else {
      current =
        0;
    }
  }

  return best;
};

/* =========================================================
   CATEGORY HELPERS
========================================================= */

const buildCategoryPerformance = (
  analytics:
    IInterviewAnalytics[]
): ICategoryPerformanceItem[] => {
  const groups =
    new Map<
      string,
      number[]
    >();

  for (
    const item
    of analytics
  ) {
    const scores =
      groups.get(
        item.category
      ) ??
      [];

    scores.push(
      item.overallScore
    );

    groups.set(
      item.category,
      scores
    );
  }

  return [
    ...groups.entries(),
  ].map(
    (
      [
        category,
        scores,
      ]
    ) => ({
      category,

      averageScore:
        averageRounded(
          scores
        ),

      interviewCount:
        scores.length,
    })
  );
};

const buildCategorySummary = (
  items:
    ICategoryPerformanceItem[],
  direction:
    "strongest" |
    "weakest"
): ICategorySummary | null => {
  if (
    items.length ===
    0
  ) {
    return null;
  }

  const sorted =
    [
      ...items,
    ].sort(
      (
        a,
        b
      ) =>
        direction ===
        "strongest"
          ? b.averageScore -
            a.averageScore
          : a.averageScore -
            b.averageScore
    );

  const first =
    sorted[
      0
    ];

  if (!first) {
    return null;
  }

  return {
    category:
      first.category,

    averageScore:
      first.averageScore,
  };
};

const getMostPracticedCategory = (
  items:
    ICategoryPerformanceItem[]
): string | null => {
  if (
    items.length ===
    0
  ) {
    return null;
  }

  const sorted =
    [
      ...items,
    ].sort(
      (
        a,
        b
      ) => {
        if (
          b.interviewCount !==
          a.interviewCount
        ) {
          return (
            b.interviewCount -
            a.interviewCount
          );
        }

        return (
          b.averageScore -
          a.averageScore
        );
      }
    );

  return (
    sorted[
      0
    ]?.category ??
    null
  );
};

/* =========================================================
   WEAKNESS PATTERNS
========================================================= */

const buildWeaknessPatterns = (
  records:
    ICompletedAnswerRecord[]
): IWeaknessPattern[] => {
  const counts =
    new Map<
      string,
      {
        label:
          string;

        count:
          number;
      }
    >();

  for (
    const record
    of records
  ) {
    for (
      const rawWeakness
      of record.weaknesses
    ) {
      const label =
        normalizeWeakness(
          rawWeakness
        );

      if (!label) {
        continue;
      }

      const key =
        label.toLowerCase();

      const previous =
        counts.get(
          key
        );

      counts.set(
        key,
        {
          label:
            previous?.label ??
            label,

          count:
            (
              previous?.count ??
              0
            ) +
            1,
        }
      );
    }
  }

  return [
    ...counts.values(),
  ]
    .sort(
      (
        a,
        b
      ) =>
        b.count -
        a.count
    )
    .slice(
      0,
      5
    );
};

/* =========================================================
   ROLE-SKILL HELPERS
========================================================= */

const normalizeSkillKey = (
  value:
    string
): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /&/g,
      " and "
    )
    .replace(
      /[_-]+/g,
      " "
    )
    .replace(
      /[^a-z0-9+#./ ]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
};

const slugifySkill = (
  value:
    string
): string => {
  return normalizeSkillKey(
    value
  )
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );
};

const fuzzySkillMatch = (
  first:
    string,
  second:
    string
): boolean => {
  const a =
    normalizeSkillKey(
      first
    );

  const b =
    normalizeSkillKey(
      second
    );

  if (
    !a ||
    !b
  ) {
    return false;
  }

  if (
    a ===
    b
  ) {
    return true;
  }

  if (
    a.length <
      4 ||
    b.length <
      4
  ) {
    return false;
  }

  return (
    a.includes(
      b
    ) ||
    b.includes(
      a
    )
  );
};

const findProfileSkill = (
  requiredName:
    string,
  profileSkills:
    ICareerSkillProfileItem[]
): ICareerSkillProfileItem | undefined => {
  const exact =
    profileSkills.find(
      (
        skill
      ) =>
        normalizeSkillKey(
          skill.name
        ) ===
        normalizeSkillKey(
          requiredName
        )
    );

  if (exact) {
    return exact;
  }

  return profileSkills.find(
    (
      skill
    ) =>
      fuzzySkillMatch(
        skill.name,
        requiredName
      )
  );
};

const findTopicMatch = (
  requiredName:
    string,
  topics:
    ICareerKnowledgeTopicMatch[]
): ICareerKnowledgeTopicMatch | undefined => {
  const exact =
    topics.find(
      (
        item
      ) =>
        normalizeSkillKey(
          item.topic.name
        ) ===
        normalizeSkillKey(
          requiredName
        )
    );

  if (exact) {
    return exact;
  }

  return topics.find(
    (
      item
    ) =>
      [
        item.topic.name,
        ...item.topic
          .relatedSkills,
        ...item.topic
          .relatedTools,
      ].some(
        (
          name
        ) =>
          fuzzySkillMatch(
            name,
            requiredName
          )
      )
  );
};

const getRoleSkillStatus = (
  score:
    number |
    null
): RoleSkillStatus => {
  if (
    score ===
    null
  ) {
    return "not_assessed";
  }

  if (
    score >=
    85
  ) {
    return "strong";
  }

  if (
    score >=
    70
  ) {
    return "good";
  }

  if (
    score >=
    50
  ) {
    return "developing";
  }

  return "beginner";
};

const getImportanceWeight = (
  importance?:
    string
): number => {
  switch (
    importance
  ) {
    case "critical":
      return 1.35;

    case "high":
      return 1.2;

    case "medium":
      return 1;

    case "low":
      return 0.8;

    default:
      return 1;
  }
};

const buildRoleSkillReason = ({
  score,
  profileSkill,
  topicMatch,
}: {
  score:
    number |
    null;

  profileSkill?:
    ICareerSkillProfileItem;

  topicMatch?:
    ICareerKnowledgeTopicMatch;
}): string => {
  if (
    score ===
    null
  ) {
    return "No direct skill evidence has been collected yet. Future technical interviews can assess this skill.";
  }

  if (
    profileSkill
      ?.interviewVerified
  ) {
    return `Interview-verified evidence currently places this skill at ${score}%.`;
  }

  if (
    profileSkill
      ?.presentInResume
  ) {
    return `The current estimate is ${score}% and includes resume evidence; more interview evidence will increase confidence.`;
  }

  if (
    topicMatch &&
    topicMatch
      .matchedUserSkills
      .length >
      0
  ) {
    return `Related evidence from ${topicMatch.matchedUserSkills
      .slice(
        0,
        3
      )
      .join(
        ", "
      )} supports the current ${score}% estimate.`;
  }

  return `Current collected evidence estimates this skill at ${score}%.`;
};

const buildRoleSkillProgressItem = ({
  name,
  kind,
  profileSkills,
  topicMatches,
  importance,
  level,
}: {
  name:
    string;

  kind:
    RoleSkillKind;

  profileSkills:
    ICareerSkillProfileItem[];

  topicMatches:
    ICareerKnowledgeTopicMatch[];

  importance?:
    string;

  level?:
    string;
}): IRoleSkillProgressItem => {
  const profileSkill =
    findProfileSkill(
      name,
      profileSkills
    );

  const topicMatch =
    findTopicMatch(
      name,
      topicMatches
    );

  /*
   * Direct UserSkillProfile / CV evidence is preferred.
   * CareerKnowledge readiness is used only when it found
   * actual matched user skills.
   */
  const topicHasEvidence =
    Boolean(
      topicMatch
        ?.matchedUserSkills
        ?.length
    );

  const score =
    profileSkill
      ? roundScore(
          profileSkill
            .skillScore
        )
      : topicHasEvidence &&
          typeof topicMatch
            ?.readinessScore ===
            "number"
        ? roundScore(
            topicMatch
              .readinessScore
          )
        : null;

  return {
    id:
      `${kind}-${slugifySkill(
        name
      )}`,

    name,

    kind,

    score,

    status:
      getRoleSkillStatus(
        score
      ),

    confidence:
      profileSkill
        ?.confidence ??
      (
        score !==
        null
          ? 0.5
          : 0
      ),

    evidenceCount:
      profileSkill
        ?.evidenceCount ??
      (
        topicMatch
          ?.matchedUserSkills
          ?.length ??
        0
      ),

    sources:
      profileSkill
        ?.sources
        ?.map(
          String
        ) ??
      [],

    interviewVerified:
      profileSkill
        ?.interviewVerified ??
      false,

    presentInResume:
      profileSkill
        ?.presentInResume ??
      false,

    importance:
      importance ??
      topicMatch
        ?.topic
        .importance,

    level:
      level ??
      topicMatch
        ?.topic
        .level,

    reason:
      buildRoleSkillReason({
        score,

        profileSkill,

        topicMatch,
      }),
  };
};

const buildRoleSkillProgress = async ({
  userId,
  targetRole,
}: {
  userId:
    mongoose.Types.ObjectId;

  targetRole:
    string;
}): Promise<IRoleSkillProgress | null> => {
  try {
    const profile =
      await buildCareerSkillProfile({
        userId,

        strongestSkillLimit:
          100,
      });

    const knowledge =
      await buildCareerKnowledgeContext({
        targetRole,

        userSkills:
          profile.skills.map(
            (
              skill
            ) => ({
              name:
                skill.name,

              score:
                skill.skillScore,

              confidence:
                skill.confidence,

              verified:
                skill.interviewVerified,

              sources:
                skill.sources
                .map(
                  String
                ),
            })
          ),

        maxTopics:
          100,

        maxPriorityTopics:
          100,

        maxInterviewTopics:
          0,

        maxScenarios:
          0,

        includeStrongTopics:
          true,
      });

    if (
      !knowledge.found
    ) {
      return null;
    }

    /*
     * combine selected + all strong topics so strong skills
     * are not lost merely because they no longer need roadmap
     * priority.
     */
    const topicMatches =
      [
        ...knowledge.topics,
        ...knowledge
          .strongTopics,
      ];

    const uniqueTopicMatches =
      [
        ...new Map(
          topicMatches.map(
            (
              item
            ) => [
              normalizeSkillKey(
                item.topic.name
              ),

              item,
            ]
          )
        ).values(),
      ];

    const map =
      new Map<
        string,
        IRoleSkillProgressItem
      >();

    const add = (
      item:
        IRoleSkillProgressItem
    ) => {
      const key =
        normalizeSkillKey(
          item.name
        );

      const existing =
        map.get(
          key
        );

      if (!existing) {
        map.set(
          key,
          item
        );

        return;
      }

      /*
       * Keep whichever duplicate has more direct evidence.
       */
      const existingEvidence =
        existing
          .evidenceCount +
        (
          existing
            .interviewVerified
            ? 2
            : 0
        );

      const newEvidence =
        item
          .evidenceCount +
        (
          item
            .interviewVerified
            ? 2
            : 0
        );

      if (
        newEvidence >
        existingEvidence
      ) {
        map.set(
          key,
          item
        );
      }
    };

    for (
      const name
      of knowledge
        .coreSkills
    ) {
      add(
        buildRoleSkillProgressItem({
          name,

          kind:
            "core",

          profileSkills:
            profile.skills,

          topicMatches:
            uniqueTopicMatches,
        })
      );
    }

    for (
      const name
      of knowledge
        .roleSkills
    ) {
      add(
        buildRoleSkillProgressItem({
          name,

          kind:
            "role",

          profileSkills:
            profile.skills,

          topicMatches:
            uniqueTopicMatches,
        })
      );
    }

    for (
      const name
      of knowledge
        .tools
    ) {
      add(
        buildRoleSkillProgressItem({
          name,

          kind:
            "tool",

          profileSkills:
            profile.skills,

          topicMatches:
            uniqueTopicMatches,
        })
      );
    }

    for (
      const topic
      of uniqueTopicMatches
    ) {
      add(
        buildRoleSkillProgressItem({
          name:
            topic.topic.name,

          kind:
            "topic",

          profileSkills:
            profile.skills,

          topicMatches:
            uniqueTopicMatches,

          importance:
            topic.topic.importance,

          level:
            topic.topic.level,
        })
      );
    }

    const skills =
      [
        ...map.values(),
      ];

    const assessed =
      skills.filter(
        (
          skill
        ) =>
          skill.score !==
          null
      );

    const weightedNumerator =
      assessed.reduce(
        (
          total,
          skill
        ) =>
          total +
          (
            skill.score ??
            0
          ) *
            getImportanceWeight(
              skill.importance
            ),
        0
      );

    const weightedDenominator =
      assessed.reduce(
        (
          total,
          skill
        ) =>
          total +
          getImportanceWeight(
            skill.importance
          ),
        0
      );

    const assessedAverage =
      weightedDenominator >
      0
        ? roundScore(
            weightedNumerator /
              weightedDenominator
          )
        : 0;

    const coveragePercent =
      skills.length >
      0
        ? roundScore(
            (
              assessed.length /
              skills.length
            ) *
              100
          )
        : 0;

    /*
     * Unknown skills are not converted to fake 0%s.
     * Coverage lowers role readiness separately.
     */
    const roleReadiness =
      assessed.length >
      0
        ? roundScore(
            assessedAverage *
              0.8 +
            coveragePercent *
              0.2
          )
        : 0;

    const sortedSkills =
      [
        ...skills,
      ].sort(
        (
          a,
          b
        ) => {
          if (
            a.score ===
              null &&
            b.score !==
              null
          ) {
            return 1;
          }

          if (
            b.score ===
              null &&
            a.score !==
              null
          ) {
            return -1;
          }

          if (
            a.score !==
              null &&
            b.score !==
              null &&
            a.score !==
              b.score
          ) {
            return (
              b.score -
              a.score
            );
          }

          return (
            getImportanceWeight(
              b.importance
            ) -
            getImportanceWeight(
              a.importance
            )
          );
        }
      );

    const strongestSkills =
      assessed
        .slice()
        .sort(
          (
            a,
            b
          ) =>
            (
              b.score ??
              0
            ) -
            (
              a.score ??
              0
            )
        )
        .slice(
          0,
          5
        );

    /*
     * Assessed weak/developing skills first.
     * Unknown skills come after actual measured gaps because
     * "unknown" is not the same as "weak".
     */
    const focusSkills =
      skills
        .filter(
          (
            skill
          ) =>
            skill.status !==
            "strong"
        )
        .slice()
        .sort(
          (
            a,
            b
          ) => {
            const aUnknown =
              a.score ===
              null;

            const bUnknown =
              b.score ===
              null;

            if (
              aUnknown !==
              bUnknown
            ) {
              return aUnknown
                ? 1
                : -1;
            }

            const importanceDelta =
              getImportanceWeight(
                b.importance
              ) -
              getImportanceWeight(
                a.importance
              );

            if (
              importanceDelta !==
              0
            ) {
              return importanceDelta;
            }

            return (
              (
                a.score ??
                101
              ) -
              (
                b.score ??
                101
              )
            );
          }
        )
        .slice(
          0,
          6
        );

    return {
      targetRole,

      roleTitle:
        knowledge
          .resolvedRole
          ?.title ??
        targetRole,

      roleReadiness,

      assessedAverage,

      coveragePercent,

      totalSkills:
        sortedSkills.length,

      assessedSkills:
        assessed.length,

      strongSkills:
        assessed.filter(
          (
            skill
          ) =>
            skill.status ===
            "strong"
        ).length,

      priorityGaps:
        assessed.filter(
          (
            skill
          ) =>
            (
              skill.score ??
              100
            ) <
            60
        ).length,

      strongestSkills,

      focusSkills,

      notAssessedCount:
        skills.filter(
          (
            skill
          ) =>
            skill.score ===
            null
        ).length,

      skills:
        sortedSkills,
    };
  } catch (
    error
  ) {
    console.error(
      "[Progress] Role skill progress failed:",
      error
    );

    return null;
  }
};

/* =========================================================
   GET PROGRESS
========================================================= */

export const getProgressController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getUserId(
          req
        );

      if (!userId) {
        res.status(
          401
        ).json({
          success:
            false,

          message:
            "Not authorized",
        });

        return;
      }

      const interviews =
        await Interview.find({
          user:
            userId,

          status:
            "completed",
        })
          .sort({
            completedAt:
              1,

            createdAt:
              1,
          })
          .lean();

      if (
        interviews.length ===
        0
      ) {
        res.status(
          200
        ).json({
          success:
            true,

          data: {
            completedInterviewsCount:
              0,

            averageTechnicalAccuracy:
              0,

            averageCompleteness:
              0,

            averageCommunication:
              0,

            technicalPerformance: {
              averageScore:
                0,

              recentAverage:
                0,

              previousAverage:
                0,

              change:
                0,

              trend:
                [],
            },

            behavioralPerformance: {
              averageScore:
                0,

              recentAverage:
                0,

              previousAverage:
                0,

              change:
                0,

              trend:
                [],
            },

            technicalBehavioralDifference:
              0,

            lastFiveAverage:
              0,

            previousFiveAverage:
              0,

            recentChange:
              0,

            consistencyScore:
              0,

            bestStreak:
              0,

            currentDifficulty:
              null,

            difficultyProgression:
              [],

            recurringWeaknesses:
              [],

            roleSkillProgress:
              null,

            aiInsights: {
              typeComparisonSummary:
                "Complete interviews to unlock personalized technical and behavioral analysis.",

              progressQualitySummary:
                "Complete interviews to unlock progress-quality analysis.",

              difficultySummary:
                "Complete interviews so InterviewIQ can estimate your adaptive level.",

              recurringPatternsSummary:
                "No recurring weakness pattern has been detected yet.",

              nextPriority:
                "Complete your first adaptive interview to receive a personalized next step.",

              roleSkillSummary:
                "Complete role-specific technical interviews to unlock a detailed technology-skill progress map.",

              roleSkillNextFocus:
                "Complete technical interview questions so InterviewIQ can identify your first role-specific skill priority.",
            },

            strongestCategory:
              null,

            weakestCategory:
              null,

            scoreProgression:
              [],

            categoryPerformance:
              [],
          },
        });

        return;
      }

      const questionIds = [
        ...new Set(
          interviews.flatMap(
            (
              interview
            ) =>
              interview.answers
                .map(
                  (
                    answer
                  ) =>
                    String(
                      answer.question
                    )
                )
                .filter(
                  Boolean
                )
          )
        ),
      ];

      const validQuestionIds =
        questionIds
          .filter(
            (
              id
            ) =>
              mongoose.Types.ObjectId.isValid(
                id
              )
          )
          .map(
            (
              id
            ) =>
              new mongoose.Types.ObjectId(
                id
              )
          );

      const questions =
        validQuestionIds.length >
        0
          ? await Question.find({
              _id: {
                $in:
                  validQuestionIds,
              },
            })
              .select(
                "_id interviewType"
              )
              .lean()
          : [];

      const questionTypeMap =
        new Map<
          string,
          InterviewType
        >();

      for (
        const question
        of questions
      ) {
        questionTypeMap.set(
          String(
            question._id
          ),
          question.interviewType
        );
      }

      const completedAnswerRecords:
        ICompletedAnswerRecord[] =
        [];

      const interviewAnalytics:
        IInterviewAnalytics[] =
        [];

      const technicalProgression:
        ITypeProgressionItem[] =
        [];

      const behavioralProgression:
        ITypeProgressionItem[] =
        [];

      const technicalAccuracyValues:
        number[] =
        [];

      const completenessValues:
        number[] =
        [];

      const communicationValues:
        number[] =
        [];

      for (
        const interview
        of interviews
      ) {
        const date =
          interview.completedAt ??
          interview.createdAt ??
          new Date();

        const fallbackInterviewType =
          (
            interview.interviewType ===
            "behavioral"
              ? "behavioral"
              : "technical"
          ) as
            InterviewType;

        const technicalScores:
          number[] =
          [];

        const behavioralScores:
          number[] =
          [];

        for (
          const answer
          of interview.answers
        ) {
          if (
            answer.evaluationStatus !==
              "completed" ||
            typeof answer.score !==
              "number"
          ) {
            continue;
          }

          const questionId =
            String(
              answer.question
            );

          const interviewType =
            questionTypeMap.get(
              questionId
            ) ??
            fallbackInterviewType;

          const score =
            roundScore(
              answer.score
            );

          if (
            interviewType ===
            "behavioral"
          ) {
            behavioralScores.push(
              score
            );
          } else {
            technicalScores.push(
              score
            );
          }

          if (
            typeof answer.technicalAccuracy ===
            "number"
          ) {
            technicalAccuracyValues.push(
              answer.technicalAccuracy
            );
          }

          if (
            typeof answer.completeness ===
            "number"
          ) {
            completenessValues.push(
              answer.completeness
            );
          }

          if (
            typeof answer.communication ===
            "number"
          ) {
            communicationValues.push(
              answer.communication
            );
          }

          completedAnswerRecords.push({
            questionId,

            score,

            technicalAccuracy:
              answer.technicalAccuracy,

            completeness:
              answer.completeness,

            communication:
              answer.communication,

            weaknesses:
              Array.isArray(
                answer.weaknesses
              )
                ? answer.weaknesses
                    .filter(
                      (
                        item
                      ): item is string =>
                        typeof item ===
                        "string"
                    )
                : [],

            fallbackInterviewType,
          });
        }

        const overallScore =
          roundScore(
            typeof interview.overallScore ===
              "number"
              ? interview.overallScore
              : average(
                  [
                    ...technicalScores,
                    ...behavioralScores,
                  ]
                )
          );

        const technicalScore =
          technicalScores.length >
          0
            ? averageRounded(
                technicalScores
              )
            : null;

        const behavioralScore =
          behavioralScores.length >
          0
            ? averageRounded(
                behavioralScores
              )
            : null;

        const analyticsItem:
          IInterviewAnalytics = {
          interviewId:
            String(
              interview._id
            ),

          date,

          category:
            interview.category,

          difficulty:
            normalizeDifficulty(
              interview.difficulty
            ),

          overallScore,

          technicalScore,

          behavioralScore,
        };

        interviewAnalytics.push(
          analyticsItem
        );

        if (
          technicalScore !==
          null
        ) {
          technicalProgression.push({
            interviewId:
              analyticsItem.interviewId,

            date,

            category:
              analyticsItem.category,

            score:
              technicalScore,
          });
        }

        if (
          behavioralScore !==
          null
        ) {
          behavioralProgression.push({
            interviewId:
              analyticsItem.interviewId,

            date,

            category:
              analyticsItem.category,

            score:
              behavioralScore,
          });
        }
      }

      const scoreProgression:
        IScoreProgressionItem[] =
        interviewAnalytics.map(
          (
            item
          ) => ({
            interviewId:
              item.interviewId,

            date:
              item.date,

            category:
              item.category,

            score:
              item.overallScore,
          })
        );

      const overallScores =
        interviewAnalytics.map(
          (
            item
          ) =>
            item.overallScore
        );

      const lastFive =
        overallScores.slice(
          -5
        );

      const previousFive =
        overallScores.slice(
          -10,
          -5
        );

      const lastFiveAverage =
        averageRounded(
          lastFive
        );

      const previousFiveAverage =
        previousFive.length >
        0
          ? averageRounded(
              previousFive
            )
          : lastFiveAverage;

      const recentChange =
        lastFiveAverage -
        previousFiveAverage;

      const technicalScores =
        technicalProgression.map(
          (
            item
          ) =>
            item.score
        );

      const behavioralScores =
        behavioralProgression.map(
          (
            item
          ) =>
            item.score
        );

      const technicalRecent =
        technicalScores.slice(
          -5
        );

      const technicalPrevious =
        technicalScores.slice(
          -10,
          -5
        );

      const behavioralRecent =
        behavioralScores.slice(
          -5
        );

      const behavioralPrevious =
        behavioralScores.slice(
          -10,
          -5
        );

      const technicalRecentAverage =
        averageRounded(
          technicalRecent
        );

      const technicalPreviousAverage =
        technicalPrevious.length >
        0
          ? averageRounded(
              technicalPrevious
            )
          : technicalRecentAverage;

      const behavioralRecentAverage =
        averageRounded(
          behavioralRecent
        );

      const behavioralPreviousAverage =
        behavioralPrevious.length >
        0
          ? averageRounded(
              behavioralPrevious
            )
          : behavioralRecentAverage;

      const technicalAverage =
        averageRounded(
          technicalScores
        );

      const behavioralAverage =
        averageRounded(
          behavioralScores
        );

      const categoryPerformance =
        buildCategoryPerformance(
          interviewAnalytics
        );

      const strongestCategory =
        buildCategorySummary(
          categoryPerformance,
          "strongest"
        );

      const weakestCategory =
        buildCategorySummary(
          categoryPerformance,
          "weakest"
        );

      const mostPracticedCategory =
        getMostPracticedCategory(
          categoryPerformance
        );

      const roleSkillProgress =
        mostPracticedCategory
          ? await buildRoleSkillProgress({
              userId,

              targetRole:
                mostPracticedCategory,
            })
          : null;

      const latestInterview =
        interviewAnalytics[
          interviewAnalytics.length -
            1
        ];

      const difficultyProgression:
        IDifficultyProgressionItem[] =
        interviewAnalytics.map(
          (
            item
          ) => ({
            interviewId:
              item.interviewId,

            date:
              item.date,

            difficulty:
              item.difficulty,

            score:
              item.overallScore,
          })
        );

      const recurringWeaknesses =
        buildWeaknessPatterns(
          completedAnswerRecords
        );

      const consistencyScore =
        calculateConsistencyScore(
          overallScores
        );

      const bestStreak =
        calculateBestStreak(
          overallScores,
          80
        );

      const aiInsights =
        await generateProgressInsights({
          completedInterviewsCount:
            interviewAnalytics.length,

          averageScore:
            averageRounded(
              overallScores
            ),

          technicalAverage,

          behavioralAverage,

          technicalRecentAverage,

          behavioralRecentAverage,

          technicalChange:
            technicalRecentAverage -
            technicalPreviousAverage,

          behavioralChange:
            behavioralRecentAverage -
            behavioralPreviousAverage,

          lastFiveAverage,

          previousFiveAverage,

          recentChange,

          consistencyScore,

          bestStreak,

          currentDifficulty:
            latestInterview
              ?.difficulty ??
            null,

          difficultyHistory:
            difficultyProgression
              .slice(
                -8
              )
              .map(
                (
                  item
                ) => ({
                  difficulty:
                    item.difficulty,

                  score:
                    item.score,
                })
              ),

          recurringWeaknesses:
            recurringWeaknesses
              .slice(
                0,
                5
              ),

          roleSkillProgress:
            roleSkillProgress
              ? {
                  roleTitle:
                    roleSkillProgress
                      .roleTitle,

                  roleReadiness:
                    roleSkillProgress
                      .roleReadiness,

                  assessedAverage:
                    roleSkillProgress
                      .assessedAverage,

                  coveragePercent:
                    roleSkillProgress
                      .coveragePercent,

                  assessedSkills:
                    roleSkillProgress
                      .assessedSkills,

                  totalSkills:
                    roleSkillProgress
                      .totalSkills,

                  strongSkills:
                    roleSkillProgress
                      .strongestSkills
                      .filter(
                        (
                          item
                        ) =>
                          item.score !==
                          null
                      )
                      .map(
                        (
                          item
                        ) => ({
                          name:
                            item.name,

                          score:
                            item.score as
                              number,
                        })
                      ),

                  focusSkills:
                    roleSkillProgress
                      .focusSkills
                      .map(
                        (
                          item
                        ) => ({
                          name:
                            item.name,

                          score:
                            item.score,

                          status:
                            item.status,
                        })
                      ),

                  notAssessedSkills:
                    roleSkillProgress
                      .skills
                      .filter(
                        (
                          item
                        ) =>
                          item.score ===
                          null
                      )
                      .slice(
                        0,
                        10
                      )
                      .map(
                        (
                          item
                        ) =>
                          item.name
                      ),
                }
              : null,
        });

      res.status(
        200
      ).json({
        success:
          true,

        data: {
          completedInterviewsCount:
            interviewAnalytics.length,

          averageTechnicalAccuracy:
            averageRounded(
              technicalAccuracyValues
            ),

          averageCompleteness:
            averageRounded(
              completenessValues
            ),

          averageCommunication:
            averageRounded(
              communicationValues
            ),

          technicalPerformance: {
            averageScore:
              technicalAverage,

            recentAverage:
              technicalRecentAverage,

            previousAverage:
              technicalPreviousAverage,

            change:
              technicalRecentAverage -
              technicalPreviousAverage,

            trend:
              technicalProgression,
          },

          behavioralPerformance: {
            averageScore:
              behavioralAverage,

            recentAverage:
              behavioralRecentAverage,

            previousAverage:
              behavioralPreviousAverage,

            change:
              behavioralRecentAverage -
              behavioralPreviousAverage,

            trend:
              behavioralProgression,
          },

          technicalBehavioralDifference:
            behavioralAverage -
            technicalAverage,

          lastFiveAverage,

          previousFiveAverage,

          recentChange,

          consistencyScore,

          bestStreak,

          currentDifficulty:
            latestInterview
              ?.difficulty ??
            null,

          difficultyProgression,

          recurringWeaknesses,

          roleSkillProgress,

          aiInsights,

          strongestCategory,

          weakestCategory,

          scoreProgression,

          categoryPerformance,
        },
      });
    } catch (
      error
    ) {
      next(
        error
      );
    }
  };

export default {
  getProgressController,
};
