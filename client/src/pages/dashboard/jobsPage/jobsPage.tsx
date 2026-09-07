import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  FiSearch,
  FiMapPin,
  FiBriefcase,
  FiCheckCircle,
  FiAlertCircle,
  FiArrowRight,
  FiFileText,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiZap,
} from "react-icons/fi";

import apiClient from "../../../api/apiClient";

import "./jobsPage.scss";

import ImproveCVWizard, {
  type ImproveCVWizardData,
} from "../../../components/resume/ImproveCVWizard";

type MatchLevel =
  | "strong"
  | "good"
  | "partial"
  | "low";

type ExperienceFilter =
  | "all"
  | "0-1"
  | "1-2"
  | "2-4"
  | "4-6"
  | "6+";

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

    keywords: number;

    experience: number;

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

  source?: string;

  isActive?: boolean;

  postedAt?: string;

  match: JobMatch | null;
}

interface JobsApiResponse {
  success: boolean;

  hasResume: boolean;

  message?: string;

  resume?: {
    id: string;

    fileName: string;

    overallScore: number;

    analyzedAt?: string;
  };

  data: {
    jobs: Job[];

    total: number;
  };
}

type MatchFilter =
  | "all"
  | MatchLevel;

const ITEMS_PER_PAGE = 18;

const jobsPage: React.FC = () => {
  const navigate =
    useNavigate();

  const [
    jobs,
    setJobs,
  ] =
    useState<Job[]>([]);

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
    improveError,
    setImproveError,
  ] =
    useState("");

  const [
    improveWizardJob,
    setImproveWizardJob,
  ] =
    useState<Job | null>(
      null
    );

  const [
    hasResume,
    setHasResume,
  ] =
    useState(false);

  const [
    resume,
    setResume,
  ] =
    useState<
      JobsApiResponse["resume"]
    >();

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    matchFilter,
    setMatchFilter,
  ] =
    useState<MatchFilter>(
      "all"
    );

  const [
    workType,
    setWorkType,
  ] =
    useState("all");

  const [
    experienceFilter,
    setExperienceFilter,
  ] =
    useState<ExperienceFilter>(
      "all"
    );

  const [
    currentPage,
    setCurrentPage,
  ] =
    useState(1);

  const fetchJobs =
    async () => {
      try {
        setLoading(true);

        setError("");

        const response =
          await apiClient.get<JobsApiResponse>(
            "/jobs"
          );

        setJobs(
          response.data.data.jobs ||
            []
        );

        setHasResume(
          response.data.hasResume
        );

        setResume(
          response.data.resume
        );
      } catch (err: any) {
        const message =
          err?.response?.data
            ?.message ||
          "Could not load jobs. Please try again.";

        setError(
          message
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  useEffect(() => {
    void fetchJobs();
  }, []);

  const matchesExperienceFilter =
    (
      job: Job
    ): boolean => {
      if (
        experienceFilter ===
        "all"
      ) {
        return true;
      }

      switch (
        experienceFilter
      ) {
        case "0-1":
          return (
            job.experienceMin ===
              0 &&
            job.experienceMax ===
              1
          );

        case "1-2":
          return (
            job.experienceMin ===
              1 &&
            job.experienceMax ===
              2
          );

        case "2-4":
          return (
            job.experienceMin ===
              2 &&
            job.experienceMax ===
              4
          );

        case "4-6":
          return (
            job.experienceMin ===
              4 &&
            job.experienceMax ===
              6
          );

        case "6+":
          return (
            job.experienceMin >=
              6 &&
            job.experienceMax ===
              null
          );

        default:
          return true;
      }
    };

  const filteredJobs =
    useMemo(() => {
      return jobs.filter(
        (job) => {
          const normalizedSearch =
            search
              .trim()
              .toLowerCase();

          const matchesSearch =
            !normalizedSearch ||
            job.title
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            job.company
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            (
              job.location || ""
            )
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            job.skills.some(
              (skill) =>
                skill
                  .toLowerCase()
                  .includes(
                    normalizedSearch
                  )
            );

          const matchesMatchLevel =
            matchFilter ===
              "all" ||
            job.match
              ?.matchLevel ===
              matchFilter;

          const matchesWorkType =
            workType ===
              "all" ||
            job.remoteType ===
              workType;

          const matchesExperience =
            matchesExperienceFilter(
              job
            );

          return (
            matchesSearch &&
            matchesMatchLevel &&
            matchesWorkType &&
            matchesExperience
          );
        }
      );
    }, [
      jobs,
      search,
      matchFilter,
      workType,
      experienceFilter,
    ]);

  useEffect(() => {
    setCurrentPage(
      1
    );
  }, [
    search,
    matchFilter,
    workType,
    experienceFilter,
  ]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredJobs.length /
          ITEMS_PER_PAGE
      )
    );

  useEffect(() => {
    if (
      currentPage >
      totalPages
    ) {
      setCurrentPage(
        totalPages
      );
    }
  }, [
    currentPage,
    totalPages,
  ]);

  const paginatedJobs =
    useMemo(() => {
      const startIndex =
        (
          currentPage -
          1
        ) *
        ITEMS_PER_PAGE;

      const endIndex =
        startIndex +
        ITEMS_PER_PAGE;

      return filteredJobs.slice(
        startIndex,
        endIndex
      );
    }, [
      filteredJobs,
      currentPage,
    ]);

  const strongMatches =
    jobs.filter(
      (job) =>
        job.match
          ?.matchLevel ===
        "strong"
    ).length;

  const goodMatches =
    jobs.filter(
      (job) =>
        job.match
          ?.matchLevel ===
        "good"
    ).length;

  const getMatchClass =
    (
      level?: MatchLevel
    ) => {
      if (!level) {
        return "no-match";
      }

      return level;
    };

  const formatEmploymentType =
    (
      value: string
    ): string => {
      return value
        .split("-")
        .map(
          (word) =>
            word
              .charAt(0)
              .toUpperCase() +
            word.slice(1)
        )
        .join(" ");
    };

  const formatRemoteType =
    (
      value: string
    ): string => {
      return (
        value
          .charAt(0)
          .toUpperCase() +
        value.slice(1)
      );
    };

  const formatExperience =
    (
      min: number,
      max: number | null
    ): string => {
      if (
        max === null
      ) {
        return `${min}+ years`;
      }

      if (
        min === max
      ) {
        return `${min} ${
          min === 1
            ? "year"
            : "years"
        }`;
      }

      return `${min}–${max} years`;
    };

  const handlePreviousPage =
    () => {
      if (
        currentPage > 1
      ) {
        setCurrentPage(
          (
            previousPage
          ) =>
            previousPage -
            1
        );

        window.scrollTo({
          top: 0,

          behavior:
            "smooth",
        });
      }
    };

  const handleNextPage =
    () => {
      if (
        currentPage <
        totalPages
      ) {
        setCurrentPage(
          (
            previousPage
          ) =>
            previousPage +
            1
        );

        window.scrollTo({
          top: 0,

          behavior:
            "smooth",
        });
      }
    };

  const handlePageClick =
    (
      page: number
    ) => {
      setCurrentPage(
        page
      );

      window.scrollTo({
        top: 0,

        behavior:
          "smooth",
      });
    };

  const handleViewDetails =
    (
      jobId: string
    ) => {
      navigate(
        `/dashboard/jobs/${jobId}`
      );
    };

  const handleImproveCV =
    (
      job: Job
    ) => {
      setImproveError(
        ""
      );

      /*
       * IMPORTANT:
       * We no longer generate from the latest saved/analyzed CV.
       *
       * Every improvement session starts with a NEW user-selected PDF.
       * This prevents repeated improvement from degrading data over time.
       */
      setImproveWizardJob(
        job
      );
    };

  const handleImproveWizardReady =
    (
      data:
        ImproveCVWizardData
    ) => {
      /*
       * Phase 1:
       * The wizard now owns a fresh CV + verified user input.
       *
       * In the next backend step we will send exactly this payload
       * to a dedicated "generate-from-input" endpoint.
       *
       * For now we keep it in one place so the old auto-generation
       * pipeline cannot run accidentally.
       */
      console.log(
        "[CV Wizard] Ready for backend generation",
        {
          jobId:
            data.jobId,

          resumeFile:
            data.resumeFile
              .name,

          major:
            data.major,

          optional:
            data.optional,
        }
      );

      setImproveWizardJob(
        null
      );

      setImproveError(
        "CV information collected successfully. The old auto-improvement pipeline has been disabled for this button; the next step is connecting this wizard payload to the new CV builder endpoint."
      );
    };

  if (loading) {
    return (
      <div className="jobs-page">
        <div className="jobs-loading">
          <div className="jobs-loading-spinner" />

          <h2>
            Finding your best
            opportunities
          </h2>

          <p>
            Comparing your resume
            with available jobs...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="jobs-page">
      <section className="jobs-hero">
        <div>
          <span className="jobs-eyebrow">
            SMART JOB MATCHING
          </span>

          <h1>
            Find jobs that match
            your profile
          </h1>

          <p>
            Discover opportunities
            ranked by how well they
            align with your resume,
            skills and experience.
          </p>
        </div>

        <button
          type="button"
          className="refresh-jobs-btn"
          onClick={() =>
            void fetchJobs()
          }
        >
          <FiRefreshCw />

          Refresh jobs
        </button>
      </section>

      {error && (
        <div className="jobs-error">
          <FiAlertCircle />

          <div>
            <strong>
              Could not load jobs
            </strong>

            <span>
              {error}
            </span>
          </div>
        </div>
      )}

      {improveError && (
        <div className="jobs-error">
          <FiAlertCircle />

          <div>
            <strong>
              Could not improve CV
            </strong>

            <span>
              {improveError}
            </span>
          </div>
        </div>
      )}

      <section className="jobs-summary-grid">
        <div className="jobs-summary-card resume-card">
          <div className="summary-icon">
            <FiFileText />
          </div>

          <div>
            <span>
              Resume used
            </span>

            <strong>
              {resume?.fileName ||
                "No resume found"}
            </strong>

            {resume && (
              <small>
                Resume score:{" "}
                {
                  resume.overallScore
                }
                /100
              </small>
            )}
          </div>
        </div>

        <div className="jobs-summary-card">
          <div className="summary-icon">
            <FiBriefcase />
          </div>

          <div>
            <span>
              Jobs analyzed
            </span>

            <strong>
              {jobs.length}
            </strong>

            <small>
              Active opportunities
            </small>
          </div>
        </div>

        <div className="jobs-summary-card">
          <div className="summary-icon">
            <FiCheckCircle />
          </div>

          <div>
            <span>
              Strong matches
            </span>

            <strong>
              {strongMatches}
            </strong>

            <small>
              Best opportunities
              for you
            </small>
          </div>
        </div>

        <div className="jobs-summary-card">
          <div className="summary-icon">
            <FiCheckCircle />
          </div>

          <div>
            <span>
              Good matches
            </span>

            <strong>
              {goodMatches}
            </strong>

            <small>
              Worth considering
            </small>
          </div>
        </div>
      </section>

      {!hasResume && (
        <section className="resume-warning">
          <FiAlertCircle />

          <div>
            <strong>
              Upload your resume to
              unlock personalized
              matching
            </strong>

            <p>
              Jobs are available,
              but match scores
              cannot be calculated
              until your resume has
              been analyzed.
            </p>
          </div>
        </section>
      )}

      <section className="jobs-toolbar">
        <div className="jobs-search">
          <FiSearch />

          <input
            type="text"
            placeholder="Search by role, company, location or skill..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />
        </div>

        <select
          value={
            matchFilter
          }
          onChange={(event) =>
            setMatchFilter(
              event.target
                .value as MatchFilter
            )
          }
        >
          <option value="all">
            All Matches
          </option>

          <option value="strong">
            Strong Match
          </option>

          <option value="good">
            Good Match
          </option>

          <option value="partial">
            Partial Match
          </option>

          <option value="low">
            Low Match
          </option>
        </select>

        <select
          value={
            workType
          }
          onChange={(event) =>
            setWorkType(
              event.target.value
            )
          }
        >
          <option value="all">
            All Work Types
          </option>

          <option value="remote">
            Remote
          </option>

          <option value="hybrid">
            Hybrid
          </option>

          <option value="onsite">
            Onsite
          </option>
        </select>

        <select
          value={
            experienceFilter
          }
          onChange={(event) =>
            setExperienceFilter(
              event.target
                .value as ExperienceFilter
            )
          }
        >
          <option value="all">
            All Experience
          </option>

          <option value="0-1">
            0–1 years
          </option>

          <option value="1-2">
            1–2 years
          </option>

          <option value="2-4">
            2–4 years
          </option>

          <option value="4-6">
            4–6 years
          </option>

          <option value="6+">
            6+ years
          </option>
        </select>
      </section>

      <section className="jobs-results-header">
        <div>
          <span className="jobs-eyebrow">
            RECOMMENDED FOR YOU
          </span>

          <h2>
            {
              filteredJobs.length
            }{" "}
            opportunities found
          </h2>
        </div>

        <span className="jobs-ranked-label">
          Showing{" "}
          {filteredJobs.length ===
          0
            ? 0
            : (
                currentPage -
                1
              ) *
                ITEMS_PER_PAGE +
              1}
          –
          {Math.min(
            currentPage *
              ITEMS_PER_PAGE,
            filteredJobs.length
          )}{" "}
          of{" "}
          {
            filteredJobs.length
          }
        </span>
      </section>

      {filteredJobs.length ===
      0 ? (
        <div className="jobs-empty">
          <FiSearch />

          <h3>
            No jobs found
          </h3>

          <p>
            Try changing your
            filters or search
            keyword.
          </p>
        </div>
      ) : (
        <>
          <section className="jobs-grid">
            {paginatedJobs.map(
              (job) => {
                const match =
                  job.match;

                const visibleSkills =
                  job.skills.slice(
                    0,
                    5
                  );

                return (
                  <article
                    className="job-card"
                    key={job._id}
                  >
                    <div className="job-card-top">
                      <div className="job-main-info">
                        <div className="company-avatar">
                          {job.company
                            .charAt(
                              0
                            )
                            .toUpperCase()}
                        </div>

                        <div className="job-card-title">
                          <h3>
                            {
                              job.title
                            }
                          </h3>

                          <p>
                            {
                              job.company
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="job-meta">
                      <span>
                        <FiMapPin />

                        {job.location ||
                          "Location not specified"}
                      </span>

                      <span>
                        <FiBriefcase />

                        {formatEmploymentType(
                          job.employmentType
                        )}
                      </span>

                      <span>
                        {formatRemoteType(
                          job.remoteType
                        )}
                      </span>

                      <span>
                        {formatExperience(
                          job.experienceMin,
                          job.experienceMax
                        )}
                      </span>
                    </div>

                    <p className="job-description">
                      {
                        job.description
                      }
                    </p>

                    <div className="job-skills">
                      {visibleSkills.map(
                        (
                          skill
                        ) => (
                          <span
                            key={
                              skill
                            }
                          >
                            {skill}
                          </span>
                        )
                      )}

                      {job.skills
                        .length >
                        visibleSkills.length && (
                        <span>
                          +
                          {job.skills
                            .length -
                            visibleSkills.length}
                        </span>
                      )}
                    </div>

                    {match && (
                      <div className="job-match-summary">
                        <div className="match-summary-row positive">
                          <FiCheckCircle />

                          <span>
                            {
                              match
                                .matchedSkills
                                .length
                            }{" "}
                            skills matched
                          </span>
                        </div>

                        <div className="match-summary-row warning">
                          <FiAlertCircle />

                          <span>
                            {
                              match
                                .missingSkills
                                .length
                            }{" "}
                            skills missing
                          </span>
                        </div>
                      </div>
                    )}

                    {match && (
                      <div
                        className={`missing-skills-preview ${
                          match
                            .missingSkills
                            .length ===
                          0
                            ? "no-missing-skills"
                            : ""
                        }`}
                      >
                        <span>
                          Missing skills
                        </span>

                        {match
                          .missingSkills
                          .length >
                        0 ? (
                          <p>
                            {match.missingSkills.join(
                              " · "
                            )}
                          </p>
                        ) : (
                          <p>
                            No missing
                            skills detected
                          </p>
                        )}
                      </div>
                    )}

                    {match ? (
                      <div
                        className={`job-match-footer ${getMatchClass(
                          match.matchLevel
                        )}`}
                      >
                        <strong>
                          {
                            match.matchScore
                          }
                          %
                        </strong>

                        <span>
                          {
                            match.matchLabel
                          }
                        </span>
                      </div>
                    ) : (
                      <div className="job-match-footer no-match">
                        <span>
                          Upload your
                          resume to see
                          compatibility
                        </span>
                      </div>
                    )}

                    <div className="job-card-footer">
                      <button
                        type="button"
                        className="view-job-btn"
                        onClick={() =>
                          handleViewDetails(
                            job._id
                          )
                        }
                      >
                        View Details

                        <FiArrowRight />
                      </button>

                      {match && (
                        <button
                          type="button"
                          className="improve-cv-btn"
                          onClick={() =>
                            handleImproveCV(
                              job
                            )
                          }
                        >
                          <FiZap />

                          Improve CV
                        </button>
                      )}
                    </div>
                  </article>
                );
              }
            )}
          </section>

          {totalPages >
            1 && (
            <div className="jobs-pagination">
              <button
                type="button"
                className="pagination-nav-btn"
                onClick={
                  handlePreviousPage
                }
                disabled={
                  currentPage ===
                  1
                }
              >
                <FiChevronLeft />

                Previous
              </button>

              <div className="pagination-pages">
                {Array.from(
                  {
                    length:
                      totalPages,
                  },
                  (
                    _,
                    index
                  ) =>
                    index +
                    1
                ).map(
                  (page) => (
                    <button
                      type="button"
                      key={
                        page
                      }
                      className={`pagination-page-btn ${
                        currentPage ===
                        page
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        handlePageClick(
                          page
                        )
                      }
                    >
                      {page}
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                className="pagination-nav-btn"
                onClick={
                  handleNextPage
                }
                disabled={
                  currentPage ===
                  totalPages
                }
              >
                Next

                <FiChevronRight />
              </button>
            </div>
          )}
        </>
      )}

      {improveWizardJob && (
        <ImproveCVWizard
          open
          job={{
            _id:
              improveWizardJob._id,

            title:
              improveWizardJob.title,

            company:
              improveWizardJob.company,

            location:
              improveWizardJob.location,

            skills:
              improveWizardJob.skills,
          }}
          onClose={() =>
            setImproveWizardJob(
              null
            )
          }
          onReady={
            handleImproveWizardReady
          }
        />
      )}
    </div>
  );
};

export default jobsPage;