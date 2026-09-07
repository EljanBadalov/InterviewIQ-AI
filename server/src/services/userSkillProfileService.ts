import {
  Types,
  type HydratedDocument,
} from "mongoose";

import {
  UserSkillProfile,
  type IUserSkillProfile,
  type SkillEvidenceSource,
  type SkillLevel,
} from "../models/UserSkillProfile";

type UserSkillProfileDocument =
  HydratedDocument<IUserSkillProfile>;

interface AddSkillEvidenceParams {
  userId:
    | Types.ObjectId
    | string;

  skillName: string;

  source:
    SkillEvidenceSource;

  sourceId?:
    | Types.ObjectId
    | string;

  score?: number;

  note?: string;
}

interface AddMultipleSkillEvidenceParams {
  userId:
    | Types.ObjectId
    | string;

  skills: Array<{
    skillName: string;

    source:
      SkillEvidenceSource;

    sourceId?:
      | Types.ObjectId
      | string;

    score?: number;

    note?: string;
  }>;
}

export interface IValidatedUserSkill {
  name: string;

  normalizedName: string;

  confidence: number;

  level: SkillLevel;

  averageScore: number;

  evidenceCount: number;

  sources:
    SkillEvidenceSource[];
}

const normalizeSkillName = (
  value: string
): string => {
  const normalized =
    value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const aliases: Record<
    string,
    string
  > = {
    js: "javascript",
    javascript:
      "javascript",

    ts: "typescript",
    typescript:
      "typescript",

    reactjs: "react",
    "react.js": "react",
    react: "react",

    node: "node.js",
    nodejs: "node.js",
    "node.js": "node.js",

    expressjs: "express",
    "express.js": "express",
    express: "express",

    mongo: "mongodb",
    mongodb: "mongodb",

    postgres: "postgresql",
    postgresql: "postgresql",

    html5: "html",
    html: "html",

    css3: "css",
    css: "css",

    k8s: "kubernetes",
    kubernetes:
      "kubernetes",

    rest: "rest api",
    restful: "rest api",
    api: "rest api",
    "rest api": "rest api",
    "restful api":
      "rest api",

    aws: "aws",
    "amazon web services":
      "aws",

    gcp: "gcp",
    "google cloud":
      "gcp",
    "google cloud platform":
      "gcp",

    cicd: "ci/cd",
    "ci cd": "ci/cd",
    "ci/cd": "ci/cd",

    ml:
      "machine learning",
    "machine learning":
      "machine learning",

    ai:
      "artificial intelligence",
    "artificial intelligence":
      "artificial intelligence",

    sklearn:
      "scikit-learn",
    "scikit learn":
      "scikit-learn",
    "scikit-learn":
      "scikit-learn",
  };

  return (
    aliases[normalized] ||
    normalized
  );
};

const getDisplaySkillName = (
  normalizedName: string
): string => {
  const displayNames: Record<
    string,
    string
  > = {
    javascript:
      "JavaScript",

    typescript:
      "TypeScript",

    react:
      "React",

    "node.js":
      "Node.js",

    express:
      "Express",

    mongodb:
      "MongoDB",

    postgresql:
      "PostgreSQL",

    html:
      "HTML",

    css:
      "CSS",

    kubernetes:
      "Kubernetes",

    "rest api":
      "REST API",

    aws:
      "AWS",

    gcp:
      "GCP",

    "ci/cd":
      "CI/CD",

    "machine learning":
      "Machine Learning",

    "artificial intelligence":
      "Artificial Intelligence",

    "scikit-learn":
      "Scikit-learn",

    docker:
      "Docker",

    git:
      "Git",

    graphql:
      "GraphQL",

    redux:
      "Redux",

    python:
      "Python",

    pandas:
      "Pandas",

    numpy:
      "NumPy",

    pytorch:
      "PyTorch",

    tensorflow:
      "TensorFlow",

    redis:
      "Redis",

    linux:
      "Linux",

    terraform:
      "Terraform",
  };

  if (
    displayNames[
      normalizedName
    ]
  ) {
    return displayNames[
      normalizedName
    ];
  }

  return normalizedName
    .split(" ")
    .map(
      (word) =>
        word
          .charAt(0)
          .toUpperCase() +
        word.slice(1)
    )
    .join(" ");
};

