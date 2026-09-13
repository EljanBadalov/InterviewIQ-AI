import {
  Schema,
  model,
  models,
  type Document,
  type Model,
} from "mongoose";

/* =========================================================
   TYPES
========================================================= */

export type CareerKnowledgeDomain =
  | "technology"
  | "logistics"
  | "marketing"
  | "finance"
  | "healthcare"
  | "education"
  | "operations"
  | "sales"
  | "other";

export type CareerKnowledgeSource =
  | "roadmap_sh"
  | "esco"
  | "internal"
  | "manual"
  | "combined";

export type CareerKnowledgeLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "production"
  | "expert";

export type CareerKnowledgeImportance =
  | "critical"
  | "high"
  | "medium"
  | "low";

export type CareerKnowledgeTopicType =
  | "skill"
  | "knowledge"
  | "tool"
  | "process"
  | "concept"
  | "regulation"
  | "practice"
  | "soft_skill";

export type CareerKnowledgeInterviewType =
  | "technical"
  | "behavioral"
  | "scenario"
  | "case_study"
  | "role_specific";

export type CareerKnowledgeStatus =
  | "active"
  | "inactive"
  | "draft";

/* =========================================================
   TOPIC
========================================================= */

export interface ICareerKnowledgeTopic {
  id: string;

  name: string;

  normalizedName: string;

  type:
    CareerKnowledgeTopicType;

  category: string;

  description?: string;

  level:
    CareerKnowledgeLevel;

  importance:
    CareerKnowledgeImportance;

  prerequisites: string[];

  subtopics: string[];

  practicalScenarios:
    string[];

  expectedEvidence:
    string[];

  relatedTools: string[];

  relatedSkills: string[];

  sourceReference?: string;

  sourceMetadata?: Record<
    string,
    unknown
  >;

  metadata?: Record<
    string,
    unknown
  >;
}

/* =========================================================
   INTERVIEW TOPIC
========================================================= */

export interface ICareerKnowledgeInterviewTopic {
  id: string;

  title: string;

  type:
    CareerKnowledgeInterviewType;

  level:
    CareerKnowledgeLevel;

  description?: string;

  focusAreas: string[];

  exampleQuestions: string[];

  expectedSignals: string[];

  commonWeaknesses:
    string[];

  relatedSkills: string[];

  metadata?: Record<
    string,
    unknown
  >;
}

/* =========================================================
   PRACTICAL SCENARIO
========================================================= */

export interface ICareerKnowledgeScenario {
  id: string;

  title: string;

  description: string;

  level:
    CareerKnowledgeLevel;

  category: string;

  skillsTested: string[];

  expectedOutcome?: string;

  metadata?: Record<
    string,
    unknown
  >;
}

/* =========================================================
   ROLE
========================================================= */

export interface ICareerKnowledgeRole {
  slug: string;

  title: string;

  aliases: string[];

  description?: string;

  occupationCode?: string;

  experienceLevel?: string;

  topics:
    ICareerKnowledgeTopic[];

  interviewTopics:
    ICareerKnowledgeInterviewTopic[];

  practicalScenarios:
    ICareerKnowledgeScenario[];

  coreSkills: string[];

  roleSkills: string[];

  tools: string[];

  knowledgeAreas: string[];

  responsibilities: string[];

  recommendedProjects: string[];

  metadata?: Record<
    string,
    unknown
  >;
}

/* =========================================================
   CAREER KNOWLEDGE DOCUMENT
========================================================= */

export interface ICareerKnowledge
  extends Document {
  domain:
    CareerKnowledgeDomain;

  source:
    CareerKnowledgeSource;

  sourceVersion?: string;

  sourceUrl?: string;

  status:
    CareerKnowledgeStatus;

  role:
    ICareerKnowledgeRole;

  tags: string[];

  importedAt?: Date;

  lastSyncedAt?: Date;

  createdAt: Date;

  updatedAt: Date;
}

/* =========================================================
   HELPERS
========================================================= */

const normalizeString =
  (
    value:
      string
  ): string => {
    return value
      .trim()
      .replace(
        /\s+/g,
        " "
      );
  };

/* =========================================================
   TOPIC SCHEMA
========================================================= */

