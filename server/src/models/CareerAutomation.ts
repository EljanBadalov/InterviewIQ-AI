import {
  Schema,
  model,
  models,
  type Document,
  type Model,
  type Types,
} from "mongoose";

/* =========================================================
   TYPES
========================================================= */

export type CareerAutomationStatus =
  | "active"
  | "paused"
  | "completed"
  | "archived";

export type CareerRoadmapStatus =
  | "not_started"
  | "in_progress"
  | "completed";

/*
 * High-level roadmap sections.
 *
 * These categories are intentionally explicit so the frontend does not
 * have to infer whether a milestone belongs to skills, projects, CV,
 * interview preparation, or job-search execution from its title.
 */
export type CareerRoadmapCategory =
  | "CORE_SKILLS"
  | "ROLE_SKILLS"
  | "PROJECTS"
  | "CV"
  | "INTERVIEW"
  | "JOB_SEARCH";

/*
 * Where the evidence behind a personalized recommendation came from.
 *
 * Qwen will be used to explain and organize evidence, but it should not
 * invent the evidence itself. Keeping the source allows the UI and future
 * analytics to explain why a recommendation exists.
 */
export type CareerRoadmapInsightSource =
  | "resume"
  | "resume_analysis"
  | "job_market"
  | "interview"
  | "progress"
  | "career_profile"
  | "combined";

/*
 * We intentionally reuse the same three-level priority language used by
 * Career Automation tasks.
 */
export type CareerRoadmapPriority =
  | "high"
  | "medium"
  | "low";

export type CareerRoadmapGeneratedBy =
  | "qwen"
  | "fallback"
  | "system";

export type CareerTaskCategory =
  | "LEARNING"
  | "JOB_APPLICATION"
  | "CV"
  | "INTERVIEW"
  | "PORTFOLIO"
  | "CAREER";

export type CareerTaskPriority =
  | "high"
  | "medium"
  | "low";

export type CareerTaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped";

export type CareerTaskSource =
  | "roadmap"
  | "job_match"
  | "resume"
  | "interview"
  | "progress"
  | "system";

export type CareerWorkMode =
  | "remote"
  | "hybrid"
  | "onsite";

export type CareerEmploymentType =
  | "full_time"
  | "part_time"
  | "internship"
  | "contract"
  | "temporary";

export type CareerExperienceLevel =
  | "internship"
  | "entry"
  | "junior"
  | "mid"
  | "senior"
  | "lead";

/* =========================================================
   JOB SEARCH PREFERENCES
========================================================= */

export interface ICareerJobPreferences {
  enabled: boolean;

  targetRoles: string[];

  locations: string[];

  workModes: CareerWorkMode[];

  employmentTypes:
    CareerEmploymentType[];

  experienceLevels:
    CareerExperienceLevel[];

  minimumMatchScore: number;

  dailyApplicationTarget: number;

  notifyOnNewMatches: boolean;

  notificationMatchThreshold: number;
}

/* =========================================================
   ROADMAP RECOMMENDATION
========================================================= */

/*
 * One concrete, explainable recommendation shown inside a roadmap
 * milestone.
 *
 * Example:
 * - title: "Type-safe React Components"
 * - whyItMatters: explains the user's actual gap
 * - whatToLearn: precise topics, not generic "learn fundamentals"
 * - action: a practical next action
 * - proofOfCompletion: how the user can demonstrate completion
 */
export interface ICareerRoadmapRecommendation {
  title: string;

  whyItMatters: string;

  whatToLearn: string[];

  action: string;

  proofOfCompletion?: string;

  priority:
    CareerRoadmapPriority;

  source:
    CareerRoadmapInsightSource;

  /*
   * Optional evidence labels make it possible to preserve concrete
   * supporting signals such as:
   * - "missing in CV"
   * - "required by 3 matched jobs"
   * - "technical interview score: 64"
   *
   * These are not required for the first UI version, but keeping them
   * structured avoids losing useful provenance from the backend.
   */
  evidence?: string[];