const clampScore = (
  score?: number
): number | undefined => {
  if (
    typeof score !==
      "number" ||
    Number.isNaN(
      score
    )
  ) {
    return undefined;
  }

  return Math.max(
    0,
    Math.min(
      100,
      score
    )
  );
};

const calculateAverageScore = (
  scores: number[]
): number => {
  if (
    scores.length ===
    0
  ) {
    return 0;
  }

  const total =
    scores.reduce(
      (
        sum,
        score
      ) =>
        sum + score,
      0
    );

  return Math.round(
    total /
      scores.length
  );
};

const calculateConfidence = (
  evidenceCount: number,
  averageScore: number,
  sourceCount: number
): number => {
  const evidenceWeight =
    Math.min(
      evidenceCount /
        10,
      1
    );

  const scoreWeight =
    averageScore /
    100;

  const sourceWeight =
    Math.min(
      sourceCount /
        3,
      1
    );

  const confidence =
    evidenceWeight *
      0.45 +
    scoreWeight *
      0.4 +
    sourceWeight *
      0.15;

  return Number(
    Math.max(
      0,
      Math.min(
        1,
        confidence
      )
    ).toFixed(2)
  );
};

const calculateSkillLevel = (
  averageScore: number,
  confidence: number,
  evidenceCount: number
): SkillLevel => {
  if (
    evidenceCount >= 8 &&
    averageScore >= 90 &&
    confidence >= 0.85
  ) {
    return "expert";
  }

  if (
    evidenceCount >= 5 &&
    averageScore >= 75 &&
    confidence >= 0.65
  ) {
    return "advanced";
  }

  if (
    evidenceCount >= 3 &&
    averageScore >= 55 &&
    confidence >= 0.4
  ) {
    return "intermediate";
  }

  return "beginner";
};

const toObjectId = (
  value:
    | Types.ObjectId
    | string
): Types.ObjectId => {
  if (
    value instanceof
    Types.ObjectId
  ) {
    return value;
  }

  if (
    !Types.ObjectId.isValid(
      value
    )
  ) {
    throw new Error(
      "Invalid ObjectId"
    );
  }

  return new Types.ObjectId(
    value
  );
};

const recalculateSkill = (
  skill:
    UserSkillProfileDocument["skills"][number]
): void => {
  skill.evidenceCount =
    skill.evidence.length;

  skill.sources = [
    ...new Set(
      skill.evidence.map(
        (evidence) =>
          evidence.source
      )
    ),
  ];

  const scores =
    skill.evidence
      .map(
        (evidence) =>
          evidence.score
      )
      .filter(
        (
          value
        ): value is number =>
          typeof value ===
          "number"
      );

  skill.averageScore =
    calculateAverageScore(
      scores
    );

  skill.confidence =
    calculateConfidence(
      skill.evidenceCount,
      skill.averageScore,
      skill.sources.length
    );

  skill.level =
    calculateSkillLevel(
      skill.averageScore,
      skill.confidence,
      skill.evidenceCount
    );

  skill.lastEvaluatedAt =
    new Date();
};

const recalculateProfile = (
  profile:
    UserSkillProfileDocument
): void => {
  profile.totalEvidenceCount =
    profile.skills.reduce(
      (
        total,
        skill
      ) =>
        total +
        skill.evidenceCount,
      0
    );
};

const getOrCreateProfile =
  async (
    userId:
      | Types.ObjectId
      | string
  ): Promise<UserSkillProfileDocument> => {
    const userObjectId =
      toObjectId(
        userId
      );

    const existingProfile =
      await UserSkillProfile.findOne({
        user:
          userObjectId,
      });

    if (
      existingProfile
    ) {
      return existingProfile;
    }

    const profile =
      await UserSkillProfile.create({
        user:
          userObjectId,

        skills: [],

        totalEvidenceCount:
          0,
      });

    return profile;
  };

