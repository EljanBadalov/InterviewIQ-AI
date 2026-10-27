import { getDisplaySkillName, getCanonicalSkillName, isUsableSkill } from './skillEvidenceIdentity';
import { readRoadmapEvidence, readRoadmapDocument } from "./roadmapEvidenceScope";
import {
  Types,
} from "mongoose";

import {
  ResumeAnalysis,
  type IResumeAnalysis,
} from "../models/resumeAnalysis";

import {
  UserSkillProfile,
  type IUserSkill,
  type SkillEvidenceSource,
  type SkillLevel,
} from "../models/UserSkillProfile";

/* =========================================================
   TYPES
========================================================= */

export type CareerSkillConfidenceLabel =
  | "low"
  | "medium"
  | "high"
  | "very-high";

export interface ICareerSkillProfileItem {
  name: string;

  normalizedName: string;

  /*
   * 0..100 strength score used for career/job matching.
   *
   * IMPORTANT:
   * This is NOT the CV ATS score, overall score,
   * content score, structure score or skills section score.
   */
  skillScore: number;

  /*
   * 0..1 confidence that InterviewIQ has enough evidence
   * to trust this skill for career matching.
   */
  confidence: number;

  confidenceLabel:
    CareerSkillConfidenceLabel;

  level: SkillLevel;

  evidenceCount: number;

  sources:
    SkillEvidenceSource[];

  interviewVerified: boolean;

  presentInResume: boolean;

  resumeAnalysisId?: string;

  latestEvidenceAt?: Date;
}

export interface ICareerSkillProfile {
  userId: string;

  resumeAnalysisId?: string;

  resumeFileName?: string;

  skills:
    ICareerSkillProfileItem[];

  strongestSkills:
    ICareerSkillProfileItem[];

  verifiedSkills:
    ICareerSkillProfileItem[];

  resumeSkills:
    ICareerSkillProfileItem[];

  totalSkills: number;

  generatedAt: Date;
}

interface BuildCareerSkillProfileParams {
  /** A latest-resume read already scoped to this user; never supplied from HTTP. */
  preloadedLatestResume?: IResumeAnalysis | null;
  userId:
    | Types.ObjectId
    | string;

  /*
   * CareerAutomation.activeResumeId may not always be a
   * ResumeAnalysis._id. We try it first and gracefully
   * fall back to the user's latest ResumeAnalysis.
   */
  resumeAnalysisId?:
    | Types.ObjectId
    | string;

  strongestSkillLimit?:
    number;
}

/* =========================================================
   CONSTANTS
========================================================= */

const RESUME_ONLY_SCORE =
  68;

const RESUME_ONLY_CONFIDENCE =
  0.62;

const TECHNICAL_SOURCE:
  SkillEvidenceSource =
    "technical-question";

/* =========================================================
   BASIC HELPERS
========================================================= */

const clamp = (
  value:
    number,
  min:
    number,
  max:
    number
): number => {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
};

const roundScore = (
  value:
    number
): number => {
  return Math.round(
    clamp(
      value,
      0,
      100
    )
  );
};

const getConfidenceLabel = (
  confidence:
    number
): CareerSkillConfidenceLabel => {
  if (
    confidence >=
    0.9
  ) {
    return "very-high";
  }

  if (
    confidence >=
    0.72
  ) {
    return "high";
  }

  if (
    confidence >=
    0.5
  ) {
    return "medium";
  }

  return "low";
};

const levelRank:
  Record<
    SkillLevel,
    number
  > = {
    beginner:
      1,

    intermediate:
      2,

    advanced:
      3,

    expert:
      4,
  };

const getStrongerLevel = (
  first:
    SkillLevel,
  second:
    SkillLevel
): SkillLevel => {
  return (
    levelRank[
      first
    ] >=
    levelRank[
      second
    ]
      ? first
      : second
  );
};

/* =========================================================
   INTERVIEW VERIFICATION
========================================================= */

