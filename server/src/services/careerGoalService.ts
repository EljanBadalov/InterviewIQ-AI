import { timeGenerationStage } from './roadmapGenerationMetrics';
import { generateRoadmapNarratives, type NarrativeHistory } from "./roadmapNarrativeService";
import {
  loadRoadmapEvidence,
} from "./roadmapEvidenceService";
import { withRoadmapEvidence } from "./roadmapEvidenceScope";
import { normalizeString, getReadinessLevel, getGoalStatus, calculateReadinessScore, buildGoalStrengths, buildGoalGaps, buildGoalSummary } from './roadmapPlanningService';
import type { ICareerResumeContext } from "./careerContextService";

import type { ICareerJobMatchingResult } from "./careerJobContextService";

import type { ICareerInterviewContext } from "./careerInterviewContextService";

import type { ICareerProgressContext } from "./careerProgressService";

import type { ICareerKnowledgeContext } from "./careerKnowledgeService";

import type {
  CareerRoadmapCategory,
  CareerRoadmapGeneratedBy,
  CareerRoadmapInsightSource,
  CareerRoadmapPriority,
} from "../models/CareerAutomation";

/* =========================================================
   TYPES
========================================================= */

export type CareerGoalReadinessLevel =
  | "very_high"
  | "high"
  | "moderate"
  | "developing"
  | "early";

export type CareerGoalStatus =
  | "well_aligned"
  | "realistic_with_improvements"
  | "needs_development"
  | "insufficient_data";

export type CareerGoalPriority =
  | "high"
  | "medium"
  | "low";

export interface ICareerGoalGap {
  category:
    | "CV"
    | "SKILL"
    | "JOB"
    | "INTERVIEW"
    | "PROGRESS";

  priority:
    CareerGoalPriority;

  title: string;

  description: string;

  reason: string;

  score?: number;
}

export interface ICareerGoalStrength {
  category:
    | "CV"
    | "SKILL"
    | "JOB"
    | "INTERVIEW"
    | "PROGRESS";

  title: string;

  description: string;

  score?: number;
}

export interface ICareerGoalRoadmapRecommendation {
  title: string;

  whyItMatters: string;

  whatToLearn: string[];

  action: string;

  proofOfCompletion?: string;

  priority:
    CareerRoadmapPriority;

  source:
    CareerRoadmapInsightSource;

  evidence?: string[];
}

export interface ICareerGoalMilestone {
  order: number;

  category:
    CareerRoadmapCategory;

  title: string;

  description: string;

  reason: string;

  readinessScore?: number;

  completed: boolean;

  relatedSkills: string[];

  recommendations:
    ICareerGoalRoadmapRecommendation[];

  generatedBy:
    CareerRoadmapGeneratedBy;
}

export interface ICareerGoalContext {
  targetRole?: string;

  careerGoal?: string;

  readinessScore: number;

  readinessLevel:
    CareerGoalReadinessLevel;

  status:
    CareerGoalStatus;

  resume?:
    ICareerResumeContext;

  jobMatches?:
    ICareerJobMatchingResult;

  interview?:
    ICareerInterviewContext;

  progress?:
    ICareerProgressContext;

  careerKnowledge?:
    ICareerKnowledgeContext;

  strengths:
    ICareerGoalStrength[];

  gaps:
    ICareerGoalGap[];

  milestones:
    ICareerGoalMilestone[];

  summary: string;
}

export interface ICareerGoalResult {
  found: boolean;

  data?:
    ICareerGoalContext;

  reason?:
    | "USER_ID_REQUIRED"
    | "TARGET_ROLE_REQUIRED"
    | "NO_CAREER_DATA";
}

export interface ICareerGoalInput {
  userId?: string;

  activeResumeId?: string;

  activeInterviewId?: string;

  targetRole?: string;

  careerGoal?: string;
}

