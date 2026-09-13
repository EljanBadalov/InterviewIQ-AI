import {
  CareerKnowledge,
  type CareerKnowledgeDomain,
  type CareerKnowledgeImportance,
  type CareerKnowledgeLevel,
  type CareerKnowledgeSource,
  type ICareerKnowledge,
  type ICareerKnowledgeInterviewTopic,
  type ICareerKnowledgeRole,
  type ICareerKnowledgeScenario,
  type ICareerKnowledgeTopic,
} from "../models/CareerKnowledge";

/* =========================================================
   TYPES
========================================================= */

export interface ICareerKnowledgeSkillEvidence {
  name: string;
  score?: number;
  confidence?: number;
  verified?: boolean;
  sources?: string[];
}

export type CareerKnowledgeGapStatus =
  | "missing"
  | "weak"
  | "developing"
  | "strong"
  | "unknown";

export interface ICareerKnowledgeTopicMatch {
  topic: ICareerKnowledgeTopic;
  readinessScore?: number;
  status: CareerKnowledgeGapStatus;
  relevanceScore: number;
  priorityScore: number;
  matchedUserSkills: string[];
  reason: string;
}

export interface ICareerKnowledgeContext {
  found: boolean;
  targetRole: string;

  resolvedRole?: {
    slug: string;
    title: string;
    domain: CareerKnowledgeDomain;
    source: CareerKnowledgeSource;
    description?: string;
  };

  role?: ICareerKnowledgeRole;

  topics: ICareerKnowledgeTopicMatch[];
  priorityTopics: ICareerKnowledgeTopicMatch[];
  strongTopics: ICareerKnowledgeTopicMatch[];

  interviewTopics: ICareerKnowledgeInterviewTopic[];
  practicalScenarios: ICareerKnowledgeScenario[];

  coreSkills: string[];
  roleSkills: string[];
  tools: string[];
  knowledgeAreas: string[];
  responsibilities: string[];
  recommendedProjects: string[];

  metadata: {
    totalRoleTopics: number;
    evaluatedTopics: number;
    priorityTopicCount: number;
    strongTopicCount: number;
    userSkillEvidenceCount: number;

    roleResolvedBy?:
      | "slug"
      | "title"
      | "alias"
      | "text";

    selectedLevels: CareerKnowledgeLevel[];
  };
}

export interface IBuildCareerKnowledgeContextInput {
  targetRole: string;
  domain?: CareerKnowledgeDomain;
  userSkills?: ICareerKnowledgeSkillEvidence[];

  maxTopics?: number;
  maxPriorityTopics?: number;
  maxInterviewTopics?: number;
  maxScenarios?: number;

  includeStrongTopics?: boolean;
}

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_MAX_TOPICS = 24;
const DEFAULT_MAX_PRIORITY_TOPICS = 12;
const DEFAULT_MAX_INTERVIEW_TOPICS = 10;
const DEFAULT_MAX_SCENARIOS = 8;

const LEVEL_WEIGHT: Record<CareerKnowledgeLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  production: 4,
  expert: 5,
};

const IMPORTANCE_WEIGHT: Record<CareerKnowledgeImportance, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/* =========================================================
   STRING HELPERS
========================================================= */

