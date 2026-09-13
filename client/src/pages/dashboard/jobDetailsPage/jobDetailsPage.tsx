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
  FiMapPin,
  FiBriefcase,
  FiCheckCircle,
  FiAlertCircle,
  FiDollarSign,
  FiTarget,
  FiAward,
  FiFileText,
  FiTrendingUp,
  FiExternalLink,
} from "react-icons/fi";

import apiClient from "../../../api/apiClient";

import "./jobDetailsPage.scss";

/* =========================================================
   TYPES
========================================================= */

type MatchLevel =
  | "strong"
  | "good"
  | "partial"
  | "low";

type SalaryPeriod =
  | "hour"
  | "day"
  | "week"
  | "month"
  | "year"
  | "unknown";

interface JobMatch {
  matchScore: number;

  matchLevel: MatchLevel;

  matchLabel: string;

  matchedSkills: string[];

  missingSkills: string[];

  matchedKeywords: string[];

  missingKeywords: string[];

  strengths: string[];

  improvementAreas: string[];

  breakdown: {
    skills: number;

    roleRelevance: number;

    experience: number;

    evidenceConfidence: number;

    keywords: number;

    education: number;
  };
}

interface Job {
  _id: string;

  title: string;

  company: string;

  location?: string;

  remoteType:
    | "onsite"
    | "hybrid"
    | "remote";

  employmentType:
    | "full-time"
    | "part-time"
    | "contract"
    | "internship";

  experienceMin: number;

  experienceMax: number | null;

  description: string;

  responsibilities: string[];

  requirements: string[];

  preferredQualifications: string[];

  skills: string[];

  keywords: string[];

  education?: string[];

  salary: number;

  salaryMin?: number;

  salaryMax?: number;

  salaryCurrency?: string;

  salaryPeriod?: SalaryPeriod;

  salaryIsPredicted?: boolean;

  source?: string;

  externalId?: string;

  externalUrl?: string;

  applyUrl?: string;

  isActive?: boolean;

  postedAt?: string;

  match: JobMatch | null;
}

interface JobDetailsResponse {
  success: boolean;

  hasResume: boolean;

  hasCareerProfile?: boolean;

  message?: string;

  resume?: {
    id: string;

    fileName: string;

    overallScore: number;

    analyzedAt?: string;
  };

  data: {
    job: Job;
  };
}

/* =========================================================
   HELPERS
========================================================= */

const formatValue = (
  value?: string
): string => {
  if (
    !value
  ) {
    return "Not specified";
  }

  return value
    .replace(
      /([a-z])([A-Z])/g,
      "$1 $2"
    )
    .replace(
      /[_-]+/g,
      " "
    )
    .split(
      " "
    )
    .filter(
      Boolean
    )
    .map(
      (
        word
      ) =>
        word
          .charAt(
            0
          )
          .toUpperCase() +
        word
          .slice(
            1
          )
    )
    .join(
      " "
    );
};

const formatExperience = (
  min:
    number,
  max:
    number | null
): string => {
  if (
    max ===
    null
  ) {
    return `${min}+ years`;
  }

  if (
    min ===
    max
  ) {
    return `${min} ${
      min ===
      1
        ? "year"
        : "years"
    }`;
  }

  return `${min}–${max} years`;
};

const getCurrencySymbol = (
  currency?: string
): string => {
  switch (
    currency
      ?.toUpperCase()
  ) {
    case "USD":
      return "$";

    case "EUR":
      return "€";

    case "GBP":
      return "£";

    case "CAD":
      return "CA$";

    case "AUD":
      return "A$";

    default:
      return currency
        ? `${currency} `
        : "$";
  }
};

const getSalaryPeriodLabel = (
  period?: SalaryPeriod
): string => {
  switch (
    period
  ) {
    case "hour":
      return "hour";

    case "day":
      return "day";

    case "week":
      return "week";

    case "month":
      return "month";

    case "year":
      return "year";

    case "unknown":
    default:
      return "";
  }
};

