import axios from "axios";

import apiClient from "./apiClient";

/* =========================================================
   TYPES
========================================================= */

export type CareerAutomationStatus =
  | "active"
  | "paused"
  | "completed"
  | "archived";

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
    | "roadmap"
    | "job_match"
    | "resume"
    | "interview"
    | "progress"
    | "system";

  scheduledFor: string;

  dueAt?: string;

  estimatedMinutes?: number;

  relatedSkill?: string;

  relatedJobId?: string;

  relatedResumeId?: string;

  relatedInterviewId?: string;

  roadmapMilestoneId?: string;

  externalUrl?: string;

  createdAt: string;

  startedAt?: string;

  completedAt?: string;

  skippedAt?: string;

  metadata?: Record<
    string,
    unknown
  >;
}

export type CareerRoadmapRecommendationPriority =
  | "high"
  | "medium"
  | "low";

export type CareerRoadmapRecommendationSource =
  | "career_profile"
  | "resume_analysis"
  | "job_market"
  | "interview"
  | "combined"
  | "career_knowledge"
  | "qwen"
  | "fallback"
  | "system"
  | string;

export interface ICareerRoadmapRecommendation {
  title: string;

  whyItMatters?: string;

  whatToLearn: string[];

  action?: string;

  proofOfCompletion?: string;

  priority?:
    CareerRoadmapRecommendationPriority;

  source?:
    CareerRoadmapRecommendationSource;

  evidence?: string[];

  metadata?: Record<
    string,
    unknown
  >;
}

export interface ICareerRoadmapMilestone {
  id: string;

  order: number;

  title: string;

  description: string;

  reason?: string;

  category?: string;

  status:
    | "not_started"
    | "pending"
    | "in_progress"
    | "completed"
    | "skipped";

  targetDate?: string;

  completedAt?: string;

  readinessScore?: number;

  relatedSkills: string[];

  recommendations?:
    ICareerRoadmapRecommendation[];

  source?:
    CareerRoadmapRecommendationSource;

  generatedBy?:
    | "qwen"
    | "fallback"
    | "system"
    | string;

  generatedAt?: string;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface ICareerJobPreferences {
  enabled: boolean;

  targetRoles: string[];

  locations: string[];

  workModes:
    Array<
      | "remote"
      | "hybrid"
      | "onsite"
    >;

  employmentTypes:
    Array<
      | "full_time"
      | "part_time"
      | "internship"
      | "contract"
      | "temporary"
    >;

  experienceLevels:
    Array<
      | "internship"
      | "entry"
      | "junior"
      | "mid"
      | "senior"
      | "lead"
    >;

  minimumMatchScore: number;

  dailyApplicationTarget: number;

  notifyOnNewMatches: boolean;

  notificationMatchThreshold: number;
}

export interface ICareerAutomationSettings {
  automationEnabled: boolean;

  dailyTasksEnabled: boolean;

  jobSearchEnabled: boolean;

  interviewPrepEnabled: boolean;

  learningTasksEnabled: boolean;

  cvTasksEnabled: boolean;

  portfolioTasksEnabled: boolean;

  automaticReplanningEnabled: boolean;

  maxDailyTasks: number;

  preferredDailyMinutes: number;

  timezone: string;
}

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

  lastTaskCompletedAt?: string;
}

export interface ICareerAutomation {
  _id: string;

  userId: string;

  status:
    CareerAutomationStatus;

  targetRole: string;

  careerGoal: string;

  targetDate?: string;

  roadmapDurationDays: number;

  activeResumeId?: string;

  activeInterviewId?: string;

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
    Array<{
      jobId: string;

      matchScore: number;

      firstSeenAt: string;

      lastSeenAt: string;

      notificationSent: boolean;

      notificationSentAt?: string;

      applicationTaskCreated: boolean;

      applicationTaskId?: string;
    }>;

  progress:
    ICareerAutomationProgress;

  lastDailyPlanGeneratedAt?: string;

  nextDailyPlanAt?: string;

  lastJobSearchAt?: string;

  nextJobSearchAt?: string;

  lastReplannedAt?: string;

  lastProgressCalculatedAt?: string;

  createdAt: string;

  updatedAt: string;
}

export interface ICareerAutomationSummary {
  id: string;

  status:
    CareerAutomationStatus;

  targetRole: string;

  careerGoal: string;

  roadmapDurationDays: number;

  currentReadinessScore?: number;

  roadmap: {
    total: number;

    completed: number;

    inProgress: number;

    notStarted: number;
  };

  tasks: {
    total: number;

    completed: number;

    pending: number;

    inProgress: number;

    skipped: number;
  };

  today: {
    date: string;

    tasks:
      ICareerAutomationTask[];

    total: number;

    completed: number;
  };