export const addSkillEvidence =
  async ({
    userId,
    skillName,
    source,
    sourceId,
    score,
    note,
  }: AddSkillEvidenceParams): Promise<UserSkillProfileDocument> => {
    const profile =
      await getOrCreateProfile(
        userId
      );

    const normalizedName =
      normalizeSkillName(
        skillName
      );

    if (
      !normalizedName
    ) {
      throw new Error(
        "Skill name is required"
      );
    }

    const normalizedScore =
      clampScore(
        score
      );

    const sourceObjectId =
      sourceId
        ? toObjectId(
            sourceId
          )
        : undefined;

    let skill =
      profile.skills.find(
        (item) =>
          item.normalizedName ===
          normalizedName
      );

    if (!skill) {
      profile.skills.push({
        name:
          getDisplaySkillName(
            normalizedName
          ),

        normalizedName,

        confidence:
          0,

        level:
          "beginner",

        evidenceCount:
          0,

        averageScore:
          0,

        sources:
          [],

        evidence:
          [],

        lastEvaluatedAt:
          new Date(),
      });

      skill =
        profile.skills[
          profile.skills.length -
            1
        ];
    }

    const duplicateEvidence =
      sourceObjectId
        ? skill.evidence.some(
            (evidence) =>
              evidence.source ===
                source &&
              evidence.sourceId
                ?.toString() ===
                sourceObjectId.toString()
          )
        : false;

    if (
      duplicateEvidence
    ) {
      return profile;
    }

    skill.evidence.push({
      source,

      sourceId:
        sourceObjectId,

      score:
        normalizedScore,

      note:
        note?.trim(),

      recordedAt:
        new Date(),
    });

    recalculateSkill(
      skill
    );

    recalculateProfile(
      profile
    );

    profile.markModified(
      "skills"
    );

    await profile.save();

    return profile;
  };

export const addMultipleSkillEvidence =
  async ({
    userId,
    skills,
  }: AddMultipleSkillEvidenceParams): Promise<UserSkillProfileDocument> => {
    for (
      const skill
      of skills
    ) {
      await addSkillEvidence({
        userId,

        skillName:
          skill.skillName,

        source:
          skill.source,

        sourceId:
          skill.sourceId,

        score:
          skill.score,

        note:
          skill.note,
      });
    }

    return getOrCreateProfile(
      userId
    );
  };

export const getUserSkillProfile =
  async (
    userId:
      | Types.ObjectId
      | string
  ): Promise<UserSkillProfileDocument | null> => {
    return UserSkillProfile.findOne({
      user:
        toObjectId(
          userId
        ),
    });
  };