const formatSalary = (
  job:
    Job
): string => {
  const salaryMin =
    typeof job.salaryMin ===
      "number"
      ? job.salaryMin
      : undefined;

  const salaryMax =
    typeof job.salaryMax ===
      "number"
      ? job.salaryMax
      : undefined;

  const fallback =
    typeof job.salary ===
      "number" &&
    job.salary >
      0
      ? job.salary
      : undefined;

  const symbol =
    getCurrencySymbol(
      job.salaryCurrency
    );

  const period =
    getSalaryPeriodLabel(
      job.salaryPeriod
    );

  if (
    salaryMin !==
      undefined &&
    salaryMax !==
      undefined &&
    salaryMin >
      0 &&
    salaryMax >
      0
  ) {
    const range =
      salaryMin ===
        salaryMax
        ? `${symbol}${salaryMax.toLocaleString(
            "en-US"
          )}`
        : `${symbol}${salaryMin.toLocaleString(
            "en-US"
          )} – ${symbol}${salaryMax.toLocaleString(
            "en-US"
          )}`;

    return period
      ? `${range} / ${period}`
      : range;
  }

  if (
    fallback
  ) {
    const value =
      `${symbol}${fallback.toLocaleString(
        "en-US"
      )}`;

    return period
      ? `${value} / ${period}`
      : value;
  }

  return "Not specified";
};

const getSafeScore = (
  score?: number
): number => {
  if (
    typeof score !==
    "number"
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      score
    )
  );
};

/* =========================================================
   COMPONENT
========================================================= */