  progress:
    ICareerAutomationProgress;

  nextDailyPlanAt?: string;

  nextJobSearchAt?: string;
}

export interface ICareerFieldOption {
  slug: string;

  name: string;

  category: string;

  description: string;
}

export interface ICareerFieldsResponse {
  fields:
    ICareerFieldOption[];

  total:
    number;
}

export interface ICreateCareerAutomationPayload {
  targetRole: string;

  careerGoal: string;

  targetDate?: string;

  roadmapDurationDays?: number;

  activeResumeId?: string;

  activeInterviewId?: string;

  jobPreferences?: {
    enabled?: boolean;

    targetRoles?: string[];

    locations?: string[];

    workModes?: ICareerJobPreferences["workModes"];

    employmentTypes?: ICareerJobPreferences["employmentTypes"];

    experienceLevels?: ICareerJobPreferences["experienceLevels"];

    minimumMatchScore?: number;

    dailyApplicationTarget?: number;

    notifyOnNewMatches?: boolean;

    notificationMatchThreshold?: number;
  };

  settings?: Partial<
    ICareerAutomationSettings
  >;
}

interface IApiResponse<T> {
  success: boolean;

  message?: string;

  data: T;
}

/* =========================================================
   HELPERS
========================================================= */

export const isCareerAutomationNotFoundError = (
  error:
    unknown
): boolean => {
  return (
    axios.isAxiosError(
      error
    ) &&
    error.response
      ?.status ===
      404
  );
};

/* =========================================================
   API
========================================================= */

export const createCareerAutomation = async (
  payload:
    ICreateCareerAutomationPayload
): Promise<{
  automation:
    ICareerAutomation;

  summary:
    ICareerAutomationSummary | null;
}> => {
  const {
    data,
  } =
    await apiClient.post<
      IApiResponse<{
        automation:
          ICareerAutomation;

        summary:
          ICareerAutomationSummary | null;
      }>
    >(
      "/career-automation",
      payload
    );

  return data.data;
};

export const getCareerAutomation =
  async (): Promise<ICareerAutomation> => {
    const {
      data,
    } =
      await apiClient.get<
        IApiResponse<ICareerAutomation>
      >(
        "/career-automation"
      );

    return data.data;
  };

export const getCareerAutomationSummary =
  async (
    date?: string
  ): Promise<ICareerAutomationSummary> => {
    const {
      data,
    } =
      await apiClient.get<
        IApiResponse<ICareerAutomationSummary>
      >(
        "/career-automation/summary",
        {
          params:
            date
              ? {
                  date,
                }
              : undefined,
        }
      );

    return data.data;
  };

export const generateCareerDailyPlan =
  async (
    options?: {
      date?: string;

      force?: boolean;
    }
  ): Promise<{
    tasks:
      ICareerAutomationTask[];

    summary:
      ICareerAutomationSummary | null;
  }> => {
    const {
      data,
    } =
      await apiClient.post<
        IApiResponse<{
          tasks:
            ICareerAutomationTask[];

          summary:
            ICareerAutomationSummary | null;
        }>
      >(
        "/career-automation/daily-plan",
        options ||
        {}
      );

    return data.data;
  };

export const updateCareerAutomationTask =
  async (
    taskId:
      string,
    status:
      CareerTaskStatus
  ): Promise<{
    task:
      ICareerAutomationTask;

    summary:
      ICareerAutomationSummary | null;
  }> => {
    const {
      data,
    } =
      await apiClient.patch<
        IApiResponse<{
          task:
            ICareerAutomationTask;

          summary:
            ICareerAutomationSummary | null;
        }>
      >(
        `/career-automation/tasks/${encodeURIComponent(
          taskId
        )}`,
        {
          status,
        }
      );

    return data.data;
  };

export const replanCareerAutomation =
  async (
    reason?: string
  ): Promise<{
    automation:
      ICareerAutomation;

    summary:
      ICareerAutomationSummary | null;
  }> => {
    const {
      data,
    } =
      await apiClient.post<
        IApiResponse<{
          automation:
            ICareerAutomation;

          summary:
            ICareerAutomationSummary | null;
        }>
      >(
        "/career-automation/replan",
        {
          reason,

          preserveCompletedTasks:
            true,
        }
      );

    return data.data;
  };

export const refreshCareerAutomationProgress =
  async (): Promise<{
    automation:
      ICareerAutomation;

    summary:
      ICareerAutomationSummary | null;
  }> => {
    const {
      data,
    } =
      await apiClient.post<
        IApiResponse<{
          automation:
            ICareerAutomation;

          summary:
            ICareerAutomationSummary | null;
        }>
      >(
        "/career-automation/progress/refresh"
      );

    return data.data;
  };