export const getValidatedUserSkills =
  async (
    userId:
      | Types.ObjectId
      | string
  ): Promise<IValidatedUserSkill[]> => {
    const profile =
      await getUserSkillProfile(
        userId
      );

    if (!profile) {
      return [];
    }

    /*
      IMPORTANT:
      A skill may be trusted for CV generation when:

      1. It has non-interview evidence such as:
         - resume
         - manual
         - project
         - quiz
         - mock-interview

      OR

      2. It is verified by technical interview evidence:
         - one technical answer >= 90
         OR
         - at least two technical answers with average >= 80

      Generic interview/category labels are never returned as CV skills.
    */

    const ignoredCvSkillNames =
      new Set<string>([
        "",
        "frontend",
        "front-end",
        "frontend development",
        "frontend-development",
        "backend",
        "back-end",
        "backend development",
        "backend-development",
        "software engineering",
        "software-engineering",
        "software development",
        "software-development",
        "devops",
        "dev-ops",
        "ui ux design",
        "ui/ux",
        "ui/ux design",
        "ui-ux-design",
        "machine-learning category",
        "technical",
        "behavioral",
        "interview",
        "question",
        "general",
        "programming",
        "coding",
        "development",
        "developer",
        "engineering",
        "technology",
        "computer science",
        "computer-science",
        "web development",
        "web-development",
        "web",
        "application",
        "applications",
        "system",
        "systems",
        "concept",
        "concepts",
        "fundamentals",
        "basics",
        "best practices",
        "best-practices",
        "problem solving",
        "problem-solving",
      ]);

    const isIgnoredCvSkill = (
      value: string
    ): boolean => {
      const normalized =
        normalizeSkillName(
          value
        );

      return ignoredCvSkillNames.has(
        normalized
      );
    };

    const getTechnicalInterviewScores = (
      skill: UserSkillProfileDocument["skills"][number]
    ): number[] => {
      return skill.evidence
        .filter(
          (evidence) =>
            evidence.source ===
              "technical-question" &&
            typeof evidence.score ===
              "number"
        )
        .map(
          (evidence) =>
            evidence.score as number
        );
    };

    const isInterviewVerified = (
      skill: UserSkillProfileDocument["skills"][number]
    ): boolean => {
      const scores =
        getTechnicalInterviewScores(
          skill
        );

      if (scores.length === 0) {
        return false;
      }

      const average =
        calculateAverageScore(
          scores
        );

      const hasStrongSingleEvidence =
        scores.some(
          (score) =>
            score >= 90
        );

      const hasRepeatedEvidence =
        scores.length >= 2 &&
        average >= 80;

      return (
        hasStrongSingleEvidence ||
        hasRepeatedEvidence
      );
    };

    const hasTrustedNonInterviewEvidence = (
      skill: UserSkillProfileDocument["skills"][number]
    ): boolean => {
      return skill.evidence.some(
        (evidence) =>
          evidence.source !==
            "technical-question"
      );
    };

    return profile.skills
      .filter(
        (skill) =>
          !isIgnoredCvSkill(
            skill.normalizedName
          ) &&
          !isIgnoredCvSkill(
            skill.name
          )
      )
      .filter(
        (skill) =>
          hasTrustedNonInterviewEvidence(
            skill
          ) ||
          isInterviewVerified(
            skill
          )
      )
      .sort(
        (
          a,
          b
        ) => {
          const aInterviewVerified =
            isInterviewVerified(
              a
            );

          const bInterviewVerified =
            isInterviewVerified(
              b
            );

          if (
            aInterviewVerified !==
            bInterviewVerified
          ) {
            return bInterviewVerified
              ? 1
              : -1;
          }

          if (
            b.averageScore !==
            a.averageScore
          ) {
            return (
              b.averageScore -
              a.averageScore
            );
          }

          if (
            b.confidence !==
            a.confidence
          ) {
            return (
              b.confidence -
              a.confidence
            );
          }

          return (
            b.evidenceCount -
            a.evidenceCount
          );
        }
      )
      .map(
        (skill) => ({
          name:
            skill.name,

          normalizedName:
            skill.normalizedName,

          confidence:
            skill.confidence,

          level:
            skill.level,

          averageScore:
            skill.averageScore,

          evidenceCount:
            skill.evidenceCount,

          sources:
            [...skill.sources],
        })
      );
  };

export const getStrongestUserSkills =
  async (
    userId:
      | Types.ObjectId
      | string,
    limit = 10
  ): Promise<IValidatedUserSkill[]> => {
    const validatedSkills =
      await getValidatedUserSkills(
        userId
      );

    return validatedSkills.slice(
      0,
      Math.max(
        0,
        limit
      )
    );
  };

export const removeSkillEvidence =
  async (
    userId:
      | Types.ObjectId
      | string,
    skillName: string,
    source:
      SkillEvidenceSource,
    sourceId:
      | Types.ObjectId
      | string
  ): Promise<UserSkillProfileDocument | null> => {
    const profile =
      await UserSkillProfile.findOne({
        user:
          toObjectId(
            userId
          ),
      });

    if (!profile) {
      return null;
    }

    const normalizedName =
      normalizeSkillName(
        skillName
      );

    const sourceObjectId =
      toObjectId(
        sourceId
      );

    const skill =
      profile.skills.find(
        (item) =>
          item.normalizedName ===
          normalizedName
      );

    if (!skill) {
      return profile;
    }

    skill.evidence =
      skill.evidence.filter(
        (evidence) =>
          !(
            evidence.source ===
              source &&
            evidence.sourceId
              ?.toString() ===
              sourceObjectId.toString()
          )
      ) as typeof skill.evidence;

    if (
      skill.evidence.length ===
      0
    ) {
      profile.skills =
        profile.skills.filter(
          (item) =>
            item.normalizedName !==
            normalizedName
        ) as typeof profile.skills;
    } else {
      recalculateSkill(
        skill
      );
    }

    recalculateProfile(
      profile
    );

    profile.markModified(
      "skills"
    );

    await profile.save();

    return profile;
  };

export const clearUserSkillProfile =
  async (
    userId:
      | Types.ObjectId
      | string
  ): Promise<boolean> => {
    const result =
      await UserSkillProfile.deleteOne({
        user:
          toObjectId(
            userId
          ),
      });

    return (
      result.deletedCount >
      0
    );
  };