const JobDetailsPage:
  React.FC = () => {
    const navigate =
      useNavigate();

    const {
      jobId,
    } =
      useParams<{
        jobId:
          string;
      }>();

    const [
      job,
      setJob,
    ] =
      useState<
        Job |
        null
      >(
        null
      );

    const [
      loading,
      setLoading,
    ] =
      useState(
        true
      );

    const [
      error,
      setError,
    ] =
      useState(
        ""
      );

    useEffect(
      () => {
        const fetchJob =
          async () => {
            if (
              !jobId
            ) {
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
                await apiClient.get<
                  JobDetailsResponse
                >(
                  `/jobs/${jobId}`
                );

              setJob(
                response
                  .data
                  .data
                  .job
              );
            } catch (
              err:
                any
            ) {
              setError(
                err
                  ?.response
                  ?.data
                  ?.message ||
                "Could not load job details."
              );
            } finally {
              setLoading(
                false
              );
            }
          };

        void fetchJob();
      },
      [
        jobId,
      ]
    );

    if (
      loading
    ) {
      return (
        <div className="job-details-page">
          <div className="job-details-loading">
            <div className="job-details-spinner" />

            <h2>
              Loading job details
            </h2>

            <p>
              Preparing your job compatibility analysis...
            </p>
          </div>
        </div>
      );
    }

    if (
      error ||
      !job
    ) {
      return (
        <div className="job-details-page">
          <button
            type="button"
            className="job-back-button"
            onClick={() =>
              navigate(
                "/dashboard/jobs"
              )
            }
          >
            <FiArrowLeft />

            Back to jobs
          </button>

          <div className="job-details-error">
            <FiAlertCircle />

            <h2>
              Job could not be loaded
            </h2>

            <p>
              {error ||
                "Job not found."}
            </p>
          </div>
        </div>
      );
    }

    const match =
      job.match;

    const responsibilities =
      job.responsibilities ||
      [];

    const requirements =
      job.requirements ||
      [];

    const preferredQualifications =
      job.preferredQualifications ||
      [];

    const skills =
      job.skills ||
      [];

    const applicationUrl =
      job.applyUrl ||
      job.externalUrl;

    return (
      <div className="job-details-page">
        <button
          type="button"
          className="job-back-button"
          onClick={() =>
            navigate(
              "/dashboard/jobs"
            )
          }
        >
          <FiArrowLeft />

          Back to jobs
        </button>

        <section className="job-details-hero">
          <div className="job-details-company">
            <div className="job-details-logo">
              {job.company
                .charAt(
                  0
                )
                .toUpperCase()}
            </div>

            <div className="job-details-heading">
              <span className="job-details-eyebrow">
                JOB OPPORTUNITY
              </span>

              <h1>
                {job.title}
              </h1>

              <p>
                {job.company}
              </p>

              {job.source && (
                <span className="job-source-badge">
                  {job.source}
                </span>
              )}
            </div>
          </div>

          <div className="job-details-hero-right">
            {match && (
              <div
                className={`job-details-match ${match.matchLevel}`}
              >
                <strong>
                  {match.matchScore}%
                </strong>

                <span>
                  {match.matchLabel}
                </span>
              </div>
            )}

            {applicationUrl && (
              <a
                className="job-apply-button"
                href={
                  applicationUrl
                }
                target="_blank"
                rel="noreferrer"
              >
                Apply Now

                <FiExternalLink />
              </a>
            )}
          </div>
        </section>

        <section className="job-details-meta">
          <div className="job-meta-card">
            <div className="job-meta-icon">
              <FiMapPin />
            </div>

            <div>
              <span>
                Location
              </span>

              <strong>
                {job.location ||
                  "Not specified"}
              </strong>
            </div>
          </div>

          <div className="job-meta-card">
            <div className="job-meta-icon">
              <FiBriefcase />
            </div>

            <div>
              <span>
                Employment
              </span>

              <strong>
                {formatValue(
                  job.employmentType
                )}
              </strong>
            </div>
          </div>

          <div className="job-meta-card">
            <div className="job-meta-icon">
              <FiTarget />
            </div>

            <div>
              <span>
                Work type
              </span>

              <strong>
                {formatValue(
                  job.remoteType
                )}
              </strong>
            </div>
          </div>

          <div className="job-meta-card">
            <div className="job-meta-icon">
              <FiAward />
            </div>

            <div>
              <span>
                Experience
              </span>

              <strong>
                {formatExperience(
                  job.experienceMin,
                  job.experienceMax
                )}
              </strong>
            </div>
          </div>

          <div className="job-meta-card">
            <div className="job-meta-icon">
              <FiDollarSign />
            </div>

            <div>
              <span>
                Salary
              </span>

              <strong>
                {formatSalary(
                  job
                )}
              </strong>

              {job.salaryIsPredicted && (
                <small className="salary-estimate-label">
                  Estimated salary
                </small>
              )}
            </div>
          </div>
        </section>

        <div className="job-details-layout">
          <main className="job-details-main">
            <article className="job-description-document">
              <section className="job-document-section job-description-intro">
                <h2>
                  Job Description
                </h2>

                <p>
                  {job.description}
                </p>
              </section>

              <section className="job-document-section">
                <h3>
                  Responsibilities
                </h3>

                {responsibilities.length >
                0 ? (
                  <ul>
                    {responsibilities.map(
                      (
                        responsibility,
                        index
                      ) => (
                        <li
                          key={`${responsibility}-${index}`}
                        >
                          {responsibility}
                        </li>
                      )
                    )}
                  </ul>
                ) : (
                  <p className="document-empty-text">
                    No responsibilities specified.
                  </p>
                )}
              </section>

              <section className="job-document-section">
                <h3>
                  Minimum Qualifications
                </h3>

                {requirements.length >
                0 ? (
                  <ul>
                    {requirements.map(
                      (
                        requirement,
                        index
                      ) => (
                        <li
                          key={`${requirement}-${index}`}
                        >
                          {requirement}
                        </li>
                      )
                    )}
                  </ul>
                ) : (
                  <p className="document-empty-text">
                    No minimum qualifications specified.
                  </p>
                )}
              </section>

              <section className="job-document-section">
                <h3>
                  Preferred Qualifications
                </h3>

                {preferredQualifications.length >
                0 ? (
                  <ul>
                    {preferredQualifications.map(
                      (
                        qualification,
                        index
                      ) => (
                        <li
                          key={`${qualification}-${index}`}
                        >
                          {qualification}
                        </li>
                      )
                    )}
                  </ul>
                ) : (
                  <p className="document-empty-text">
                    No preferred qualifications specified.
                  </p>
                )}
              </section>

              <section className="job-document-section job-skills-section">
                <h3>
                  Required Skills
                </h3>

                {skills.length >
                0 ? (
                  <div className="job-details-skills">
                    {skills.map(
                      (
                        skill
                      ) => {
                        const matched =
                          match
                            ?.matchedSkills
                            ?.some(
                              (
                                matchedSkill
                              ) =>
                                matchedSkill
                                  .toLowerCase() ===
                                skill
                                  .toLowerCase()
                            );

                        const missing =
                          match
                            ?.missingSkills
                            ?.some(
                              (
                                missingSkill
                              ) =>
                                missingSkill
                                  .toLowerCase() ===
                                skill
                                  .toLowerCase()
                            );

                        return (
                          <span
                            key={
                              skill
                            }
                            className={
                              matched
                                ? "matched"
                                : missing
                                  ? "missing"
                                  : ""
                            }
                          >
                            {skill}
                          </span>
                        );
                      }
                    )}
                  </div>
                ) : (
                  <p className="document-empty-text">
                    No specific skills listed.
                  </p>
                )}
              </section>
            </article>
          </main>

          <aside className="job-details-sidebar">
            {match ? (
              <>
                <section className="job-side-card match-overview-card">
                  <span className="side-eyebrow">
                    YOUR MATCH
                  </span>

                  <div
                    className={`big-match-score ${match.matchLevel}`}
                  >
                    <strong>
                      {match.matchScore}%
                    </strong>

                    <span>
                      {match.matchLabel}
                    </span>
                  </div>
                </section>

                <section className="job-side-card">
                  <div className="side-card-heading">
                    <div className="side-heading-icon">
                      <FiTrendingUp />
                    </div>

                    <div>
                      <span className="side-eyebrow">
                        SCORE BREAKDOWN
                      </span>

                      <h3>
                        Compatibility
                      </h3>
                    </div>
                  </div>

                  <div className="score-breakdown">
                    {Object.entries(
                      match.breakdown
                    ).map(
                      (
                        [
                          label,
                          score,
                        ]
                      ) => {
                        const safeScore =
                          getSafeScore(
                            score
                          );

                        return (
                          <div
                            className="score-row"
                            key={
                              label
                            }
                          >
                            <div className="score-row-top">
                              <span>
                                {formatValue(
                                  label
                                )}
                              </span>

                              <strong>
                                {safeScore}%
                              </strong>
                            </div>

                            <div className="score-bar">
                              <div
                                style={{
                                  width:
                                    `${safeScore}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </section>

                <section className="job-side-card">
                  <div className="side-card-heading">
                    <div className="side-heading-icon success">
                      <FiCheckCircle />
                    </div>

                    <div>
                      <span className="side-eyebrow">
                        YOUR ADVANTAGES
                      </span>

                      <h3>
                        Matched Skills
                      </h3>
                    </div>
                  </div>

                  {match
                    .matchedSkills
                    .length >
                  0 ? (
                    <div className="side-skills matched">
                      {match
                        .matchedSkills
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

                              {skill}
                            </span>
                          )
                        )}
                    </div>
                  ) : (
                    <p className="side-empty-text">
                      No matched skills were detected yet.
                    </p>
                  )}
                </section>

                <section className="job-side-card">
                  <div className="side-card-heading">
                    <div className="side-heading-icon warning">
                      <FiAlertCircle />
                    </div>

                    <div>
                      <span className="side-eyebrow">
                        SKILL GAPS
                      </span>

                      <h3>
                        Missing Skills
                      </h3>
                    </div>
                  </div>

                  {match
                    .missingSkills
                    .length >
                  0 ? (
                    <div className="side-skills missing">
                      {match
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

                              {skill}
                            </span>
                          )
                        )}
                    </div>
                  ) : (
                    <div className="all-skills-match">
                      <FiCheckCircle />

                      <span>
                        No missing skills detected
                      </span>
                    </div>
                  )}
                </section>

                {match
                  .strengths
                  .length >
                  0 && (
                  <section className="job-side-card">
                    <span className="side-eyebrow">
                      WHY IT MATCHES
                    </span>

                    <h3 className="simple-side-title">
                      Your Strengths
                    </h3>

                    <ul className="analysis-list strengths">
                      {match
                        .strengths
                        .map(
                          (
                            strength,
                            index
                          ) => (
                            <li
                              key={`${strength}-${index}`}
                            >
                              <FiCheckCircle />

                              <span>
                                {strength}
                              </span>
                            </li>
                          )
                        )}
                    </ul>
                  </section>
                )}

                <section className="job-side-card improve-card">
                  <span className="side-eyebrow">
                    IMPROVE YOUR MATCH
                  </span>

                  <h3 className="simple-side-title">
                    Optimize Your CV
                  </h3>

                  {match
                    .improvementAreas
                    .length >
                    0 && (
                    <ul className="analysis-list improvements">
                      {match
                        .improvementAreas
                        .map(
                          (
                            improvement,
                            index
                          ) => (
                            <li
                              key={`${improvement}-${index}`}
                            >
                              <FiTarget />

                              <span>
                                {improvement}
                              </span>
                            </li>
                          )
                        )}
                    </ul>
                  )}

                  <button
                    type="button"
                    className="optimize-resume-button"
                    onClick={() => {
                      navigate(
                        `/dashboard/jobs/${jobId}/improve-cv`
                      );
                    }}
                  >
                    <FiFileText />

                    Improve CV for this job
                  </button>
                </section>
              </>
            ) : (
              <section className="job-side-card resume-required-card">
                <div className="resume-required-icon">
                  <FiFileText />
                </div>

                <h3>
                  Resume required
                </h3>

                <p>
                  Analyze your resume first to see how compatible you are with this job.
                </p>

                <button
                  type="button"
                  className="optimize-resume-button"
                  onClick={() =>
                    navigate(
                      "/dashboard/resume-analysis"
                    )
                  }
                >
                  Analyze Resume
                </button>
              </section>
            )}
          </aside>
        </div>
      </div>
    );
  };

export default JobDetailsPage;