export const updateCareerAutomationStatus =
  async (
    status:
      CareerAutomationStatus
  ): Promise<{
    automation:
      ICareerAutomation;

    summary:
      ICareerAutomationSummary | null;
  }> => {
    const {
      data,
    } =
      await apiClient.patch<
        IApiResponse<{
          automation:
            ICareerAutomation;

          summary:
            ICareerAutomationSummary | null;
        }>
      >(
        "/career-automation/status",
        {
          status,
        }
      );

    return data.data;
  };

/* =========================================================
   CAREER FIELDS
========================================================= */

export const getCareerFields =
  async (): Promise<ICareerFieldsResponse> => {
    const {
      data,
    } =
      await apiClient.get<
        IApiResponse<ICareerFieldsResponse>
      >(
        "/career-automation/fields"
      );

    return data.data;
  };

/* =========================================================
   JOB SEARCH PREFERENCES
========================================================= */

export interface IUpdateCareerJobPreferencesPayload {
  targetRole?: string;

  enabled?: boolean;

  locations?: string[];

  workModes?:
    ICareerJobPreferences["workModes"];

  employmentTypes?:
    ICareerJobPreferences["employmentTypes"];

  experienceLevels?:
    ICareerJobPreferences["experienceLevels"];

  minimumMatchScore?: number;

  dailyApplicationTarget?: number;

  notifyOnNewMatches?: boolean;

  notificationMatchThreshold?: number;
}

export const updateCareerJobPreferences =
  async (
    payload:
      IUpdateCareerJobPreferencesPayload
  ): Promise<{
    automation:
      ICareerAutomation;

    summary:
      ICareerAutomationSummary | null;
  }> => {
    const {
      data,
    } =
      await apiClient.patch<
        IApiResponse<{
          automation:
            ICareerAutomation;

          summary:
            ICareerAutomationSummary | null;
        }>
      >(
        "/career-automation/job-preferences",
        payload
      );

    return data.data;
  };

/* =========================================================
   EXTERNAL JOBS
========================================================= */

export interface IExternalCareerJob {
  _id: string;

  title: string;

  company: string;

  location: string;

  remoteType:
    | "onsite"
    | "hybrid"
    | "remote";

  employmentType:
    | "full-time"
    | "part-time"
    | "contract"
    | "internship";

  experienceLevel:
    | "entry"
    | "junior"
    | "mid"
    | "senior";

  description: string;

  skills: string[];

  salary: number;

  source: string;

  externalId?: string;

  externalUrl?: string;

  postedAt: string;
}

export interface IExternalCareerJobMatch {
  job: {
    _id: string;

    title: string;

    company: string;

    location: string;

    remoteType:
      | "onsite"
      | "hybrid"
      | "remote";

    employmentType:
      | "full-time"
      | "part-time"
      | "contract"
      | "internship";

    experienceLevel:
      | "entry"
      | "junior"
      | "mid"
      | "senior";

    description: string;

    skills: string[];

    keywords: string[];

    source: string;

    externalUrl?: string;

    postedAt: string;
  };

  matchScore: number;

  matchedSkills: string[];

  missingSkills: string[];
}

export interface IExternalCareerJobMatchesResponse {
  jobs:
    IExternalCareerJobMatch[];

  total:
    number;

  lastJobSearchAt?:
    string;

  nextJobSearchAt?:
    string;
}

export interface IExternalJobRefreshResponse {
  fetched:
    number;

  stored:
    number;

  matched:
    number;

  jobs:
    Array<{
      job:
        IExternalCareerJob;

      matchScore:
        number;

      matchedSkills:
        string[];

      missingSkills:
        string[];
    }>;
}

export const refreshExternalCareerJobs =
  async (): Promise<IExternalJobRefreshResponse> => {
    const {
      data,
    } =
      await apiClient.post<
        IApiResponse<IExternalJobRefreshResponse>
      >(
        "/jobs/external/refresh",
        {}
      );

    return data.data;
  };

export const getExternalCareerJobMatches =
  async (): Promise<IExternalCareerJobMatchesResponse> => {
    const {
      data,
    } =
      await apiClient.get<
        IApiResponse<IExternalCareerJobMatchesResponse>
      >(
        "/jobs/external/matches"
      );

    return data.data;
  };

export default {
  createCareerAutomation,
  getCareerAutomation,
  getCareerAutomationSummary,
  generateCareerDailyPlan,
  updateCareerAutomationTask,
  replanCareerAutomation,
  refreshCareerAutomationProgress,
  updateCareerAutomationStatus,

  getCareerFields,
  updateCareerJobPreferences,

  refreshExternalCareerJobs,
  getExternalCareerJobMatches,
};