const runBuildCareerGoalContext =
  async (
    input:
      ICareerGoalInput,
    previous?: NarrativeHistory,
    reuseOnly = false
  ): Promise<
    ICareerGoalResult
  > => {
    const userId =
      normalizeString(
        input.userId
      );

    const targetRole =
      normalizeString(
        input.targetRole
      );

    const careerGoal =
      normalizeString(
        input.careerGoal
      );

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (
      !userId
    ) {
      return {
        found:
          false,

        reason:
          "USER_ID_REQUIRED",
      };
    }

    if (
      !targetRole
    ) {
      return {
        found:
          false,

        reason:
          "TARGET_ROLE_REQUIRED",
      };
    }

    const { resume, jobMatches, interview, progress, careerSkillProfile, careerKnowledge, learningPlan, narrativeSourceComplete } =
      await timeGenerationStage('evidence', () => loadRoadmapEvidence({ ...input, userId, targetRole, careerGoal }));

    /* =====================================================
       NO DATA
    ===================================================== */

    if (
      !resume &&
      !jobMatches &&
      !interview &&
      !progress &&
      !careerKnowledge?.found
    ) {
      return {
        found:
          false,

        reason:
          "NO_CAREER_DATA",
      };
    }

    /* =====================================================
       SCORE
    ===================================================== */

    const readinessScore =
      timeGenerationStage('planner', () => calculateReadinessScore({
        resume,
        jobMatches,
        interview,
        progress,
      }));

    const readinessLevel =
      getReadinessLevel(
        readinessScore
      );

    const status =
      getGoalStatus(
        readinessScore,
        true
      );

    /* =====================================================
       STRENGTHS
    ===================================================== */

    const strengths =
      timeGenerationStage('planner', () => buildGoalStrengths({
        resume,
        jobMatches,
        interview,
      }));

    /* =====================================================
       GAPS
    ===================================================== */

    const gaps =
      timeGenerationStage('planner', () => buildGoalGaps({
        resume,
        jobMatches,
        interview,
        progress,
      }));

    /* =====================================================
       MILESTONES
    ===================================================== */

    const milestones =
      await generateRoadmapNarratives({
        userId,
        targetRole,

        careerGoal,


        resume,

        jobMatches,

        interview,


        gaps,

        careerKnowledge,
        careerSkillProfile,
        learningPlan,
        sourceComplete:narrativeSourceComplete,
        previous,
        reuseOnly,
      });

    /* =====================================================
       SUMMARY
    ===================================================== */

    const summary =
      buildGoalSummary({
        targetRole,
        readinessScore,
        status,
        jobMatches,
        gaps,
      });

    return {
      found:
        true,

      data: {
        targetRole,

        careerGoal,

        readinessScore,

        readinessLevel,

        status,

        resume,

        jobMatches,

        interview,

        progress,

        careerKnowledge,

        strengths,

        gaps,

        milestones,

        summary,
      },
    };
  };

/* =========================================================
   BUILD CHAT REPLY
========================================================= */

export const buildCareerGoalReply =
  (
    context:
      ICareerGoalContext
  ): string => {
    const parts:
      string[] = [];

    parts.push(
      context.summary
    );

    /* =====================================================
       STRENGTHS
    ===================================================== */

    if (
      context.strengths.length >
      0
    ) {
      parts.push(
        `Your strongest readiness signals are: ${context.strengths
          .slice(
            0,
            3
          )
          .map(
            (
              strength
            ) =>
              strength.title
          )
          .join(
            ", "
          )}.`
      );
    }

    /* =====================================================
       GAPS
    ===================================================== */

    if (
      context.gaps.length >
      0
    ) {
      parts.push(
        `Your top areas to improve are: ${context.gaps
          .slice(
            0,
            3
          )
          .map(
            (
              gap
            ) =>
              gap.title
          )
          .join(
            ", "
          )}.`
      );
    }

    /* =====================================================
       NEXT MILESTONE
    ===================================================== */

    const nextMilestone =
      context.milestones.find(
        (
          milestone
        ) =>
          !milestone.completed
      );

    if (
      nextMilestone
    ) {
      parts.push(
        `Your next milestone should be: ${nextMilestone.title}. ${nextMilestone.description}`
      );
    }

    return parts.join(
      " "
    );
  };