const careerKnowledgeTopicSchema =
  new Schema<ICareerKnowledgeTopic>(
    {
      id: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      name: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      normalizedName: {
        type:
          String,

        required:
          true,

        trim:
          true,

        lowercase:
          true,
      },

      type: {
        type:
          String,

        enum: [
          "skill",
          "knowledge",
          "tool",
          "process",
          "concept",
          "regulation",
          "practice",
          "soft_skill",
        ],

        required:
          true,
      },

      category: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      description: {
        type:
          String,

        trim:
          true,
      },

      level: {
        type:
          String,

        enum: [
          "beginner",
          "intermediate",
          "advanced",
          "production",
          "expert",
        ],

        default:
          "intermediate",
      },

      importance: {
        type:
          String,

        enum: [
          "critical",
          "high",
          "medium",
          "low",
        ],

        default:
          "medium",
      },

      prerequisites: {
        type: [
          String,
        ],

        default:
          [],
      },

      subtopics: {
        type: [
          String,
        ],

        default:
          [],
      },

      practicalScenarios: {
        type: [
          String,
        ],

        default:
          [],
      },

      expectedEvidence: {
        type: [
          String,
        ],

        default:
          [],
      },

      relatedTools: {
        type: [
          String,
        ],

        default:
          [],
      },

      relatedSkills: {
        type: [
          String,
        ],

        default:
          [],
      },

      sourceReference: {
        type:
          String,

        trim:
          true,
      },

      sourceMetadata: {
        type:
          Schema.Types.Mixed,

        default:
          undefined,
      },

      metadata: {
        type:
          Schema.Types.Mixed,

        default:
          undefined,
      },
    },
    {
      _id:
        false,
    }
  );

/* =========================================================
   INTERVIEW TOPIC SCHEMA
========================================================= */

const careerKnowledgeInterviewTopicSchema =
  new Schema<ICareerKnowledgeInterviewTopic>(
    {
      id: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      title: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      type: {
        type:
          String,

        enum: [
          "technical",
          "behavioral",
          "scenario",
          "case_study",
          "role_specific",
        ],

        required:
          true,
      },

      level: {
        type:
          String,

        enum: [
          "beginner",
          "intermediate",
          "advanced",
          "production",
          "expert",
        ],

        default:
          "intermediate",
      },

      description: {
        type:
          String,

        trim:
          true,
      },

      focusAreas: {
        type: [
          String,
        ],

        default:
          [],
      },

      exampleQuestions: {
        type: [
          String,
        ],

        default:
          [],
      },

      expectedSignals: {
        type: [
          String,
        ],

        default:
          [],
      },

      commonWeaknesses: {
        type: [
          String,
        ],

        default:
          [],
      },

      relatedSkills: {
        type: [
          String,
        ],

        default:
          [],
      },

      metadata: {
        type:
          Schema.Types.Mixed,

        default:
          undefined,
      },
    },
    {
      _id:
        false,
    }
  );

/* =========================================================
   PRACTICAL SCENARIO SCHEMA
========================================================= */

const careerKnowledgeScenarioSchema =
  new Schema<ICareerKnowledgeScenario>(
    {
      id: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      title: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      description: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      level: {
        type:
          String,

        enum: [
          "beginner",
          "intermediate",
          "advanced",
          "production",
          "expert",
        ],

        default:
          "intermediate",
      },

      category: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      skillsTested: {
        type: [
          String,
        ],

        default:
          [],
      },

      expectedOutcome: {
        type:
          String,

        trim:
          true,
      },

      metadata: {
        type:
          Schema.Types.Mixed,

        default:
          undefined,
      },
    },
    {
      _id:
        false,
    }
  );

/* =========================================================
   ROLE SCHEMA
========================================================= */