const isInterviewSkillVerified = (
  skill:
    IUserSkill
): boolean => {
  const scores =
    skill.evidence
      .filter(
        (
          evidence
        ) =>
          evidence.source ===
            TECHNICAL_SOURCE &&
          typeof evidence.score ===
            "number"
      )
      .map(
        (
          evidence
        ) =>
          evidence.score as number
      );

  if (
    scores.length ===
    0
  ) {
    return false;
  }

  /*
   * Strong single evidence.
   */
  if (
    scores.some(
      (
        score
      ) =>
        score >=
        90
    )
  ) {
    return true;
  }

  /*
   * Or repeated good technical evidence.
   */
  if (
    scores.length <
    2
  ) {
    return false;
  }

  const average =
    scores.reduce(
      (
        total,
        score
      ) =>
        total +
        score,
      0
    ) /
    scores.length;

  return (
    average >=
    80
  );
};

/* =========================================================
   PLATFORM SKILL SCORE
========================================================= */

const getPlatformSkillScore = (
  skill:
    IUserSkill
): number => {
  const scored =
    skill.evidence.filter(
      (
        evidence
      ) =>
        typeof evidence.score ===
        "number"
    );

  if (
    scored.length >
    0
  ) {
    const weighted =
      scored.map(
        (
          evidence
        ) => {
          const weight =
            evidence.source ===
              "technical-question"
              ? 1
              : evidence.source ===
                  "mock-interview"
                ? 0.9
                : evidence.source ===
                    "project"
                  ? 0.85
                  : evidence.source ===
                      "quiz"
                    ? 0.8
                    : evidence.source ===
                        "resume"
                      ? 0.7
                      : 0.65;

          return {
            score:
              evidence.score as number,

            weight,
          };
        }
      );

    const numerator =
      weighted.reduce(
        (
          total,
          item
        ) =>
          total +
          item.score *
            item.weight,
        0
      );

    const denominator =
      weighted.reduce(
        (
          total,
          item
        ) =>
          total +
          item.weight,
        0
      );

    if (
      denominator >
      0
    ) {
      return roundScore(
        numerator /
        denominator
      );
    }
  }

  if (
    skill.confidence >
    0
  ) {
    return roundScore(
      55 +
      skill.confidence *
        35
    );
  }

  return 55;
};

/* =========================================================
   RESUME SELECTION
========================================================= */

/*
 * Important fix:
 *
 * CareerAutomation.activeResumeId is not guaranteed to be
 * ResumeAnalysis._id.
 *
 * Old behavior:
 *   activeResumeId exists
 *   -> search only by _id
 *   -> not found
 *   -> resume = null
 *   -> no CV skills
 *
 * New behavior:
 *   1. Try requested ResumeAnalysis._id
 *   2. If not found, fall back to latest ResumeAnalysis
 *   3. If no id was provided, use latest ResumeAnalysis
 */
const getResumeAnalysis =
  async (
    userId:
      Types.ObjectId,
    resumeAnalysisId?:
      | Types.ObjectId
      | string,
    preloadedLatestResume?: IResumeAnalysis | null
  ): Promise<
    IResumeAnalysis |
    null
  > => {
    const canReuseLatest = preloadedLatestResume !== undefined &&
      (!preloadedLatestResume || String(preloadedLatestResume.user) === String(userId));
    if (canReuseLatest && preloadedLatestResume && resumeAnalysisId &&
      String(preloadedLatestResume._id) === String(resumeAnalysisId)) {
      return preloadedLatestResume;
    }

    if (
      resumeAnalysisId
    ) {
      const rawId =
        resumeAnalysisId
          .toString();

      if (
        Types.ObjectId.isValid(
          rawId
        )
      ) {
        const requestedResume =
          await readRoadmapDocument(String(userId), "resume", { id:rawId }, async () => await ResumeAnalysis.findOne({
            _id:
              new Types.ObjectId(
                rawId
              ),

            user:
              userId,
          }).lean());

        if (
          requestedResume
        ) {
          return requestedResume;
        }

        console.warn("[CAREER PROFILE] Active resume unavailable; using the user's latest analysis.");
      } else {
        console.warn("[CAREER PROFILE] Invalid active resume reference; using the user's latest analysis.");
      }
    }

    if (canReuseLatest) return preloadedLatestResume ?? null;

    const latestResume =
      await readRoadmapDocument(String(userId), "resume", { latest:true }, async () => await ResumeAnalysis.findOne({
        user:
          userId,
      })
        .sort({
          createdAt:
            -1,
        })
        .lean());

    return latestResume;
  };

/* =========================================================
   MERGE PLATFORM SKILL
========================================================= */