const normalizeString = (
  value: string | undefined | null
): string => {
  return (value || "")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeKey = (
  value: string | undefined | null
): string => {
  return normalizeString(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const slugify = (
  value: string
): string => {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const escapeRegex = (
  value: string
): string => {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
};

const uniqueStrings = (
  values: Array<string | undefined | null>
): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    const value = normalizeString(raw);

    if (!value) {
      continue;
    }

    const key = normalizeKey(value);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
};

const clamp = (
  value: number,
  min = 0,
  max = 100
): number => {
  return Math.max(
    min,
    Math.min(max, value)
  );
};

/* =========================================================
   USER SKILL INDEX
========================================================= */

interface IUserSkillIndexItem {
  name: string;
  normalizedName: string;
  score?: number;
  confidence?: number;
  verified: boolean;
  sources: string[];
}

const buildUserSkillIndex = (
  skills: ICareerKnowledgeSkillEvidence[] = []
): Map<string, IUserSkillIndexItem> => {
  const index =
    new Map<string, IUserSkillIndexItem>();

  for (const skill of skills) {
    const name =
      normalizeString(skill.name);

    if (!name) {
      continue;
    }

    const normalizedName =
      normalizeKey(name);

    const score =
      typeof skill.score === "number"
        ? clamp(skill.score)
        : undefined;

    const existing =
      index.get(normalizedName);

    if (!existing) {
      index.set(
        normalizedName,
        {
          name,
          normalizedName,
          score,
          confidence:
            typeof skill.confidence === "number"
              ? skill.confidence
              : undefined,
          verified:
            Boolean(skill.verified),
          sources:
            uniqueStrings(skill.sources || []),
        }
      );

      continue;
    }

    index.set(
      normalizedName,
      {
        ...existing,

        score:
          typeof score === "number"
            ? Math.max(
                existing.score ?? 0,
                score
              )
            : existing.score,

        confidence:
          typeof skill.confidence === "number"
            ? Math.max(
                existing.confidence ?? 0,
                skill.confidence
              )
            : existing.confidence,

        verified:
          existing.verified ||
          Boolean(skill.verified),

        sources:
          uniqueStrings([
            ...existing.sources,
            ...(skill.sources || []),
          ]),
      }
    );
  }

  return index;
};

/* =========================================================
   ROLE RESOLUTION
========================================================= */

interface IResolvedKnowledgeDocument {
  document: ICareerKnowledge;

  resolvedBy:
    | "slug"
    | "title"
    | "alias"
    | "text";
}

const findExactRoleBySlug = async (
  targetRole: string,
  domain?: CareerKnowledgeDomain
): Promise<ICareerKnowledge | null> => {
  const filter: Record<string, unknown> = {
    "role.slug": slugify(targetRole),
    status: "active",
  };

  if (domain) {
    filter.domain = domain;
  }

  return CareerKnowledge
    .findOne(filter)
    .lean<ICareerKnowledge>();
};

const findExactRoleByTitle = async (
  targetRole: string,
  domain?: CareerKnowledgeDomain
): Promise<ICareerKnowledge | null> => {
  const regex =
    new RegExp(
      `^${escapeRegex(
        normalizeString(targetRole)
      )}$`,
      "i"
    );

  const filter: Record<string, unknown> = {
    "role.title": regex,
    status: "active",
  };

  if (domain) {
    filter.domain = domain;
  }

  return CareerKnowledge
    .findOne(filter)
    .lean<ICareerKnowledge>();
};

const findExactRoleByAlias = async (
  targetRole: string,
  domain?: CareerKnowledgeDomain
): Promise<ICareerKnowledge | null> => {
  const regex =
    new RegExp(
      `^${escapeRegex(
        normalizeString(targetRole)
      )}$`,
      "i"
    );

  const filter: Record<string, unknown> = {
    "role.aliases": regex,
    status: "active",
  };

  if (domain) {
    filter.domain = domain;
  }

  return CareerKnowledge
    .findOne(filter)
    .lean<ICareerKnowledge>();
};

const findRoleByText = async (
  targetRole: string,
  domain?: CareerKnowledgeDomain
): Promise<ICareerKnowledge | null> => {
  const filter: Record<string, unknown> = {
    $text: {
      $search:
        normalizeString(targetRole),
    },

    status: "active",
  };

  if (domain) {
    filter.domain = domain;
  }

  return CareerKnowledge
    .findOne(
      filter,
      {
        score: {
          $meta: "textScore",
        },
      }
    )
    .sort({
      score: {
        $meta: "textScore",
      },
    })
    .lean<ICareerKnowledge>();
};

export const resolveCareerKnowledgeRole =
  async ({
    targetRole,
    domain,
  }: {
    targetRole: string;
    domain?: CareerKnowledgeDomain;
  }): Promise<IResolvedKnowledgeDocument | null> => {
    const normalizedRole =
      normalizeString(targetRole);

    if (!normalizedRole) {
      return null;
    }

    const bySlug =
      await findExactRoleBySlug(
        normalizedRole,
        domain
      );

    if (bySlug) {
      return {
        document: bySlug,
        resolvedBy: "slug",
      };
    }

    const byTitle =
      await findExactRoleByTitle(
        normalizedRole,
        domain
      );

    if (byTitle) {
      return {
        document: byTitle,
        resolvedBy: "title",
      };
    }

    const byAlias =
      await findExactRoleByAlias(
        normalizedRole,
        domain
      );

    if (byAlias) {
      return {
        document: byAlias,
        resolvedBy: "alias",
      };
    }

    const byText =
      await findRoleByText(
        normalizedRole,
        domain
      );

    if (byText) {
      return {
        document: byText,
        resolvedBy: "text",
      };
    }

    return null;
  };

/* =========================================================
   TOPIC / SKILL MATCHING
========================================================= */

const getTopicSkillNames = (
  topic: ICareerKnowledgeTopic
): string[] => {
  return uniqueStrings([
    topic.name,
    ...topic.relatedSkills,
    ...topic.relatedTools,
    ...topic.prerequisites,
  ]);
};

const fuzzySkillMatch = (
  left: string,
  right: string
): boolean => {
  const a = normalizeKey(left);
  const b = normalizeKey(right);

  if (!a || !b) {
    return false;
  }

  if (a === b) {
    return true;
  }

  /*
   * Avoid matching tiny generic fragments such as "C" or "UI".
   */
  if (
    a.length < 4 ||
    b.length < 4
  ) {
    return false;
  }

  return (
    a.includes(b) ||
    b.includes(a)
  );
};

const resolveTopicUserEvidence = (
  topic: ICareerKnowledgeTopic,
  userSkillIndex:
    Map<string, IUserSkillIndexItem>
): {
  score?: number;
  matchedUserSkills: string[];
} => {
  const topicSkills =
    getTopicSkillNames(topic);

  const matched:
    IUserSkillIndexItem[] = [];

  for (const topicSkill of topicSkills) {
    const exact =
      userSkillIndex.get(
        normalizeKey(topicSkill)
      );

    if (exact) {
      matched.push(exact);
      continue;
    }

    for (
      const candidate
      of userSkillIndex.values()
    ) {
      if (
        fuzzySkillMatch(
          topicSkill,
          candidate.name
        )
      ) {
        matched.push(candidate);
      }
    }
  }

  const uniqueMatched =
    Array.from(
      new Map(
        matched.map(
          (item) => [
            item.normalizedName,
            item,
          ]
        )
      ).values()
    );

  const scored =
    uniqueMatched
      .map((item) => item.score)
      .filter(
        (score): score is number =>
          typeof score === "number"
      );

  if (scored.length === 0) {
    return {
      matchedUserSkills:
        uniqueMatched.map(
          (item) => item.name
        ),
    };
  }

  return {
    score:
      Math.max(...scored),

    matchedUserSkills:
      uniqueMatched.map(
        (item) => item.name
      ),
  };
};

/* =========================================================
   READINESS / LEVEL POLICY
========================================================= */

const getGapStatus = (
  score?: number
): CareerKnowledgeGapStatus => {
  if (typeof score !== "number") {
    return "missing";
  }

  if (score < 40) {
    return "weak";
  }

  if (score < 80) {
    return "developing";
  }

  return "strong";
};

/*
 * Target depth policy:
 *
 * no evidence / <40  -> beginner + intermediate
 * 40-69              -> intermediate + advanced
 * 70-79              -> advanced + production
 * >=80               -> production + expert
 *
 * This prevents a 70% JavaScript user from getting basic Arrays,
 * Promises or DOM topics as the main recommendation.
 */
export const getPreferredKnowledgeLevels = (
  readinessScore?: number
): CareerKnowledgeLevel[] => {
  if (typeof readinessScore !== "number") {
    return [
      "beginner",
      "intermediate",
    ];
  }

  if (readinessScore < 40) {
    return [
      "beginner",
      "intermediate",
    ];
  }

  if (readinessScore < 70) {
    return [
      "intermediate",
      "advanced",
    ];
  }

  if (readinessScore < 80) {
    return [
      "advanced",
      "production",
    ];
  }

  return [
    "production",
    "expert",
  ];
};

const calculateLevelFit = (
  topicLevel: CareerKnowledgeLevel,
  readinessScore?: number
): number => {
  const preferred =
    getPreferredKnowledgeLevels(
      readinessScore
    );

  const directIndex =
    preferred.indexOf(topicLevel);

  if (directIndex === 0) {
    return 100;
  }

  if (directIndex === 1) {
    return 90;
  }

  const topicWeight =
    LEVEL_WEIGHT[topicLevel];

  const preferredWeights =
    preferred.map(
      (level) =>
        LEVEL_WEIGHT[level]
    );

  const minimumDistance =
    Math.min(
      ...preferredWeights.map(
        (weight) =>
          Math.abs(
            weight -
            topicWeight
          )
      )
    );

  if (minimumDistance === 1) {
    return 55;
  }

  return 15;
};

/* =========================================================
   RELEVANCE / PRIORITY
========================================================= */

const calculateTopicRelevance = ({
  topic,
  readinessScore,
}: {
  topic: ICareerKnowledgeTopic;
  readinessScore?: number;
}): number => {
  const importanceScore =
    (
      IMPORTANCE_WEIGHT[
        topic.importance
      ] /
      4
    ) *
    100;

  const levelFit =
    calculateLevelFit(
      topic.level,
      readinessScore
    );

  const scenarioScore =
    topic.practicalScenarios.length > 0
      ? 100
      : 45;

  const evidenceScore =
    topic.expectedEvidence.length > 0
      ? 100
      : 55;

  return Math.round(
    importanceScore * 0.40 +
    levelFit * 0.35 +
    scenarioScore * 0.15 +
    evidenceScore * 0.10
  );
};

const calculateTopicPriority = ({
  topic,
  readinessScore,
  relevanceScore,
}: {
  topic: ICareerKnowledgeTopic;
  readinessScore?: number;
  relevanceScore: number;
}): number => {
  const gapScore =
    typeof readinessScore !== "number"
      ? 100
      : 100 - readinessScore;

  const advancedStrongSkillBonus =
    typeof readinessScore === "number" &&
    readinessScore >= 70 &&
    (
      topic.level === "advanced" ||
      topic.level === "production" ||
      topic.level === "expert"
    )
      ? 18
      : 0;

  const productionImportanceBonus =
    (
      topic.importance === "critical" ||
      topic.importance === "high"
    ) &&
    (
      topic.level === "production" ||
      topic.level === "expert"
    )
      ? 10
      : 0;

  return Math.round(
    clamp(
      gapScore * 0.55 +
      relevanceScore * 0.45 +
      advancedStrongSkillBonus +
      productionImportanceBonus
    )
  );
};

const buildTopicReason = ({
  topic,
  readinessScore,
  status,
  matchedUserSkills,
}: {
  topic: ICareerKnowledgeTopic;
  readinessScore?: number;
  status: CareerKnowledgeGapStatus;
  matchedUserSkills: string[];
}): string => {
  const skillText =
    matchedUserSkills.length > 0
      ? matchedUserSkills
          .slice(0, 3)
          .join(", ")
      : "";

  if (status === "missing") {
    return `${topic.name} is part of the target-role knowledge base, but there is no strong evidence for it in the current user profile.`;
  }

  if (status === "weak") {
    return `${topic.name} is relevant to the target role and the current evidence is still weak${skillText ? ` (${skillText})` : ""}.`;
  }

  if (
    typeof readinessScore === "number" &&
    readinessScore >= 70
  ) {
    return `${topic.name} is already supported by roughly ${readinessScore}% readiness, so the roadmap should focus on ${topic.level} real-world depth instead of introductory material.`;
  }

  return `${topic.name} is relevant to the target role and current evidence suggests there is still room to build deeper practical capability.`;
};

/* =========================================================
   TOPIC SELECTION
========================================================= */

const evaluateTopics = ({
  topics,
  userSkillIndex,
}: {
  topics: ICareerKnowledgeTopic[];
  userSkillIndex:
    Map<string, IUserSkillIndexItem>;
}): ICareerKnowledgeTopicMatch[] => {
  return topics.map(
    (topic) => {
      const evidence =
        resolveTopicUserEvidence(
          topic,
          userSkillIndex
        );

      const status =
        getGapStatus(
          evidence.score
        );

      const relevanceScore =
        calculateTopicRelevance({
          topic,
          readinessScore:
            evidence.score,
        });

      const priorityScore =
        calculateTopicPriority({
          topic,
          readinessScore:
            evidence.score,
          relevanceScore,
        });

      return {
        topic,
        readinessScore:
          evidence.score,
        status,
        relevanceScore,
        priorityScore,
        matchedUserSkills:
          evidence.matchedUserSkills,
        reason:
          buildTopicReason({
            topic,
            readinessScore:
              evidence.score,
            status,
            matchedUserSkills:
              evidence
                .matchedUserSkills,
          }),
      };
    }
  );
};

const shouldKeepTopic = (
  item: ICareerKnowledgeTopicMatch,
  includeStrongTopics: boolean
): boolean => {
  const {
    topic,
    readinessScore,
  } = item;

  const preferredLevels =
    getPreferredKnowledgeLevels(
      readinessScore
    );

  const levelIsPreferred =
    preferredLevels.includes(
      topic.level
    );

  if (
    item.status === "strong" &&
    !includeStrongTopics
  ) {
    /*
     * Strong skills only remain when the topic itself is genuinely
     * production/expert and important.
     */
    return (
      (
        topic.level === "production" ||
        topic.level === "expert"
      ) &&
      (
        topic.importance === "critical" ||
        topic.importance === "high"
      )
    );
  }

  return (
    levelIsPreferred ||
    item.status === "missing" ||
    item.status === "weak"
  );
};

const sortTopicMatches = (
  items: ICareerKnowledgeTopicMatch[]
): ICareerKnowledgeTopicMatch[] => {
  return [...items].sort(
    (a, b) => {
      if (
        b.priorityScore !==
        a.priorityScore
      ) {
        return (
          b.priorityScore -
          a.priorityScore
        );
      }

      if (
        b.relevanceScore !==
        a.relevanceScore
      ) {
        return (
          b.relevanceScore -
          a.relevanceScore
        );
      }

      const importanceDifference =
        IMPORTANCE_WEIGHT[
          b.topic.importance
        ] -
        IMPORTANCE_WEIGHT[
          a.topic.importance
        ];

      if (
        importanceDifference !== 0
      ) {
        return importanceDifference;
      }

      return (
        LEVEL_WEIGHT[
          b.topic.level
        ] -
        LEVEL_WEIGHT[
          a.topic.level
        ]
      );
    }
  );
};

/* =========================================================
   INTERVIEW / SCENARIO SELECTION
========================================================= */

const scoreInterviewTopic = (
  topic: ICareerKnowledgeInterviewTopic,
  priorityTopicNames: Set<string>
): number => {
  let score =
    LEVEL_WEIGHT[
      topic.level
    ] *
    10;

  for (
    const skill
    of topic.relatedSkills
  ) {
    if (
      priorityTopicNames.has(
        normalizeKey(skill)
      )
    ) {
      score += 20;
    }
  }

  if (
    topic.type === "scenario" ||
    topic.type === "case_study"
  ) {
    score += 15;
  }

  return score;
};

const selectInterviewTopics = ({
  interviewTopics,
  priorityTopics,
  limit,
}: {
  interviewTopics:
    ICareerKnowledgeInterviewTopic[];

  priorityTopics:
    ICareerKnowledgeTopicMatch[];

  limit: number;
}): ICareerKnowledgeInterviewTopic[] => {
  const priorityTopicNames =
    new Set(
      priorityTopics.flatMap(
        (item) => [
          normalizeKey(
            item.topic.name
          ),

          ...item.topic
            .relatedSkills
            .map(normalizeKey),
        ]
      )
    );

  return [...interviewTopics]
    .sort(
      (a, b) =>
        scoreInterviewTopic(
          b,
          priorityTopicNames
        ) -
        scoreInterviewTopic(
          a,
          priorityTopicNames
        )
    )
    .slice(0, limit);
};

const scoreScenario = (
  scenario:
    ICareerKnowledgeScenario,
  priorityTopicNames:
    Set<string>
): number => {
  let score =
    LEVEL_WEIGHT[
      scenario.level
    ] *
    10;

  for (
    const skill
    of scenario.skillsTested
  ) {
    if (
      priorityTopicNames.has(
        normalizeKey(skill)
      )
    ) {
      score += 20;
    }
  }

  return score;
};

const selectPracticalScenarios = ({
  scenarios,
  priorityTopics,
  limit,
}: {
  scenarios:
    ICareerKnowledgeScenario[];

  priorityTopics:
    ICareerKnowledgeTopicMatch[];

  limit: number;
}): ICareerKnowledgeScenario[] => {
  const priorityTopicNames =
    new Set(
      priorityTopics.flatMap(
        (item) => [
          normalizeKey(
            item.topic.name
          ),

          ...item.topic
            .relatedSkills
            .map(normalizeKey),
        ]
      )
    );

  return [...scenarios]
    .sort(
      (a, b) =>
        scoreScenario(
          b,
          priorityTopicNames
        ) -
        scoreScenario(
          a,
          priorityTopicNames
        )
    )
    .slice(0, limit);
};

/* =========================================================
   MAIN CONTEXT BUILDER
========================================================= */

export const buildCareerKnowledgeContext =
  async ({
    targetRole,
    domain,
    userSkills = [],
    maxTopics =
      DEFAULT_MAX_TOPICS,
    maxPriorityTopics =
      DEFAULT_MAX_PRIORITY_TOPICS,
    maxInterviewTopics =
      DEFAULT_MAX_INTERVIEW_TOPICS,
    maxScenarios =
      DEFAULT_MAX_SCENARIOS,
    includeStrongTopics =
      false,
  }: IBuildCareerKnowledgeContextInput): Promise<ICareerKnowledgeContext> => {
    const normalizedRole =
      normalizeString(targetRole);

    if (!normalizedRole) {
      return {
        found: false,
        targetRole: "",
        topics: [],
        priorityTopics: [],
        strongTopics: [],
        interviewTopics: [],
        practicalScenarios: [],
        coreSkills: [],
        roleSkills: [],
        tools: [],
        knowledgeAreas: [],
        responsibilities: [],
        recommendedProjects: [],
        metadata: {
          totalRoleTopics: 0,
          evaluatedTopics: 0,
          priorityTopicCount: 0,
          strongTopicCount: 0,
          userSkillEvidenceCount:
            userSkills.length,
          selectedLevels: [],
        },
      };
    }

    const resolved =
      await resolveCareerKnowledgeRole({
        targetRole:
          normalizedRole,
        domain,
      });

    if (!resolved) {
      return {
        found: false,
        targetRole:
          normalizedRole,
        topics: [],
        priorityTopics: [],
        strongTopics: [],
        interviewTopics: [],
        practicalScenarios: [],
        coreSkills: [],
        roleSkills: [],
        tools: [],
        knowledgeAreas: [],
        responsibilities: [],
        recommendedProjects: [],
        metadata: {
          totalRoleTopics: 0,
          evaluatedTopics: 0,
          priorityTopicCount: 0,
          strongTopicCount: 0,
          userSkillEvidenceCount:
            userSkills.length,
          roleResolvedBy:
            undefined,
          selectedLevels: [],
        },
      };
    }

    const document =
      resolved.document;

    const role =
      document.role;

    const userSkillIndex =
      buildUserSkillIndex(
        userSkills
      );

    const evaluated =
      evaluateTopics({
        topics:
          role.topics || [],
        userSkillIndex,
      });

    const filtered =
      evaluated.filter(
        (item) =>
          shouldKeepTopic(
            item,
            includeStrongTopics
          )
      );

    const selectedTopics =
      sortTopicMatches(
        filtered
      )
        .slice(
          0,
          Math.max(
            1,
            maxTopics
          )
        );

    const priorityTopics =
      selectedTopics
        .filter(
          (item) =>
            item.status !==
            "strong"
        )
        .slice(
          0,
          Math.max(
            1,
            maxPriorityTopics
          )
        );

    const strongTopics =
      evaluated
        .filter(
          (item) =>
            item.status ===
            "strong"
        )
        .sort(
          (a, b) =>
            (
              b.readinessScore ??
              0
            ) -
            (
              a.readinessScore ??
              0
            )
        );

    const interviewTopics =
      selectInterviewTopics({
        interviewTopics:
          role.interviewTopics ||
          [],
        priorityTopics,
        limit:
          Math.max(
            0,
            maxInterviewTopics
          ),
      });

    const practicalScenarios =
      selectPracticalScenarios({
        scenarios:
          role.practicalScenarios ||
          [],
        priorityTopics,
        limit:
          Math.max(
            0,
            maxScenarios
          ),
      });

    const selectedLevels =
      Array.from(
        new Set(
          selectedTopics.map(
            (item) =>
              item.topic.level
          )
        )
      );

    console.log(
      "[Career Knowledge] Role context built:",
      {
        requestedRole:
          normalizedRole,
        resolvedRole:
          role.title,
        domain:
          document.domain,
        source:
          document.source,
        resolvedBy:
          resolved.resolvedBy,
        totalRoleTopics:
          role.topics.length,
        selectedTopics:
          selectedTopics.length,
        priorityTopics:
          priorityTopics.length,
        strongTopics:
          strongTopics.length,
        selectedLevels,
      }
    );

    return {
      found: true,

      targetRole:
        normalizedRole,

      resolvedRole: {
        slug:
          role.slug,
        title:
          role.title,
        domain:
          document.domain,
        source:
          document.source,
        description:
          role.description,
      },

      role,
      topics:
        selectedTopics,
      priorityTopics,
      strongTopics,
      interviewTopics,
      practicalScenarios,

      coreSkills:
        role.coreSkills || [],

      roleSkills:
        role.roleSkills || [],

      tools:
        role.tools || [],

      knowledgeAreas:
        role.knowledgeAreas || [],

      responsibilities:
        role.responsibilities || [],

      recommendedProjects:
        role.recommendedProjects || [],

      metadata: {
        totalRoleTopics:
          role.topics.length,
        evaluatedTopics:
          evaluated.length,
        priorityTopicCount:
          priorityTopics.length,
        strongTopicCount:
          strongTopics.length,
        userSkillEvidenceCount:
          userSkillIndex.size,
        roleResolvedBy:
          resolved.resolvedBy,
        selectedLevels,
      },
    };
  };

/* =========================================================
   CONVENIENCE HELPERS
========================================================= */

export const getCareerKnowledgePriorityTopics =
  async (
    input:
      IBuildCareerKnowledgeContextInput
  ): Promise<
    ICareerKnowledgeTopicMatch[]
  > => {
    const context =
      await buildCareerKnowledgeContext(
        input
      );

    return context
      .priorityTopics;
  };

export const getCareerKnowledgeInterviewContext =
  async (
    input:
      IBuildCareerKnowledgeContextInput
  ): Promise<{
    found: boolean;
    targetRole: string;
    interviewTopics:
      ICareerKnowledgeInterviewTopic[];
    practicalScenarios:
      ICareerKnowledgeScenario[];
    priorityTopics:
      ICareerKnowledgeTopicMatch[];
  }> => {
    const context =
      await buildCareerKnowledgeContext(
        input
      );

    return {
      found:
        context.found,
      targetRole:
        context.targetRole,
      interviewTopics:
        context.interviewTopics,
      practicalScenarios:
        context.practicalScenarios,
      priorityTopics:
        context.priorityTopics,
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  resolveCareerKnowledgeRole,
  buildCareerKnowledgeContext,
  getCareerKnowledgePriorityTopics,
  getCareerKnowledgeInterviewContext,
  getPreferredKnowledgeLevels,
};