/* =========================================================
   BUILD API SUMMARY
========================================================= */

export const buildCareerGoalSummary =
  (
    context:
      ICareerGoalContext
  ): Record<
    string,
    unknown
  > => {
    return {
      targetRole:
        context.targetRole,

      careerGoal:
        context.careerGoal,

      readinessScore:
        context.readinessScore,

      readinessLevel:
        context.readinessLevel,

      status:
        context.status,

      summary:
        context.summary,

      strengths:
        context.strengths,

      gaps:
        context.gaps,

      milestones:
        context.milestones,

      careerKnowledge: {
        found:
          Boolean(
            context
              .careerKnowledge
              ?.found
          ),

        resolvedRole:
          context
            .careerKnowledge
            ?.resolvedRole,

        priorityTopics:
          context
            .careerKnowledge
            ?.priorityTopics
            .slice(
              0,
              10
            )
            .map(
              (
                item
              ) => ({
                name:
                  item.topic.name,

                level:
                  item.topic.level,

                importance:
                  item.topic.importance,

                readinessScore:
                  item.readinessScore,

                status:
                  item.status,

                priorityScore:
                  item.priorityScore,
              })
            ) ||
          [],
      },

      roadmapGeneration: {
        personalized:
          context.milestones
            .some(
              (
                milestone
              ) =>
                milestone.generatedBy ===
                "qwen"
            ),

        qwenSections:
          context.milestones
            .filter(
              (
                milestone
              ) =>
                milestone.generatedBy ===
                "qwen"
            )
            .length,

        fallbackSections:
          context.milestones
            .filter(
              (
                milestone
              ) =>
                milestone.generatedBy ===
                "fallback"
            )
            .length,
      },

      sources: {
        resume:
          Boolean(
            context.resume
          ),

        jobs:
          Boolean(
            context.jobMatches
          ),

        interview:
          Boolean(
            context.interview
          ),

        progress:
          Boolean(
            context.progress
          ),

        careerKnowledge:
          Boolean(
            context
              .careerKnowledge
              ?.found
          ),
      },

      bestJobMatch:
        context.jobMatches
          ?.bestMatch
        ? {
            id:
              context
                .jobMatches
                .bestMatch
                ?.id,

            title:
              context
                .jobMatches
                .bestMatch
                ?.title,

            company:
              context
                .jobMatches
                .bestMatch
                ?.company,

            matchScore:
              context
                .jobMatches
                .bestMatch
                ?.match
                .matchScore,

            matchedSkills:
              context
                .jobMatches
                .bestMatch
                ?.match
                .matchedSkills,

            missingSkills:
              context
                .jobMatches
                .bestMatch
                ?.match
                .missingSkills,
          }
        : null,

      resumeReadiness:
        context.resume
        ? {
            overallScore:
              context.resume
                .overallScore,

            atsScore:
              context.resume
                .atsScore,

            skillsScore:
              context.resume
                .skillsScore,

            experienceScore:
              context.resume
                .experienceScore,
          }
        : null,

      interviewReadiness:
        context.interview
        ? {
            overallScore:
              context.interview
                .overallScore,

            technicalAccuracy:
              context.interview
                .averageTechnicalAccuracy,

            completeness:
              context.interview
                .averageCompleteness,

            communication:
              context.interview
                .averageCommunication,
          }
        : null,
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export const buildCareerGoalContext = (input: ICareerGoalInput, previous?: NarrativeHistory): Promise<ICareerGoalResult> =>
  withRoadmapEvidence(input.userId || "", () => runBuildCareerGoalContext(input, previous));

// Reading chat context must never become an implicit roadmap generation action.
export const buildCareerGoalChatContext = (input: ICareerGoalInput): Promise<ICareerGoalResult> =>
  withRoadmapEvidence(input.userId || "", () => runBuildCareerGoalContext(input, undefined, true));

export default {
  buildCareerGoalContext,

  buildCareerGoalReply,

  buildCareerGoalSummary,
};