  metadata?: Record<
    string,
    unknown
  >;
}

/* =========================================================
   ROADMAP MILESTONE
========================================================= */

export interface ICareerRoadmapMilestone {
  id: string;

  order: number;

  /*
   * Optional during the migration step so existing stored Career
   * Automation documents and the current roadmap builder remain valid.
   * The personalized roadmap generator added in the next step will
   * populate this field for every newly generated milestone.
   */
  category?:
    CareerRoadmapCategory;

  title: string;

  description: string;

  /*
   * Human-readable explanation of why this roadmap section exists for
   * this user.
   */
  reason?: string;

  /*
   * Readiness for this specific roadmap category, independent from the
   * overall Career Automation readiness score.
   */
  readinessScore?: number;

  status:
    CareerRoadmapStatus;

  targetDate?: Date;

  completedAt?: Date;

  relatedSkills: string[];

  /*
   * Detailed Qwen-personalized recommendations. Optional during the
   * migration so the current service can compile before it is upgraded.
   */
  recommendations?:
    ICareerRoadmapRecommendation[];

  generatedBy?:
    CareerRoadmapGeneratedBy;

  generatedAt?: Date;

  metadata?: Record<
    string,
    unknown
  >;
}

/* =========================================================
   DAILY TASK
========================================================= */

export interface ICareerAutomationTask {
  id: string;

  category:
    CareerTaskCategory;

  title: string;

  description: string;

  reason?: string;

  priority:
    CareerTaskPriority;

  status:
    CareerTaskStatus;

  source:
    CareerTaskSource;

  scheduledFor: Date;

  dueAt?: Date;

  estimatedMinutes?: number;

  relatedSkill?: string;

  relatedJobId?:
    Types.ObjectId;

  relatedResumeId?:
    Types.ObjectId;

  relatedInterviewId?:
    Types.ObjectId;

  roadmapMilestoneId?: string;

  externalUrl?: string;

  createdAt: Date;

  startedAt?: Date;

  completedAt?: Date;

  skippedAt?: Date;

  metadata?: Record<
    string,
    unknown
  >;
}

/* =========================================================
   JOB MATCH STATE
========================================================= */

export interface ICareerAutomationJobMatch {
  jobId:
    Types.ObjectId;

  matchScore: number;

  firstSeenAt: Date;

  lastSeenAt: Date;

  notificationSent: boolean;

  notificationSentAt?: Date;

  applicationTaskCreated: boolean;

  applicationTaskId?: string;
}

/* =========================================================
   AUTOMATION PROGRESS
========================================================= */

export interface ICareerAutomationProgress {
  totalTasks: number;

  completedTasks: number;

  skippedTasks: number;

  pendingTasks: number;

  completedLearningTasks: number;

  completedApplications: number;

  completedInterviews: number;

  completedCVTasks: number;

  completedPortfolioTasks: number;

  currentStreak: number;

  longestStreak: number;

  overallProgress: number;

  lastTaskCompletedAt?: Date;
}

/* =========================================================
   AUTOMATION SETTINGS
========================================================= */

export interface ICareerAutomationSettings {
  automationEnabled: boolean;

  dailyTasksEnabled: boolean;

  jobSearchEnabled: boolean;

  interviewPrepEnabled: boolean;

  learningTasksEnabled: boolean;

  cvTasksEnabled: boolean;

  portfolioTasksEnabled: boolean;

  automaticReplanningEnabled:
    boolean;

  maxDailyTasks: number;

  preferredDailyMinutes: number;

  timezone: string;
}

/* =========================================================
   CAREER AUTOMATION DOCUMENT
========================================================= */

