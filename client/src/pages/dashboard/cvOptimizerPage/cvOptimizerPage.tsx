import React, {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  FiArrowLeft,
  FiCheckCircle,
  FiAlertCircle,
  FiFileText,
  FiTarget,
  FiTrendingUp,
  FiBriefcase,
  FiLayers,
  FiZap,
  FiAward,
  FiBookOpen,
} from "react-icons/fi";

import apiClient from "../../../api/apiClient";

import ResumeProfileCompletenessModal from "../../../components/resume/ResumeProfileCompletenessModal";

import "./cvOptimizerPage.scss";

/* =========================================================
   OPTIMIZATION TYPES
========================================================= */

type MatchLevel =
  | "strong"
  | "good"
  | "partial"
  | "low";

type PriorityLevel =
  | "high"
  | "medium"
  | "low";

type SectionStatus =
  | "strong"
  | "needs-improvement"
  | "weak";

type OptimizationSection =
  | "summary"
  | "skills"
  | "experience"
  | "projects"
  | "keywords"
  | "education"
  | "ats";

interface OptimizationPriorityAction {
  priority: PriorityLevel;

  title: string;

  description: string;
}

interface OptimizationSectionResult {
  section: OptimizationSection;

  score: number;

  status: SectionStatus;

  suggestions: string[];
}

interface OptimizationTemplate {
  id?: string;

  role: string;

  displayName: string;

  matchScore: number;

  reasons: string[];
}

interface OptimizationEvidenceSummary {
  totalResumeSkills: number;

  totalValidatedSkills: number;

  totalJobSkills: number;

  matchedJobSkills: number;

  missingJobSkills: number;

  platformSupportedJobSkills: number;

  templateRelevantSkills: number;
}

interface OptimizationResult {
  currentResumeScore: number;

  currentJobMatchScore: number;

  targetJob: {
    id?: string;

    title: string;

    company: string;
  };

  matchLevel: MatchLevel;

  templateUsed:
    | OptimizationTemplate
    | null;

  matchedSkills: string[];

  missingSkills: string[];

  platformVerifiedSkills: string[];

  platformSkillsMissingFromResume: string[];

  safeSkillsForCV: string[];

  recommendedKeywords: string[];

  suggestedSkills: string[];

  suggestedProfessionalSummary: string;

  experienceSuggestions: string[];

  projectSuggestions: string[];

  atsSuggestions: string[];

  formattingSuggestions: string[];

  priorityActions: OptimizationPriorityAction[];

  sectionsToImprove: OptimizationSectionResult[];

  evidenceSummary: OptimizationEvidenceSummary;

  disclaimer: string;
}

interface OptimizationResponse {
  success: boolean;

  message: string;

  data: {
    resume: {
      id: string;

      fileName: string;

      currentScore: number;

      atsScore: number;

      contentScore: number;

      structureScore: number;

      skillsScore: number;

      experienceScore: number;

      analyzedAt?: string;
    };

    job: {
      id: string;

      title: string;

      company: string;

      location?: string;

      employmentType?: string;

      remoteType?: string;

      experienceMin?: number;

      experienceMax?: number | null;

      salary?: number;

      skills?: string[];

      keywords?: string[];

      requirements?: string[];

      responsibilities?: string[];

      preferredQualifications?: string[];
    };

    optimization: OptimizationResult;
  };
}

/* =========================================================
   RESUME PROFILE COMPLETENESS TYPES
========================================================= */

type ResumeFieldKey =
  | "fullName"
  | "email"
  | "phone"
  | "location"
  | "linkedin"
  | "github"
  | "website"
  | "skills"
  | "experience"
  | "projects"
  | "education"
  | "certifications"
  | "languages";

interface ResumeMissingField {
  key: ResumeFieldKey;

  label: string;

  description: string;

  required: boolean;

  type:
    | "text"
    | "email"
    | "tel"
    | "url"
    | "textarea"
    | "skills"
    | "experience"
    | "projects"
    | "education"
    | "certifications"
    | "languages";
}

interface ResumeCompleteness {
  isComplete: boolean;

  canGenerateCV: boolean;

  completionPercentage: number;

  missingRequiredFields: ResumeMissingField[];

  missingOptionalFields: ResumeMissingField[];

  allMissingFields: ResumeMissingField[];

  existingFields: ResumeFieldKey[];
}

interface ResumeCompletenessData {
  profileId: string;