const addPlatformSkillToProfile = (
  merged:
    Map<
      string,
      ICareerSkillProfileItem
    >,
  skill:
    IUserSkill
): void => {
  if (
    !isUsableSkill(
      skill.name
    )
  ) {
    return;
  }

  const displayName =
    getDisplaySkillName(
      skill.name
    );

  const normalizedName =
    getCanonicalSkillName(
      displayName
    );

  const interviewVerified =
    isInterviewSkillVerified(
      skill
    );

  const latestEvidenceAt =
    skill.evidence
      .map(
        (
          evidence
        ) =>
          new Date(
            evidence.recordedAt
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          b.getTime() -
          a.getTime()
      )[0];

  merged.set(
    normalizedName,
    {
      name:
        displayName,

      normalizedName,

      skillScore:
        getPlatformSkillScore(
          skill
        ),

      confidence:
        clamp(
          skill.confidence,
          0,
          1
        ),

      confidenceLabel:
        getConfidenceLabel(
          skill.confidence
        ),

      level:
        skill.level,

      evidenceCount:
        skill.evidenceCount,

      sources: [
        ...new Set(
          skill.sources
        ),
      ],

      interviewVerified,

      presentInResume:
        skill.sources.includes(
          "resume"
        ),

      latestEvidenceAt,
    }
  );
};

/* =========================================================
   MERGE RESUME SKILL
========================================================= */

const addResumeSkillToProfile = (
  merged:
    Map<
      string,
      ICareerSkillProfileItem
    >,
  rawSkill:
    string,
  resume:
    IResumeAnalysis
): void => {
  if (
    !isUsableSkill(
      rawSkill
    )
  ) {
    return;
  }

  const displayName =
    getDisplaySkillName(
      rawSkill
    );

  const normalizedName =
    getCanonicalSkillName(
      displayName
    );

  const existing =
    merged.get(
      normalizedName
    );

  if (
    existing
  ) {
    const sources =
      new Set<
        SkillEvidenceSource
      >(
        existing.sources
      );

    sources.add(
      "resume"
    );

    /*
     * Resume confirms presence of the skill.
     * It raises confidence slightly, but NEVER uses:
     *
     * - overallScore
     * - atsScore
     * - structureScore
     * - contentScore
     * - skillsScore
     * - experienceScore
     */
    const improvedConfidence =
      clamp(
        Math.max(
          existing.confidence,
          RESUME_ONLY_CONFIDENCE
        ) +
        (
          existing
            .interviewVerified
            ? 0.04
            : 0.02
        ),
        0,
        1
      );

    existing.sources = [
      ...sources,
    ];

    existing.presentInResume =
      true;

    existing.resumeAnalysisId =
      resume
        ._id
        ?.toString();

    existing.confidence =
      Number(
        improvedConfidence.toFixed(
          2
        )
      );

    existing.confidenceLabel =
      getConfidenceLabel(
        existing.confidence
      );

    /*
     * Resume evidence may provide a minimum floor,
     * but can never lower a verified platform skill.
     */
    existing.skillScore =
      Math.max(
        existing.skillScore,
        RESUME_ONLY_SCORE
      );

    existing.level =
      getStrongerLevel(
        existing.level,
        "beginner"
      );

    /*
     * The resume is additional evidence if it was not
     * already represented in UserSkillProfile.
     */
    if (
      !existing.sources.includes(
        "resume"
      )
    ) {
      existing.evidenceCount +=
        1;
    }

    merged.set(
      normalizedName,
      existing
    );

    return;
  }

  merged.set(
    normalizedName,
    {
      name:
        displayName,

      normalizedName,

      skillScore:
        RESUME_ONLY_SCORE,

      confidence:
        RESUME_ONLY_CONFIDENCE,

      confidenceLabel:
        getConfidenceLabel(
          RESUME_ONLY_CONFIDENCE
        ),

      level:
        "beginner",

      evidenceCount:
        1,

      sources: [
        "resume",
      ],

      interviewVerified:
        false,

      presentInResume:
        true,

      resumeAnalysisId:
        resume
          ._id
          ?.toString(),

      latestEvidenceAt:
        resume.createdAt,
    }
  );
};

/* =========================================================
   BUILD CAREER SKILL PROFILE
========================================================= */

export const buildCareerSkillProfile =
  async ({
    userId,
    resumeAnalysisId,
    preloadedLatestResume,
    strongestSkillLimit =
      10,
  }: BuildCareerSkillProfileParams): Promise<ICareerSkillProfile> => {
    const rawUserId =
      userId.toString();

    if (
      !Types.ObjectId.isValid(
        rawUserId
      )
    ) {
      throw new Error(
        "A valid user ID is required."
      );
    }

    const userObjectId =
      new Types.ObjectId(
        rawUserId
      );

    const [
      resume,
      platformProfile,
    ] =
      await Promise.all([
        getResumeAnalysis(
          userObjectId,
          resumeAnalysisId,
          preloadedLatestResume
        ),

        readRoadmapEvidence(String(userObjectId), 'skill-profile:raw', () => UserSkillProfile.findOne({
          user:
            userObjectId,
        }).lean()),
      ]);

    const merged =
      new Map<
        string,
        ICareerSkillProfileItem
      >();

    /* =====================================================
       1. PLATFORM / INTERVIEW / PROJECT / QUIZ EVIDENCE
    ===================================================== */

    for (
      const rawSkill of
      platformProfile
        ?.skills ??
      []
    ) {
      addPlatformSkillToProfile(
        merged,
        rawSkill as IUserSkill
      );
    }

    /* =====================================================
       2. CV SKILLS

       IMPORTANT:
       We only use skillsDetected.
       CV quality scores NEVER affect job matching.
    ===================================================== */

    const resumeSkills =
      (
        resume
          ?.skillsDetected ??
        []
      )
        .filter(
          (
            skill
          ): skill is string =>
            typeof skill ===
              "string" &&
            Boolean(
              skill.trim()
            )
        );

    if (
      resume
    ) {
      for (
        const rawSkill of
        resumeSkills
      ) {
        addResumeSkillToProfile(
          merged,
          rawSkill,
          resume
        );
      }
    }

    /* =====================================================
       3. FINAL RANKING
    ===================================================== */

    const skills =
      [
        ...merged.values(),
      ]
        .sort(
          (
            a,
            b
          ) => {
            /*
             * Interview-verified skills first.
             */
            if (
              a.interviewVerified !==
              b.interviewVerified
            ) {
              return a
                .interviewVerified
                ? -1
                : 1;
            }

            /*
             * Strongest evidence score next.
             */
            if (
              b.skillScore !==
              a.skillScore
            ) {
              return (
                b.skillScore -
                a.skillScore
              );
            }

            /*
             * Then confidence.
             */
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
        );

    const strongestSkills =
      skills.slice(
        0,
        Math.max(
          1,
          strongestSkillLimit
        )
      );

    const profile:
      ICareerSkillProfile = {
      userId:
        rawUserId,

      resumeAnalysisId:
        resume
          ?._id
          ?.toString(),

      resumeFileName:
        resume
          ?.fileName,

      skills,

      strongestSkills,

      verifiedSkills:
        skills.filter(
          (
            skill
          ) =>
            skill
              .interviewVerified
        ),

      resumeSkills:
        skills.filter(
          (
            skill
          ) =>
            skill
              .presentInResume
        ),

      totalSkills:
        skills.length,

      generatedAt:
        new Date(),
    };

    return profile;
  };

/* =========================================================
   LIGHTWEIGHT HELPERS
========================================================= */

export const getCareerSkillNames =
  (
    profile:
      ICareerSkillProfile
  ): string[] => {
    return profile.skills.map(
      (
        skill
      ) =>
        skill.name
    );
  };

export const getCareerSkillMap =
  (
    profile:
      ICareerSkillProfile
  ): Map<
    string,
    ICareerSkillProfileItem
  > => {
    return new Map(
      profile.skills.map(
        (
          skill
        ) => [
          skill.normalizedName,
          skill,
        ]
      )
    );
  };

export default {
  buildCareerSkillProfile,
  getCareerSkillNames,
  getCareerSkillMap,
};

/** Explicit assessment facade; legacy matching never loads additional evidence. */
export async function buildCareerSkillEvidenceAssessment(input: import('./skillEvidenceAssessmentService.js').SkillAssessmentRequest) {
  const { loadSkillEvidenceAssessment } = await import('./skillEvidenceAssessmentService.js');
  return loadSkillEvidenceAssessment(input);
}