export interface ICareerAutomation
  extends Document {
  userId:
    Types.ObjectId;

  status:
    CareerAutomationStatus;

  targetRole: string;

  careerGoal: string;

  targetDate?: Date;

  roadmapDurationDays: number;

  activeResumeId?:
    Types.ObjectId;

  activeInterviewId?:
    Types.ObjectId;

  currentReadinessScore?: number;

  jobPreferences:
    ICareerJobPreferences;

  settings:
    ICareerAutomationSettings;

  roadmap:
    ICareerRoadmapMilestone[];

  tasks:
    ICareerAutomationTask[];

  jobMatches:
    ICareerAutomationJobMatch[];

  progress:
    ICareerAutomationProgress;

  lastDailyPlanGeneratedAt?: Date;

  nextDailyPlanAt?: Date;

  lastJobSearchAt?: Date;

  nextJobSearchAt?: Date;

  lastReplannedAt?: Date;

  lastProgressCalculatedAt?: Date;

  createdAt: Date;

  updatedAt: Date;
}

/* =========================================================
   SUB-SCHEMAS
========================================================= */

const careerJobPreferencesSchema =
  new Schema<ICareerJobPreferences>(
    {
      enabled: {
        type:
          Boolean,

        default:
          true,
      },

      targetRoles: {
        type: [
          String,
        ],

        default:
          [],
      },

      locations: {
        type: [
          String,
        ],

        default:
          [],
      },

      workModes: {
        type: [
          String,
        ],

        enum: [
          "remote",
          "hybrid",
          "onsite",
        ],

        default:
          [],
      },

      employmentTypes: {
        type: [
          String,
        ],

        enum: [
          "full_time",
          "part_time",
          "internship",
          "contract",
          "temporary",
        ],

        default:
          [],
      },

      experienceLevels: {
        type: [
          String,
        ],

        enum: [
          "internship",
          "entry",
          "junior",
          "mid",
          "senior",
          "lead",
        ],

        default:
          [],
      },

      minimumMatchScore: {
        type:
          Number,

        min:
          0,

        max:
          100,

        default:
          65,
      },

      dailyApplicationTarget: {
        type:
          Number,

        min:
          0,

        max:
          50,

        default:
          3,
      },

      notifyOnNewMatches: {
        type:
          Boolean,

        default:
          true,
      },

      notificationMatchThreshold: {
        type:
          Number,

        min:
          0,

        max:
          100,

        default:
          75,
      },
    },
    {
      _id:
        false,
    }
  );

/* =========================================================
   ROADMAP RECOMMENDATION SCHEMA
========================================================= */