  source: {
    hasUploadedResume: boolean;
    fileName: string;
  };

  completeness: ResumeCompleteness;
}

interface ResumeCompletenessResponse {
  success: boolean;

  message: string;

  data: ResumeCompletenessData;
}

interface ResumeProfileCompletenessModalProps {
  open: boolean;

  initialData:
    | ResumeCompletenessData
    | null;

  onClose: () => void;

  onReady:
    () =>
      | void
      | Promise<void>;
}

/*
 * Explicitly type the imported modal.
 * This avoids JSX/IntrinsicAttributes errors if TypeScript
 * cannot infer the component props from the imported module.
 */
const TypedResumeProfileCompletenessModal =
  ResumeProfileCompletenessModal as React.ComponentType<
    ResumeProfileCompletenessModalProps
  >;

/* =========================================================
   PAGE
========================================================= */

const cvOptimizerPage: React.FC =
  () => {
    const navigate =
      useNavigate();

    const { jobId } =
      useParams<{
        jobId: string;
      }>();

    const [
      data,
      setData,
    ] =
      useState<
        OptimizationResponse["data"] | null
      >(null);

    const [
      loading,
      setLoading,
    ] =
      useState(true);

    const [
      error,
      setError,
    ] =
      useState("");

    const [
      generating,
      setGenerating,
    ] =
      useState(false);

    const [
      generateError,
      setGenerateError,
    ] =
      useState("");


    const [
      profileModalOpen,
      setProfileModalOpen,
    ] =
      useState(false);

    const [
      profileCompletenessData,
      setProfileCompletenessData,
    ] =
      useState<ResumeCompletenessData | null>(
        null
      );

    const [
      checkingProfile,
      setCheckingProfile,
    ] =
      useState(false);

    /* =====================================================
       LOAD OPTIMIZATION
    ===================================================== */

    useEffect(() => {
      const fetchOptimization =
        async () => {
          if (!jobId) {
            setError(
              "Job ID is missing."
            );

            setLoading(
              false
            );

            return;
          }

          try {
            setLoading(
              true
            );

            setError(
              ""
            );

            const response =
              await apiClient.get<OptimizationResponse>(
                `/cv-optimization/jobs/${jobId}`
              );

            setData(
              response.data.data
            );
          } catch (
            err: any
          ) {
            setError(
              err?.response
                ?.data
                ?.message ||
                "Could not load CV optimization."
            );
          } finally {
            setLoading(
              false
            );
          }
        };

      void fetchOptimization();
    }, [jobId]);

    const optimization =
      data?.optimization;

    /* =====================================================
       GENERATE IMPROVED CV + SEND TO EXISTING ANALYSIS API
    ===================================================== */

    interface ResumeAnalysisApiResponse {
      success?: boolean;

      message?: string;

      data?: {
        analysis?: {
          analysisId?: string;
          _id?: string;
        };
      };
    }

    const generateAndAnalyzeCV =
      async () => {
        if (!jobId) {
          setGenerateError(
            "Job ID is missing."
          );

          return;
        }

        try {
          setGenerating(
            true
          );

          setGenerateError(
            ""
          );

          /*
           * 1. Generate improved CV PDF.
           * Do NOT download it automatically.
           */

          const generatedResponse =
            await apiClient.post(
              `/cv-builder/jobs/${jobId}/generate`,
              {},
              {
                responseType:
                  "blob",
              }
            );

          const contentDisposition =
            generatedResponse.headers[
              "content-disposition"
            ] as
              | string
              | undefined;

          let fileName =
            "Improved_CV.pdf";

          if (
            contentDisposition
          ) {
            const utf8Match =
              contentDisposition.match(
                /filename\*=UTF-8''([^;]+)/
              );

            const normalMatch =
              contentDisposition.match(
                /filename="?([^";]+)"?/
              );

            if (
              utf8Match?.[1]
            ) {
              try {
                fileName =
                  decodeURIComponent(
                    utf8Match[1]
                  );
              } catch {
                fileName =
                  utf8Match[1];
              }
            } else if (
              normalMatch?.[1]
            ) {
              fileName =
                normalMatch[1];
            }
          }

          const pdfBlob =
            new Blob(
              [
                generatedResponse.data,
              ],
              {
                type:
                  "application/pdf",
              }
            );

          /*
           * 2. Convert generated PDF Blob to File.
           */

          const generatedFile =
            new File(
              [
                pdfBlob,
              ],
              fileName,
              {
                type:
                  "application/pdf",
              }
            );

          /*
           * 3. Send generated PDF to the existing
           *    /resume/analyze endpoint.
           *
           * That existing endpoint already:
           * - analyzes the CV
           * - stores the PDF in GridFS
           * - creates ResumeAnalysis
           * - creates ResumeProfile
           * - puts it into resume history
           */

          const formData =
            new FormData();

          formData.append(
            "resume",
            generatedFile,
            generatedFile.name
          );

          const analysisResponse =
            await apiClient.post<ResumeAnalysisApiResponse>(
              "/resume/analyze",
              formData
            );

          const analysisId =
            analysisResponse.data
              .data
              ?.analysis
              ?.analysisId ??
            analysisResponse.data
              .data
              ?.analysis
              ?._id;

          if (
            !analysisId
          ) {
            throw new Error(
              analysisResponse.data
                .message ||
                "Improved CV was generated, but its analysis could not be opened."
            );
          }

          /*
           * 4. Go directly to the existing analysis page.
           */

          navigate(
            `/dashboard/resume-analysis?analysisId=${encodeURIComponent(
              analysisId
            )}&jobId=${encodeURIComponent(
              jobId
            )}`
          );
        } catch (
          err: any
        ) {
          console.error(
            "Improved CV generation/analysis error:",
            err
          );

          let message =
            "Could not generate and analyze the improved CV.";

          const responseData =
            err?.response
              ?.data;

          if (
            responseData instanceof
            Blob
          ) {
            try {
              const errorText =
                await responseData.text();

              const parsed =
                JSON.parse(
                  errorText
                );

              if (
                typeof parsed
                  ?.message ===
                "string"
              ) {
                message =
                  parsed.message;
              }
            } catch {
              // Keep default message.
            }
          } else if (
            typeof responseData
              ?.message ===
            "string"
          ) {
            message =
              responseData.message;
          } else if (
            typeof err
              ?.message ===
            "string"
          ) {
            message =
              err.message;
          }

          setGenerateError(
            message
          );
        } finally {
          setGenerating(
            false
          );
        }
      };

    /* =====================================================
       CHECK PROFILE BEFORE GENERATING
    ===================================================== */

    const handleGenerateCV =
      async () => {
        if (!jobId) {
          setGenerateError(
            "Job ID is missing."
          );

          return;
        }

        try {
          setCheckingProfile(
            true
          );

          setGenerateError(
            ""
          );

          const response =
            await apiClient.get<ResumeCompletenessResponse>(
              "/resume-profile/completeness"
            );

          if (
            !response.data
              .success
          ) {
            throw new Error(
              response.data
                .message ||
                "Could not check your CV profile."
            );
          }

          const profileData =
            response.data
              .data;

          setProfileCompletenessData(
            profileData
          );

          if (
            profileData
              .completeness
              .canGenerateCV
          ) {
            await generateAndAnalyzeCV();

            return;
          }

          setProfileModalOpen(
            true
          );
        } catch (
          err: any
        ) {
          console.error(
            "Resume profile check error:",
            err
          );

          setGenerateError(
            err?.response
              ?.data
              ?.message ||
              err?.message ||
              "Could not check your CV information."
          );
        } finally {
          setCheckingProfile(
            false
          );
        }
      };

    /* =====================================================
       PROFILE COMPLETED
    ===================================================== */

    const handleProfileReady =
      async () => {
        setProfileModalOpen(
          false
        );

        setProfileCompletenessData(
          null
        );

        await generateAndAnalyzeCV();
      };

    /* =====================================================
       FORMAT HELPERS
    ===================================================== */

    const formatPriority =
      (
        priority:
          PriorityLevel
      ) => {
        return (
          priority
            .charAt(0)
            .toUpperCase() +
          priority.slice(
            1
          )
        );
      };

    const formatSection =
      (
        section:
          OptimizationSection
      ) => {
        const labels: Record<
          OptimizationSection,
          string
        > = {
          summary:
            "Professional Summary",

          skills:
            "Skills",

          experience:
            "Experience",

          projects:
            "Projects",

          keywords:
            "Keywords",

          education:
            "Education",

          ats:
            "ATS",
        };

        return labels[
          section
        ];
      };

    const getStatusLabel =
      (
        status:
          SectionStatus
      ) => {
        if (
          status ===
          "strong"
        ) {
          return "Strong";
        }

        if (
          status ===
          "needs-improvement"
        ) {
          return "Needs Improvement";
        }

        return "Weak";
      };

    const getMatchLabel =
      (
        level:
          MatchLevel
      ) => {
        if (
          level ===
          "strong"
        ) {
          return "Strong Match";
        }

        if (
          level ===
          "good"
        ) {
          return "Good Match";
        }

        if (
          level ===
          "partial"
        ) {
          return "Partial Match";
        }

        return "Low Match";
      };

    /* =====================================================
       LOADING
    ===================================================== */

    if (
      loading
    ) {
      return (
        <div className="cv-optimizer-page">
          <div className="cv-optimizer-loading">
            <div className="cv-optimizer-spinner" />

            <h2>
              Preparing your CV
            </h2>

            <p>
              InterviewIQ is
              comparing your CV,
              target job, verified
              skills and professional
              resume reference.
            </p>
          </div>
        </div>
      );
    }

    /* =====================================================
       ERROR
    ===================================================== */

    if (
      error ||
      !data ||
      !optimization
    ) {
      return (
        <div className="cv-optimizer-page">
          <button
            type="button"
            className="cv-optimizer-back"
            onClick={() =>
              navigate(
                jobId
                  ? `/dashboard/jobs/${jobId}`
                  : "/dashboard/jobs"
              )
            }
          >
            <FiArrowLeft />

            Back
          </button>

          <div className="cv-optimizer-error">
            <FiAlertCircle />

            <h2>
              CV optimization
              could not be loaded
            </h2>

            <p>
              {error ||
                "Something went wrong."}
            </p>
          </div>
        </div>
      );
    }

    /* =====================================================
       PAGE
    ===================================================== */

    return (
      <div className="cv-optimizer-page">
        <button
          type="button"
          className="cv-optimizer-back"
          onClick={() =>
            navigate(
              `/dashboard/jobs/${jobId}`
            )
          }
        >
          <FiArrowLeft />

          Back to job
        </button>

        {/* =================================================
            HERO
        ================================================= */}

        <section className="cv-optimizer-hero">
          <div className="cv-optimizer-hero-main">
            <div className="cv-optimizer-hero-icon">
              <FiFileText />
            </div>

            <div className="cv-optimizer-hero-text">
              <span className="cv-optimizer-eyebrow">
                CV OPTIMIZATION
              </span>

              <h1>
                Improve your CV
                for{" "}
                {
                  data.job
                    .title
                }
              </h1>

              <p>
                Tailored for{" "}
                <strong>
                  {
                    data.job
                      .company
                  }
                </strong>
                . InterviewIQ is
                using your current
                resume, job
                requirements,
                platform-verified
                skills and
                professional resume
                references.
              </p>
            </div>
          </div>

          <div className="cv-optimizer-hero-score">
            <div>
              <span>
                Job Match
              </span>

              <strong>
                {
                  optimization
                    .currentJobMatchScore
                }
                %
              </strong>

              <small
                className={
                  optimization
                    .matchLevel
                }
              >
                {getMatchLabel(
                  optimization
                    .matchLevel
                )}
              </small>
            </div>

            <div>
              <span>
                Current CV
              </span>

              <strong>
                {
                  optimization
                    .currentResumeScore
                }
              </strong>

              <small>
                Resume Score
              </small>
            </div>
          </div>
        </section>

        {/* =================================================
            OVERVIEW
        ================================================= */}

        <section className="cv-optimizer-overview">
          <article className="cv-overview-card">
            <div className="cv-overview-icon">
              <FiBriefcase />
            </div>

            <div>
              <span>
                Target Job
              </span>

              <strong>
                {
                  data.job
                    .title
                }
              </strong>

              <small>
                {
                  data.job
                    .company
                }
              </small>
            </div>
          </article>

          <article className="cv-overview-card">
            <div className="cv-overview-icon">
              <FiLayers />
            </div>

            <div>
              <span>
                Professional Reference
              </span>

              <strong>
                {optimization
                  .templateUsed
                  ?.displayName ||
                  "General Resume"}
              </strong>

              <small>
                {optimization
                  .templateUsed
                  ? `${optimization.templateUsed.matchScore}% template match`
                  : "No template selected"}
              </small>
            </div>
          </article>

          <article className="cv-overview-card">
            <div className="cv-overview-icon">
              <FiCheckCircle />
            </div>

            <div>
              <span>
                Matched Skills
              </span>

              <strong>
                {
                  optimization
                    .matchedSkills
                    .length
                }
              </strong>

              <small>
                {
                  optimization
                    .evidenceSummary
                    .totalJobSkills
                }{" "}
                required by job
              </small>
            </div>
          </article>

          <article className="cv-overview-card">
            <div className="cv-overview-icon">
              <FiAward />
            </div>

            <div>
              <span>
                Verified Skills
              </span>

              <strong>
                {
                  optimization
                    .platformVerifiedSkills
                    .length
                }
              </strong>

              <small>
                InterviewIQ
                validated
              </small>
            </div>
          </article>
        </section>

        {/* =================================================
            MAIN LAYOUT
        ================================================= */}

        <div className="cv-optimizer-layout">
          <main className="cv-optimizer-main">

            {/* PRIORITIES */}

            <section className="cv-optimizer-card">
              <div className="cv-card-heading">
                <div className="cv-card-heading-icon">
                  <FiZap />
                </div>

                <div>
                  <span className="cv-optimizer-eyebrow">
                    TOP PRIORITIES
                  </span>

                  <h2>
                    What to improve
                    first
                  </h2>
                </div>
              </div>

              <div className="priority-actions">
                {optimization
                  .priorityActions
                  .map(
                    (
                      action,
                      index
                    ) => (
                      <article
                        className={`priority-action ${action.priority}`}
                        key={`${action.title}-${index}`}
                      >
                        <div className="priority-action-top">
                          <span
                            className={`priority-badge ${action.priority}`}
                          >
                            {formatPriority(
                              action.priority
                            )}
                          </span>

                          <h3>
                            {
                              action
                                .title
                            }
                          </h3>
                        </div>

                        <p>
                          {
                            action
                              .description
                          }
                        </p>
                      </article>
                    )
                  )}
              </div>
            </section>

            {/* SUMMARY */}

            <section className="cv-optimizer-card">
              <div className="cv-card-heading">
                <div className="cv-card-heading-icon">
                  <FiFileText />
                </div>

                <div>
                  <span className="cv-optimizer-eyebrow">
                    RECOMMENDED
                    SUMMARY
                  </span>

                  <h2>
                    Professional
                    Summary
                  </h2>
                </div>
              </div>

              <div className="recommended-summary">
                <p>
                  {
                    optimization
                      .suggestedProfessionalSummary
                  }
                </p>
              </div>
            </section>

            {/* SKILLS */}

            <section className="cv-optimizer-card">
              <div className="cv-card-heading">
                <div className="cv-card-heading-icon">
                  <FiTarget />
                </div>

                <div>
                  <span className="cv-optimizer-eyebrow">
                    ROLE-RELEVANT
                    SKILLS
                  </span>

                  <h2>
                    Skills to
                    emphasize
                  </h2>
                </div>
              </div>

              <div className="cv-skill-group">
                <h3>
                  Suggested Skills
                </h3>

                {optimization
                  .suggestedSkills
                  .length >
                0 ? (
                  <div className="cv-tag-list suggested">
                    {optimization
                      .suggestedSkills
                      .map(
                        (
                          skill
                        ) => (
                          <span
                            key={
                              skill
                            }
                          >
                            {
                              skill
                            }
                          </span>
                        )
                      )}
                  </div>
                ) : (
                  <p className="cv-empty-text">
                    No additional
                    supported skills
                    need to be
                    emphasized.
                  </p>
                )}
              </div>

              <div className="cv-skill-group">
                <h3>
                  Platform Verified
                </h3>

                {optimization
                  .platformVerifiedSkills
                  .length >
                0 ? (
                  <div className="cv-tag-list verified">
                    {optimization
                      .platformVerifiedSkills
                      .map(
                        (
                          skill
                        ) => (
                          <span
                            key={
                              skill
                            }
                          >
                            <FiCheckCircle />

                            {
                              skill
                            }
                          </span>
                        )
                      )}
                  </div>
                ) : (
                  <div className="cv-info-box">
                    <FiAlertCircle />

                    <p>
                      No skills have
                      enough
                      InterviewIQ
                      assessment
                      evidence yet.
                      Verified skills
                      will appear
                      here as you
                      complete more
                      interviews and
                      assessments.
                    </p>
                  </div>
                )}
              </div>

              <div className="cv-skill-group">
                <h3>
                  Missing Job Skills
                </h3>

                {optimization
                  .missingSkills
                  .length >
                0 ? (
                  <div className="cv-tag-list missing">
                    {optimization
                      .missingSkills
                      .map(
                        (
                          skill
                        ) => (
                          <span
                            key={
                              skill
                            }
                          >
                            <FiAlertCircle />

                            {
                              skill
                            }
                          </span>
                        )
                      )}
                  </div>
                ) : (
                  <div className="cv-success-box">
                    <FiCheckCircle />

                    <p>
                      No missing
                      required skills
                      were detected
                      for this job.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* EXPERIENCE */}

            <section className="cv-optimizer-card">
              <div className="cv-card-heading">
                <div className="cv-card-heading-icon">
                  <FiBriefcase />
                </div>

                <div>
                  <span className="cv-optimizer-eyebrow">
                    EXPERIENCE
                  </span>

                  <h2>
                    Experience
                    Improvements
                  </h2>
                </div>
              </div>

              <ul className="cv-recommendation-list">
                {optimization
                  .experienceSuggestions
                  .map(
                    (
                      suggestion,
                      index
                    ) => (
                      <li
                        key={`${suggestion}-${index}`}
                      >
                        <FiCheckCircle />

                        <span>
                          {
                            suggestion
                          }
                        </span>
                      </li>
                    )
                  )}
              </ul>
            </section>

            {/* PROJECTS */}

            <section className="cv-optimizer-card">
              <div className="cv-card-heading">
                <div className="cv-card-heading-icon">
                  <FiBookOpen />
                </div>

                <div>
                  <span className="cv-optimizer-eyebrow">
                    PROJECTS
                  </span>

                  <h2>
                    Project
                    Improvements
                  </h2>
                </div>
              </div>

              <ul className="cv-recommendation-list">
                {optimization
                  .projectSuggestions
                  .map(
                    (
                      suggestion,
                      index
                    ) => (
                      <li
                        key={`${suggestion}-${index}`}
                      >
                        <FiCheckCircle />

                        <span>
                          {
                            suggestion
                          }
                        </span>
                      </li>
                    )
                  )}
              </ul>
            </section>

            {/* ATS */}

            <section className="cv-optimizer-card">
              <div className="cv-card-heading">
                <div className="cv-card-heading-icon">
                  <FiTrendingUp />
                </div>

                <div>
                  <span className="cv-optimizer-eyebrow">
                    ATS
                    OPTIMIZATION
                  </span>

                  <h2>
                    Keywords &
                    Structure
                  </h2>
                </div>
              </div>

              <div className="cv-skill-group">
                <h3>
                  Recommended
                  Keywords
                </h3>

                <div className="cv-tag-list keyword">
                  {optimization
                    .recommendedKeywords
                    .map(
                      (
                        keyword
                      ) => (
                        <span
                          key={
                            keyword
                          }
                        >
                          {
                            keyword
                          }
                        </span>
                      )
                    )}
                </div>
              </div>

              <ul className="cv-recommendation-list">
                {optimization
                  .atsSuggestions
                  .map(
                    (
                      suggestion,
                      index
                    ) => (
                      <li
                        key={`${suggestion}-${index}`}
                      >
                        <FiCheckCircle />

                        <span>
                          {
                            suggestion
                          }
                        </span>
                      </li>
                    )
                  )}
              </ul>
            </section>

            {/* FORMATTING */}

            <section className="cv-optimizer-card">
              <div className="cv-card-heading">
                <div className="cv-card-heading-icon">
                  <FiLayers />
                </div>

                <div>
                  <span className="cv-optimizer-eyebrow">
                    FORMATTING
                  </span>

                  <h2>
                    Resume Structure
                  </h2>
                </div>
              </div>

              <ul className="cv-recommendation-list">
                {optimization
                  .formattingSuggestions
                  .map(
                    (
                      suggestion,
                      index
                    ) => (
                      <li
                        key={`${suggestion}-${index}`}
                      >
                        <FiCheckCircle />

                        <span>
                          {
                            suggestion
                          }
                        </span>
                      </li>
                    )
                  )}
              </ul>
            </section>
          </main>

          {/* =================================================
              SIDEBAR
          ================================================= */}

          <aside className="cv-optimizer-sidebar">

            {/* SCORES */}

            <section className="cv-optimizer-side-card">
              <span className="cv-optimizer-eyebrow">
                SECTION SCORES
              </span>

              <h3>
                Resume Health
              </h3>

              <div className="section-score-list">
                {optimization
                  .sectionsToImprove
                  .map(
                    (
                      section
                    ) => (
                      <div
                        className="section-score-item"
                        key={
                          section
                            .section
                        }
                      >
                        <div className="section-score-top">
                          <div>
                            <span>
                              {formatSection(
                                section
                                  .section
                              )}
                            </span>

                            <small
                              className={
                                section
                                  .status
                              }
                            >
                              {getStatusLabel(
                                section
                                  .status
                              )}
                            </small>
                          </div>

                          <strong>
                            {
                              section
                                .score
                            }
                            %
                          </strong>
                        </div>

                        <div className="section-score-bar">
                          <div
                            className={
                              section
                                .status
                            }
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(
                                  100,
                                  section.score
                                )
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )
                  )}
              </div>
            </section>

            {/* TEMPLATE */}

            {optimization
              .templateUsed && (
              <section className="cv-optimizer-side-card">
                <span className="cv-optimizer-eyebrow">
                  REFERENCE
                  TEMPLATE
                </span>

                <h3>
                  {
                    optimization
                      .templateUsed
                      .displayName
                  }
                </h3>

                <div className="template-score">
                  <strong>
                    {
                      optimization
                        .templateUsed
                        .matchScore
                    }
                    %
                  </strong>

                  <span>
                    relevance
                  </span>
                </div>

                <ul className="template-reasons">
                  {optimization
                    .templateUsed
                    .reasons
                    .map(
                      (
                        reason,
                        index
                      ) => (
                        <li
                          key={`${reason}-${index}`}
                        >
                          <FiCheckCircle />

                          <span>
                            {
                              reason
                            }
                          </span>
                        </li>
                      )
                    )}
                </ul>
              </section>
            )}

            {/* EVIDENCE */}

            <section className="cv-optimizer-side-card">
              <span className="cv-optimizer-eyebrow">
                EVIDENCE
              </span>

              <h3>
                Data Used
              </h3>

              <div className="evidence-grid">
                <div>
                  <strong>
                    {
                      optimization
                        .evidenceSummary
                        .totalResumeSkills
                    }
                  </strong>

                  <span>
                    Resume
                    Skills
                  </span>
                </div>

                <div>
                  <strong>
                    {
                      optimization
                        .evidenceSummary
                        .totalValidatedSkills
                    }
                  </strong>

                  <span>
                    Verified
                    Skills
                  </span>
                </div>

                <div>
                  <strong>
                    {
                      optimization
                        .evidenceSummary
                        .matchedJobSkills
                    }
                  </strong>

                  <span>
                    Matched Job
                    Skills
                  </span>
                </div>

                <div>
                  <strong>
                    {
                      optimization
                        .evidenceSummary
                        .missingJobSkills
                    }
                  </strong>

                  <span>
                    Missing
                    Skills
                  </span>
                </div>
              </div>
            </section>

            {/* GENERATE */}

            <section className="cv-generate-card">
              <div className="cv-generate-icon">
                <FiZap />
              </div>

              <h3>
                Ready to create
                the improved CV?
              </h3>

              <p>
                InterviewIQ will use
                your real resume
                data, verified
                skills, target job
                requirements and
                professional
                reference.
              </p>

              <button
                type="button"
                className="generate-cv-button"
                onClick={
                  handleGenerateCV
                }
                disabled={
                  generating ||
                  checkingProfile
                }
              >
                <FiFileText />

                {checkingProfile
                  ? "Checking CV..."
                  : generating
                    ? "Generating PDF..."
                    : "Generate Improved CV"}
              </button>

              <small>
                InterviewIQ will
                generate an ATS-friendly
                PDF using supported
                information from your
                profile.
              </small>

              {generateError && (
                <div className="cv-generate-error">
                  <FiAlertCircle />

                  <span>
                    {
                      generateError
                    }
                  </span>
                </div>
              )}
            </section>
          </aside>
        </div>

        {/* =================================================
            DISCLAIMER
        ================================================= */}

        <div className="cv-disclaimer">
          <FiAlertCircle />

          <p>
            {
              optimization
                .disclaimer
            }
          </p>
        </div>

        <TypedResumeProfileCompletenessModal
          open={
            profileModalOpen
          }
          initialData={
            profileCompletenessData
          }
          onClose={() => {
            setProfileModalOpen(
              false
            );
          }}
          onReady={
            handleProfileReady
          }
        />
      </div>
    );
  };

export default cvOptimizerPage;