const careerKnowledgeRoleSchema =
  new Schema<ICareerKnowledgeRole>(
    {
      slug: {
        type:
          String,

        required:
          true,

        trim:
          true,

        lowercase:
          true,
      },

      title: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      aliases: {
        type: [
          String,
        ],

        default:
          [],
      },

      description: {
        type:
          String,

        trim:
          true,
      },

      occupationCode: {
        type:
          String,

        trim:
          true,
      },

      experienceLevel: {
        type:
          String,

        trim:
          true,
      },

      topics: {
        type: [
          careerKnowledgeTopicSchema,
        ],

        default:
          [],
      },

      interviewTopics: {
        type: [
          careerKnowledgeInterviewTopicSchema,
        ],

        default:
          [],
      },

      practicalScenarios: {
        type: [
          careerKnowledgeScenarioSchema,
        ],

        default:
          [],
      },

      coreSkills: {
        type: [
          String,
        ],

        default:
          [],
      },

      roleSkills: {
        type: [
          String,
        ],

        default:
          [],
      },

      tools: {
        type: [
          String,
        ],

        default:
          [],
      },

      knowledgeAreas: {
        type: [
          String,
        ],

        default:
          [],
      },

      responsibilities: {
        type: [
          String,
        ],

        default:
          [],
      },

      recommendedProjects: {
        type: [
          String,
        ],

        default:
          [],
      },

      metadata: {
        type:
          Schema.Types.Mixed,

        default:
          undefined,
      },
    },
    {
      _id:
        false,
    }
  );

/* =========================================================
   MAIN SCHEMA
========================================================= */

const careerKnowledgeSchema =
  new Schema<ICareerKnowledge>(
    {
      domain: {
        type:
          String,

        enum: [
          "technology",
          "logistics",
          "marketing",
          "finance",
          "healthcare",
          "education",
          "operations",
          "sales",
          "other",
        ],

        required:
          true,

        index:
          true,
      },

      source: {
        type:
          String,

        enum: [
          "roadmap_sh",
          "esco",
          "internal",
          "manual",
          "combined",
        ],

        required:
          true,

        index:
          true,
      },

      sourceVersion: {
        type:
          String,

        trim:
          true,
      },

      sourceUrl: {
        type:
          String,

        trim:
          true,
      },

      status: {
        type:
          String,

        enum: [
          "active",
          "inactive",
          "draft",
        ],

        default:
          "active",

        index:
          true,
      },

      role: {
        type:
          careerKnowledgeRoleSchema,

        required:
          true,
      },

      tags: {
        type: [
          String,
        ],

        default:
          [],
      },

      importedAt: {
        type:
          Date,
      },

      lastSyncedAt: {
        type:
          Date,
      },
    },
    {
      timestamps:
        true,
    }
  );

/* =========================================================
   NORMALIZATION
========================================================= */

careerKnowledgeSchema.pre(
  "validate",
  function () {
    if (this.role?.title) {
      this.role.title =
        normalizeString(
          this.role.title
        );
    }

    if (this.role?.slug) {
      this.role.slug =
        normalizeString(
          this.role.slug
        )
          .toLowerCase()
          .replace(
            /[^a-z0-9]+/g,
            "-"
          )
          .replace(
            /^-+|-+$/g,
            ""
          );
    }

    if (this.role?.topics) {
      for (
        const topic
        of this.role.topics
      ) {
        topic.name =
          normalizeString(
            topic.name
          );

        topic.normalizedName =
          topic.name
            .toLowerCase()
            .replace(
              /\s+/g,
              " "
            )
            .trim();
      }
    }
  }
);

/* =========================================================
   INDEXES
========================================================= */

careerKnowledgeSchema.index(
  {
    domain:
      1,

    "role.slug":
      1,

    status:
      1,
  },
  {
    unique:
      true,
  }
);

careerKnowledgeSchema.index({
  "role.title":
    "text",

  "role.aliases":
    "text",

  "role.coreSkills":
    "text",

  "role.roleSkills":
    "text",

  "role.topics.name":
    "text",

  "role.knowledgeAreas":
    "text",
});

careerKnowledgeSchema.index({
  "role.occupationCode":
    1,
});

careerKnowledgeSchema.index({
  "role.topics.level":
    1,

  "role.topics.importance":
    1,
});

/* =========================================================
   MODEL
========================================================= */

const CareerKnowledge:
  Model<ICareerKnowledge> =
    (
      models
        .CareerKnowledge as
        Model<ICareerKnowledge>
    ) ||
    model<ICareerKnowledge>(
      "CareerKnowledge",
      careerKnowledgeSchema
    );

export {
  CareerKnowledge,
};

export default CareerKnowledge;