const careerRoadmapRecommendationSchema =
  new Schema<ICareerRoadmapRecommendation>(
    {
      title: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      whyItMatters: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      whatToLearn: {
        type: [
          String,
        ],

        default:
          [],
      },

      action: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      proofOfCompletion: {
        type:
          String,

        trim:
          true,
      },

      priority: {
        type:
          String,

        enum: [
          "high",
          "medium",
          "low",
        ],

        default:
          "medium",
      },

      source: {
        type:
          String,

        enum: [
          "resume",
          "resume_analysis",
          "job_market",
          "interview",
          "progress",
          "career_profile",
          "combined",
        ],

        default:
          "combined",
      },

      evidence: {
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
   ROADMAP MILESTONE SCHEMA
========================================================= */

const careerRoadmapMilestoneSchema =
  new Schema<ICareerRoadmapMilestone>(
    {
      id: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      order: {
        type:
          Number,

        required:
          true,

        min:
          1,
      },

      /*
       * Not required during migration so old CareerAutomation documents
       * can still be read without modification.
       */
      category: {
        type:
          String,

        enum: [
          "CORE_SKILLS",
          "ROLE_SKILLS",
          "PROJECTS",
          "CV",
          "INTERVIEW",
          "JOB_SEARCH",
        ],

        default:
          undefined,
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

      reason: {
        type:
          String,

        trim:
          true,

        default:
          undefined,
      },

      readinessScore: {
        type:
          Number,

        min:
          0,

        max:
          100,

        default:
          undefined,
      },

      status: {
        type:
          String,

        enum: [
          "not_started",
          "in_progress",
          "completed",
        ],

        default:
          "not_started",
      },

      targetDate: {
        type:
          Date,
      },

      completedAt: {
        type:
          Date,
      },

      relatedSkills: {
        type: [
          String,
        ],

        default:
          [],
      },

      recommendations: {
        type: [
          careerRoadmapRecommendationSchema,
        ],

        default:
          [],
      },

      generatedBy: {
        type:
          String,

        enum: [
          "qwen",
          "fallback",
          "system",
        ],

        default:
          undefined,
      },

      generatedAt: {
        type:
          Date,

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
   DAILY TASK SCHEMA
========================================================= */

const careerAutomationTaskSchema =
  new Schema<ICareerAutomationTask>(
    {
      id: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      category: {
        type:
          String,

        enum: [
          "LEARNING",
          "JOB_APPLICATION",
          "CV",
          "INTERVIEW",
          "PORTFOLIO",
          "CAREER",
        ],

        required:
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

      reason: {
        type:
          String,

        trim:
          true,
      },

      priority: {
        type:
          String,

        enum: [
          "high",
          "medium",
          "low",
        ],

        default:
          "medium",
      },

      status: {
        type:
          String,

        enum: [
          "pending",
          "in_progress",
          "completed",
          "skipped",
        ],

        default:
          "pending",
      },

      source: {
        type:
          String,

        enum: [
          "roadmap",
          "job_match",
          "resume",
          "interview",
          "progress",
          "system",
        ],

        default:
          "system",
      },

      scheduledFor: {
        type:
          Date,

        required:
          true,
      },

      dueAt: {
        type:
          Date,
      },

      estimatedMinutes: {
        type:
          Number,

        min:
          0,

        max:
          1440,
      },

      relatedSkill: {
        type:
          String,

        trim:
          true,
      },

      relatedJobId: {
        type:
          Schema.Types.ObjectId,

        ref:
          "Job",
      },

      relatedResumeId: {
        type:
          Schema.Types.ObjectId,

        ref:
          "ResumeAnalysis",
      },

      relatedInterviewId: {
        type:
          Schema.Types.ObjectId,

        ref:
          "Interview",
      },

      roadmapMilestoneId: {
        type:
          String,

        trim:
          true,
      },

      externalUrl: {
        type:
          String,

        trim:
          true,
      },

      createdAt: {
        type:
          Date,

        default:
          Date.now,
      },

      startedAt: {
        type:
          Date,
      },

      completedAt: {
        type:
          Date,
      },

      skippedAt: {
        type:
          Date,
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
   JOB MATCH SCHEMA
========================================================= */

const careerAutomationJobMatchSchema =
  new Schema<ICareerAutomationJobMatch>(
    {
      jobId: {
        type:
          Schema.Types.ObjectId,

        ref:
          "Job",

        required:
          true,
      },

      matchScore: {
        type:
          Number,

        min:
          0,

        max:
          100,

        required:
          true,
      },

      firstSeenAt: {
        type:
          Date,

        default:
          Date.now,

        required:
          true,
      },

      lastSeenAt: {
        type:
          Date,

        default:
          Date.now,

        required:
          true,
      },

      notificationSent: {
        type:
          Boolean,

        default:
          false,
      },

      notificationSentAt: {
        type:
          Date,
      },

      applicationTaskCreated: {
        type:
          Boolean,

        default:
          false,
      },

      applicationTaskId: {
        type:
          String,

        trim:
          true,
      },
    },
    {
      _id:
        false,
    }
  );

/* =========================================================
   PROGRESS SCHEMA
========================================================= */

const careerAutomationProgressSchema =
  new Schema<ICareerAutomationProgress>(
    {
      totalTasks: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },

      completedTasks: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },

      skippedTasks: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },

      pendingTasks: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },

      completedLearningTasks: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },

      completedApplications: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },

      completedInterviews: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },

      completedCVTasks: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },

      completedPortfolioTasks: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },

      currentStreak: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },

      longestStreak: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },

      overallProgress: {
        type:
          Number,

        default:
          0,

        min:
          0,

        max:
          100,
      },

      lastTaskCompletedAt: {
        type:
          Date,
      },
    },
    {
      _id:
        false,
    }
  );

/* =========================================================
   SETTINGS SCHEMA
========================================================= */

const careerAutomationSettingsSchema =
  new Schema<ICareerAutomationSettings>(
    {
      automationEnabled: {
        type:
          Boolean,

        default:
          true,
      },

      dailyTasksEnabled: {
        type:
          Boolean,

        default:
          true,
      },

      jobSearchEnabled: {
        type:
          Boolean,

        default:
          true,
      },

      interviewPrepEnabled: {
        type:
          Boolean,

        default:
          true,
      },

      learningTasksEnabled: {
        type:
          Boolean,

        default:
          true,
      },

      cvTasksEnabled: {
        type:
          Boolean,

        default:
          true,
      },

      portfolioTasksEnabled: {
        type:
          Boolean,

        default:
          true,
      },

      automaticReplanningEnabled: {
        type:
          Boolean,

        default:
          true,
      },

      maxDailyTasks: {
        type:
          Number,

        min:
          1,

        max:
          20,

        default:
          5,
      },

      preferredDailyMinutes: {
        type:
          Number,

        min:
          10,

        max:
          1440,

        default:
          90,
      },

      timezone: {
        type:
          String,

        trim:
          true,

        default:
          "UTC",
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

const careerAutomationSchema =
  new Schema<ICareerAutomation>(
    {
      userId: {
        type:
          Schema.Types.ObjectId,

        ref:
          "User",

        required:
          true,

        unique:
          true,

        index:
          true,
      },

      status: {
        type:
          String,

        enum: [
          "active",
          "paused",
          "completed",
          "archived",
        ],

        default:
          "active",

        index:
          true,
      },

      targetRole: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      careerGoal: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      targetDate: {
        type:
          Date,
      },

      roadmapDurationDays: {
        type:
          Number,

        min:
          1,

        max:
          730,

        default:
          90,
      },

      activeResumeId: {
        type:
          Schema.Types.ObjectId,

        ref:
          "ResumeAnalysis",
      },

      activeInterviewId: {
        type:
          Schema.Types.ObjectId,

        ref:
          "Interview",
      },

      currentReadinessScore: {
        type:
          Number,

        min:
          0,

        max:
          100,
      },

      jobPreferences: {
        type:
          careerJobPreferencesSchema,

        default:
          () => ({}),
      },

      settings: {
        type:
          careerAutomationSettingsSchema,

        default:
          () => ({}),
      },

      roadmap: {
        type: [
          careerRoadmapMilestoneSchema,
        ],

        default:
          [],
      },

      tasks: {
        type: [
          careerAutomationTaskSchema,
        ],

        default:
          [],
      },

      jobMatches: {
        type: [
          careerAutomationJobMatchSchema,
        ],

        default:
          [],
      },

      progress: {
        type:
          careerAutomationProgressSchema,

        default:
          () => ({}),
      },

      lastDailyPlanGeneratedAt: {
        type:
          Date,
      },

      nextDailyPlanAt: {
        type:
          Date,

        index:
          true,
      },

      lastJobSearchAt: {
        type:
          Date,
      },

      nextJobSearchAt: {
        type:
          Date,

        index:
          true,
      },

      lastReplannedAt: {
        type:
          Date,
      },

      lastProgressCalculatedAt: {
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
   INDEXES
========================================================= */

careerAutomationSchema.index({
  status:
    1,

  nextDailyPlanAt:
    1,
});

careerAutomationSchema.index({
  status:
    1,

  nextJobSearchAt:
    1,
});

careerAutomationSchema.index({
  "tasks.scheduledFor":
    1,

  "tasks.status":
    1,
});

/* =========================================================
   MODEL
========================================================= */

const CareerAutomation:
  Model<ICareerAutomation> =
    (
      models
        .CareerAutomation as
        Model<ICareerAutomation>
    ) ||
    model<ICareerAutomation>(
      "CareerAutomation",
      careerAutomationSchema
    );

export {
  CareerAutomation,
};

export default CareerAutomation;