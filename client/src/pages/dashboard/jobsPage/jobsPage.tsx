import { useCareerQuery } from '../../../query/useCareerQuery';
import axios from "axios";
import RouteLoading from "../../../components/RouteLoading";
import React, {
  useCallback,
  lazy,
  Suspense,
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
  FiSliders,
  FiX,
  FiDollarSign,
  FiGlobe,
} from "react-icons/fi";

import apiClient from "../../../api/apiClient";

import "./jobsPage.scss";

import type { ImproveCVWizardData } from "../../../components/resume/ImproveCVWizard";

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

type EmploymentTypeFilter =
  | "full-time"
  | "part-time"
  | "contract"
  | "internship";

type WorkModeFilter =
  | "remote"
  | "hybrid"
  | "onsite";

type SourceFilter =
  | "Greenhouse"
  | "Lever"
  | "Ashby"
  | "SuccessFactors";

type MarketFilter =
  | "all"
  | "azerbaijan"
  | "global";

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
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

type MatchFilter =
  | "all"
  | MatchLevel;

const ITEMS_PER_PAGE = 18;

const ImproveCVWizard = lazy(() => import("../../../components/resume/ImproveCVWizard"));

const JobsPage: React.FC = () => {
  const navigate =
    useNavigate();

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    actionError,
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
    search,
    setSearch,
  ] =
    useState("");

  const [
    filterPanelOpen,
    setFilterPanelOpen,
  ] =
    useState(false);

  const [
    matchFilter,
    setMatchFilter,
  ] =
    useState<MatchFilter>(
      "all"
    );

  const [
    selectedEmploymentTypes,
    setSelectedEmploymentTypes,
  ] =
    useState<
      EmploymentTypeFilter[]
    >([]);

  const [
    selectedWorkModes,
    setSelectedWorkModes,
  ] =
    useState<
      WorkModeFilter[]
    >([]);

  const [
    experienceFilter,
    setExperienceFilter,
  ] =
    useState<ExperienceFilter>(
      "all"
    );

  const [
    locationFilter,
    setLocationFilter,
  ] =
    useState("");

  const [
    minimumSalary,
    setMinimumSalary,
  ] =
    useState("");

  const [
    debouncedSearch,
    setDebouncedSearch,
  ] =
    useState(search);

  const [
    debouncedLocation,
    setDebouncedLocation,
  ] =
    useState(locationFilter);

  const [
    debouncedMinimumSalary,
    setDebouncedMinimumSalary,
  ] =
    useState(minimumSalary);

  useEffect(() => {
    const timeout =
      window.setTimeout(
        () => {
          setDebouncedSearch(
            search
          );

          setDebouncedLocation(
            locationFilter
          );

          setDebouncedMinimumSalary(
            minimumSalary
          );
        },
        500
      );

    return () => {
      window.clearTimeout(
        timeout
      );
    };
  }, [
    search,
    locationFilter,
    minimumSalary,
  ]);

  const [
    selectedSources,
    setSelectedSources,
  ] =
    useState<
      SourceFilter[]
    >([]);

  const [
    marketFilter,
    setMarketFilter,
  ] =
    useState<MarketFilter>(
      "all"
    );

  const filterKey = useMemo(() => {
    const params =
      new URLSearchParams();

    const normalizedSearch =
      debouncedSearch.trim();

    const normalizedLocation =
      debouncedLocation.trim();

    const normalizedMinimumSalary =
      debouncedMinimumSalary.trim();

    if (
      normalizedSearch
    ) {
      params.set(
        "search",
        normalizedSearch
      );
    }

    if (
      experienceFilter !==
      "all"
    ) {
      params.set(
        "experienceLevel",
        experienceFilter
      );
    }

    if (
      selectedEmploymentTypes.length >
      0
    ) {
      params.set(
        "employmentType",
        [...selectedEmploymentTypes].sort().join(",")
      );
    }

    if (
      selectedWorkModes.length >
      0
    ) {
      params.set(
        "remoteType",
        [...selectedWorkModes].sort().join(",")
      );
    }

    if (
      selectedSources.length >
      0
    ) {
      params.set(
        "source",
        [...selectedSources].sort().join(",")
      );
    }

    if (
      normalizedLocation
    ) {
      params.set(
        "location",
        normalizedLocation
      );
    }

    if (
      normalizedMinimumSalary
    ) {
      params.set(
        "minimumSalary",
        normalizedMinimumSalary
      );
    }

    if (
      marketFilter !==
      "all"
    ) {
      params.set(
        "market",
        marketFilter
      );
    }

    if (
      matchFilter !==
      "all"
    ) {
      params.set(
        "matchLevel",
        matchFilter
      );
    }

    params.sort();
    return params.toString();
  }, [debouncedSearch, experienceFilter, selectedEmploymentTypes, selectedWorkModes,
    selectedSources, debouncedLocation, debouncedMinimumSalary, marketFilter, matchFilter]);

  const [pageSelection, setPageSelection] = useState({ filters: "", page: 1 });
  // Reset before committing a changed filter, so no old-page request can start.
  if (pageSelection.filters !== filterKey) {
    setPageSelection({ filters: filterKey, page: 1 });
  }
  const currentPage = pageSelection.filters === filterKey ? pageSelection.page : 1;
  const setCurrentPage = (next: React.SetStateAction<number>) => {
    setPageSelection(previous => {
      const page = previous.filters === filterKey ? previous.page : 1;
      return { filters: filterKey, page: typeof next === "function" ? next(page) : next };
    });
  };
  const endpoint = `/jobs?${filterKey ? `${filterKey}&` : ""}page=${currentPage}&limit=${ITEMS_PER_PAGE}`;
  const jobsQuery = useCareerQuery<JobsApiResponse>(endpoint, true, true);
  const { refetch: refetchJobs } = jobsQuery;
  const loading = jobsQuery.isPending;
  const jobs = jobsQuery.isPlaceholderData ? [] : jobsQuery.data?.data.jobs ?? [];
  const hasResume = jobsQuery.data?.hasResume ?? false;
  const resume = jobsQuery.data?.resume;
  const totalJobs = jobsQuery.isPlaceholderData ? 0 : jobsQuery.data?.data.total ?? 0;
  const totalPages = Math.max(1, jobsQuery.data?.data.totalPages ?? 1);
  if (jobsQuery.isSuccess && !jobsQuery.isPlaceholderData) {
    const responsePage = Math.min(jobsQuery.data.data.page || currentPage, totalPages);
    if (responsePage !== currentPage) setPageSelection({ filters: filterKey, page: responsePage });
  }
  const hasNextPage = !jobsQuery.isPlaceholderData && Boolean(jobsQuery.data?.data.hasNextPage);
  const hasPreviousPage = !jobsQuery.isPlaceholderData && Boolean(jobsQuery.data?.data.hasPreviousPage);
  const error = actionError || (jobsQuery.isError ? "Could not load jobs. Please try again." : "");

  const handleRefreshJobs =
    useCallback(
      async () => {
        if (
          refreshing
        ) {
          return;
        }

        try {
          setRefreshing(
            true
          );

          setError("");

          /*
           * Explicit refresh is the ONLY frontend action that
           * asks the backend to fetch fresh vacancies from
           * Greenhouse / Lever / Ashby.
           */
          await apiClient.post(
            "/jobs/external/refresh"
          );

          /*
           * The refresh endpoint updates MongoDB.
           * Read the newly ranked result after ingestion finishes.
           */
          await refetchJobs({ throwOnError: true });
        } catch (err) {
          const message = axios.isAxiosError(err)
            ? err.response?.data?.message || "Could not refresh jobs. Please try again."
            : "Could not refresh jobs. Please try again.";

          setError(
            message
          );
        } finally {
          setRefreshing(
            false
          );
        }
      },
      [
        refetchJobs,
        refreshing,
      ]
    );

  const toggleArrayValue = <
    T extends string
  >(
    value:
      T,
    values:
      T[],
    setter:
      React.Dispatch<
        React.SetStateAction<
          T[]
        >
      >
  ): void => {
    setter(
      values.includes(
        value
      )
        ? values.filter(
          (
            item
          ) =>
            item !==
            value
        )
        : [
          ...values,
          value,
        ]
    );
  };

  const resetFilters =
    (): void => {
      setMatchFilter(
        "all"
      );

      setSelectedEmploymentTypes(
        []
      );

      setSelectedWorkModes(
        []
      );

      setExperienceFilter(
        "all"
      );

      setLocationFilter(
        ""
      );

      setMinimumSalary(
        ""
      );

      setSelectedSources(
        []
      );

      setMarketFilter(
        "all"
      );
    };

  const activeFilterCount =
    useMemo(
      () => {
        let count =
          0;

        if (
          matchFilter !==
          "all"
        ) {
          count +=
            1;
        }

        count +=
          selectedEmploymentTypes.length;

        count +=
          selectedWorkModes.length;

        if (
          experienceFilter !==
          "all"
        ) {
          count +=
            1;
        }

        if (
          locationFilter.trim()
        ) {
          count +=
            1;
        }

        if (
          minimumSalary.trim()
        ) {
          count +=
            1;
        }

        count +=
          selectedSources.length;

        if (
          marketFilter !==
          "all"
        ) {
          count +=
            1;
        }

        return count;
      },
      [
        matchFilter,
        selectedEmploymentTypes,
        selectedWorkModes,
        experienceFilter,
        locationFilter,
        minimumSalary,
        selectedSources,
        marketFilter,
      ]
    );

  useEffect(() => {
    if (
      !filterPanelOpen
    ) {
      return;
    }

    const handleEscape =
      (
        event:
          KeyboardEvent
      ) => {
        if (
          event.key ===
          "Escape"
        ) {
          setFilterPanelOpen(
            false
          );
        }
      };

    document.body.classList.add(
      "jobs-filter-open"
    );

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.body.classList.remove(
        "jobs-filter-open"
      );

      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [
    filterPanelOpen,
  ]);

  const isAzerbaijanJob =
    (
      job:
        Job
    ): boolean => {
      const source =
        (
          job.source ||
          ""
        )
          .trim()
          .toLowerCase();

      const location =
        (
          job.location ||
          ""
        )
          .trim()
          .toLowerCase();

      return (
        source ===
        "successfactors" ||
        source.includes(
          "azerbaijan-local"
        ) ||
        source.includes(
          "local-company"
        ) ||
        location.includes(
          "azerbaijan"
        ) ||
        location.includes(
          "baku"
        ) ||
        location.includes(
          "bakı"
        )
      );
    };

  const paginationItems =
    useMemo<
      Array<
        number |
        "ellipsis-left" |
        "ellipsis-right"
      >
    >(() => {
      if (
        totalPages <= 7
      ) {
        return Array.from(
          {
            length:
              totalPages,
          },
          (
            _,
            index
          ) =>
            index + 1
        );
      }

      if (
        currentPage <= 3
      ) {
        return [
          1,
          2,
          3,
          4,
          "ellipsis-right",
          totalPages,
        ];
      }

      if (
        currentPage >=
        totalPages - 2
      ) {
        return [
          1,
          "ellipsis-left",
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages,
        ];
      }

      return [
        1,
        "ellipsis-left",
        currentPage - 1,
        currentPage,
        currentPage + 1,
        "ellipsis-right",
        totalPages,
      ];
    }, [
      currentPage,
      totalPages,
    ]);

  const localJobsCount =
    jobs.filter(
      isAzerbaijanJob
    ).length;

  const globalJobsCount =
    Math.max(
      0,
      jobs.length -
      localJobsCount
    );

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
        return `${min} ${min === 1
          ? "year"
          : "years"
          }`;
      }

      return `${min}–${max} years`;
    };

  const scrollJobsPageToTop =
    (): void => {
      const dashboardContent =
        document.querySelector<HTMLElement>(
          ".dashboard-content"
        );

      if (
        dashboardContent
      ) {
        dashboardContent.scrollTo({
          top:
            0,

          behavior:
            "smooth",
        });

        return;
      }

      window.scrollTo({
        top:
          0,

        behavior:
          "smooth",
      });
    };

  const handlePreviousPage =
    (): void => {
      if (
        currentPage <=
        1
      ) {
        return;
      }

      setCurrentPage(
        (
          previousPage
        ) =>
          previousPage -
          1
      );

      requestAnimationFrame(
        () => {
          scrollJobsPageToTop();
        }
      );
    };

  const handleNextPage =
    (): void => {
      if (
        currentPage >=
        totalPages
      ) {
        return;
      }

      setCurrentPage(
        (
          previousPage
        ) =>
          previousPage +
          1
      );

      requestAnimationFrame(
        () => {
          scrollJobsPageToTop();
        }
      );
    };

  const handlePageClick =
    (
      page:
        number
    ): void => {
      if (
        page ===
        currentPage
      ) {
        scrollJobsPageToTop();

        return;
      }

      setCurrentPage(
        page
      );

      requestAnimationFrame(
        () => {
          scrollJobsPageToTop();
        }
      );
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
            Find jobs that match{" "}
            {jobsQuery.activeCareer?.targetRole || "your profile"}
          </h1>

          <p>Match scores describe profile compatibility, not verified skill proficiency. Missing CV evidence is not proof of a knowledge gap.</p>
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
            void handleRefreshJobs()
          }
          disabled={refreshing}
        >
          <FiRefreshCw
            className={
              refreshing
                ? "is-spinning"
                : undefined
            }
          />

          {refreshing
            ? "Refreshing..."
            : "Refresh jobs"}
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

      {jobsQuery.isFetching && !loading && !jobsQuery.isPlaceholderData && (
        <p role="status">Updating job matches...</p>
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

        <button
          type="button"
          className={`jobs-filter-trigger ${activeFilterCount >
            0
            ? "has-active-filters"
            : ""
            }`}
          onClick={() =>
            setFilterPanelOpen(
              true
            )
          }
        >
          <FiSliders />

          <span>
            Filters
          </span>

          {activeFilterCount >
            0 && (
              <strong>
                {activeFilterCount}
              </strong>
            )}
        </button>
      </section>

      <section className="jobs-results-header">
        <div>
          <span className="jobs-eyebrow">
            RECOMMENDED FOR YOU
          </span>

          <h2>
            {
              totalJobs
            }{" "}
            opportunities found
          </h2>
        </div>

        <span className="jobs-ranked-label">
          Showing{" "}
          {totalJobs ===
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
            totalJobs
          )}{" "}
          of{" "}
          {
            totalJobs
          }
        </span>
      </section>

      {jobsQuery.isPlaceholderData ? (
        <div className="jobs-empty" role="status">Updating job matches...</div>
      ) : totalJobs === 0 ? (
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
            {jobs.map(
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
                        className={`missing-skills-preview ${match
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
                    !hasPreviousPage
                  }
                >
                  <FiChevronLeft />

                  Previous
                </button>

                <div className="pagination-pages">
                  {paginationItems.map(
                    (
                      item
                    ) => {
                      if (
                        typeof item ===
                        "string"
                      ) {
                        return (
                          <span
                            key={item}
                            className="pagination-ellipsis"
                            aria-hidden="true"
                          >
                            …
                          </span>
                        );
                      }

                      return (
                        <button
                          type="button"
                          key={item}
                          className={`pagination-page-btn ${currentPage ===
                            item
                            ? "active"
                            : ""
                            }`}
                          onClick={() =>
                            handlePageClick(
                              item
                            )
                          }
                          aria-current={
                            currentPage ===
                              item
                              ? "page"
                              : undefined
                          }
                        >
                          {item}
                        </button>
                      );
                    }
                  )}
                </div>

                <button
                  type="button"
                  className="pagination-nav-btn"
                  onClick={
                    handleNextPage
                  }
                  disabled={
                    !hasNextPage
                  }
                >
                  Next

                  <FiChevronRight />
                </button>
              </div>
            )}
        </>
      )}

      <div
        className={`jobs-filter-overlay ${filterPanelOpen
          ? "is-open"
          : ""
          }`}
        onMouseDown={(event) => {
          if (
            event.target ===
            event.currentTarget
          ) {
            setFilterPanelOpen(
              false
            );
          }
        }}
        aria-hidden={
          !filterPanelOpen
        }
      >
        <aside
          className={`jobs-filter-drawer ${filterPanelOpen
            ? "is-open"
            : ""
            }`}
          role="dialog"
          aria-modal="true"
          aria-label="Job filters"
        >
          <div className="filter-drawer-header">
            <div>
              <span className="jobs-eyebrow">
                REFINE RESULTS
              </span>

              <h2>
                Filters
              </h2>

              <p>
                Narrow the current
                opportunities without
                running a new job search.
              </p>
            </div>

            <button
              type="button"
              className="filter-close-btn"
              onClick={() =>
                setFilterPanelOpen(
                  false
                )
              }
              aria-label="Close filters"
            >
              <FiX />
            </button>
          </div>

          <div className="filter-drawer-content">
            <section className="filter-section">
              <div className="filter-section-heading">
                <div>
                  <strong>
                    Location
                  </strong>

                  <span>
                    City, state or country
                  </span>
                </div>

                <FiMapPin />
              </div>

              <div className="filter-input-shell">
                <FiSearch />

                <input
                  type="text"
                  value={
                    locationFilter
                  }
                  placeholder="e.g. Baku, Boston, London, Germany"
                  onChange={(event) =>
                    setLocationFilter(
                      event.target
                        .value
                    )
                  }
                />
              </div>
            </section>

            <section className="filter-section">
              <div className="filter-section-heading">
                <div>
                  <strong>
                    Employment type
                  </strong>

                  <span>
                    Choose one or more
                  </span>
                </div>

                <FiBriefcase />
              </div>

              <div className="filter-chip-grid">
                {[
                  {
                    value:
                      "full-time",
                    label:
                      "Full-time",
                  },
                  {
                    value:
                      "part-time",
                    label:
                      "Part-time",
                  },
                  {
                    value:
                      "contract",
                    label:
                      "Contract",
                  },
                  {
                    value:
                      "internship",
                    label:
                      "Internship",
                  },
                ].map(
                  (
                    option
                  ) => {
                    const value =
                      option.value as EmploymentTypeFilter;

                    const selected =
                      selectedEmploymentTypes
                        .includes(
                          value
                        );

                    return (
                      <button
                        type="button"
                        key={
                          value
                        }
                        className={`filter-chip ${selected
                          ? "selected"
                          : ""
                          }`}
                        onClick={() =>
                          toggleArrayValue(
                            value,
                            selectedEmploymentTypes,
                            setSelectedEmploymentTypes
                          )
                        }
                      >
                        {option.label}
                      </button>
                    );
                  }
                )}
              </div>
            </section>

            <section className="filter-section">
              <div className="filter-section-heading">
                <div>
                  <strong>
                    Work format
                  </strong>

                  <span>
                    Remote, hybrid or on-site
                  </span>
                </div>

                <FiGlobe />
              </div>

              <div className="filter-chip-grid three-columns">
                {[
                  {
                    value:
                      "remote",
                    label:
                      "Remote",
                  },
                  {
                    value:
                      "hybrid",
                    label:
                      "Hybrid",
                  },
                  {
                    value:
                      "onsite",
                    label:
                      "On-site",
                  },
                ].map(
                  (
                    option
                  ) => {
                    const value =
                      option.value as WorkModeFilter;

                    const selected =
                      selectedWorkModes
                        .includes(
                          value
                        );

                    return (
                      <button
                        type="button"
                        key={
                          value
                        }
                        className={`filter-chip ${selected
                          ? "selected"
                          : ""
                          }`}
                        onClick={() =>
                          toggleArrayValue(
                            value,
                            selectedWorkModes,
                            setSelectedWorkModes
                          )
                        }
                      >
                        {option.label}
                      </button>
                    );
                  }
                )}
              </div>
            </section>

            <section className="filter-section">
              <div className="filter-section-heading">
                <div>
                  <strong>
                    Experience
                  </strong>

                  <span>
                    Required experience level
                  </span>
                </div>
              </div>

              <div className="filter-select-shell">
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
                    Any experience
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
              </div>
            </section>

            <section className="filter-section">
              <div className="filter-section-heading">
                <div>
                  <strong>
                    Minimum salary
                  </strong>

                  <span>
                    Annual salary when available
                  </span>
                </div>

                <FiDollarSign />
              </div>

              <div className="filter-input-shell salary-input">
                <span>
                  $
                </span>

                <input
                  type="number"
                  min="0"
                  step="5000"
                  value={
                    minimumSalary
                  }
                  placeholder="e.g. 80000"
                  onChange={(event) =>
                    setMinimumSalary(
                      event.target
                        .value
                    )
                  }
                />
              </div>

              <small className="filter-helper-text">
                Jobs without salary data
                are excluded only when a
                minimum salary is selected.
              </small>
            </section>

            <section className="filter-section">
              <div className="filter-section-heading">
                <div>
                  <strong>
                    Match quality
                  </strong>

                  <span>
                    CV compatibility
                  </span>
                </div>

                <FiCheckCircle />
              </div>

              <div className="filter-chip-grid">
                {[
                  {
                    value:
                      "all",
                    label:
                      "Any match",
                  },
                  {
                    value:
                      "strong",
                    label:
                      "Strong",
                  },
                  {
                    value:
                      "good",
                    label:
                      "Good",
                  },
                  {
                    value:
                      "partial",
                    label:
                      "Partial",
                  },
                  {
                    value:
                      "low",
                    label:
                      "Low",
                  },
                ].map(
                  (
                    option
                  ) => (
                    <button
                      type="button"
                      key={
                        option.value
                      }
                      className={`filter-chip ${matchFilter ===
                        option.value
                        ? "selected"
                        : ""
                        }`}
                      onClick={() =>
                        setMatchFilter(
                          option.value as MatchFilter
                        )
                      }
                    >
                      {option.label}
                    </button>
                  )
                )}
              </div>
            </section>

            <section className="filter-section">
              <div className="filter-section-heading">
                <div>
                  <strong>
                    Job market
                  </strong>

                  <span>
                    Local Azerbaijan or global opportunities
                  </span>
                </div>

                <FiGlobe />
              </div>

              <div className="filter-chip-grid three-columns">
                <button
                  type="button"
                  className={`filter-chip ${marketFilter ===
                    "all"
                    ? "selected"
                    : ""
                    }`}
                  onClick={() =>
                    setMarketFilter(
                      "all"
                    )
                  }
                >
                  All
                </button>

                <button
                  type="button"
                  className={`filter-chip ${marketFilter ===
                    "azerbaijan"
                    ? "selected"
                    : ""
                    }`}
                  onClick={() =>
                    setMarketFilter(
                      "azerbaijan"
                    )
                  }
                >
                  Azerbaijan ({localJobsCount})
                </button>

                <button
                  type="button"
                  className={`filter-chip ${marketFilter ===
                    "global"
                    ? "selected"
                    : ""
                    }`}
                  onClick={() =>
                    setMarketFilter(
                      "global"
                    )
                  }
                >
                  Global ({globalJobsCount})
                </button>
              </div>
            </section>

            <section className="filter-section">
              <div className="filter-section-heading">
                <div>
                  <strong>
                    Job source
                  </strong>

                  <span>
                    ATS platform
                  </span>
                </div>
              </div>

              <div className="filter-chip-grid three-columns">
                {[
                  "Greenhouse",
                  "Lever",
                  "Ashby",
                  "SuccessFactors",
                ].map(
                  (
                    item
                  ) => {
                    const source =
                      item as SourceFilter;

                    const selected =
                      selectedSources
                        .includes(
                          source
                        );

                    return (
                      <button
                        type="button"
                        key={
                          source
                        }
                        className={`filter-chip ${selected
                          ? "selected"
                          : ""
                          }`}
                        onClick={() =>
                          toggleArrayValue(
                            source,
                            selectedSources,
                            setSelectedSources
                          )
                        }
                      >
                        {source}
                      </button>
                    );
                  }
                )}
              </div>
            </section>
          </div>

          <div className="filter-drawer-footer">
            <button
              type="button"
              className="filter-reset-btn"
              onClick={
                resetFilters
              }
              disabled={
                activeFilterCount ===
                0
              }
            >
              Reset
            </button>

            <button
              type="button"
              className="filter-apply-btn"
              onClick={() =>
                setFilterPanelOpen(
                  false
                )
              }
            >
              Show{" "}
              {
                totalJobs
              }{" "}
              jobs
            </button>
          </div>
        </aside>
      </div>

      {improveWizardJob && (
        <Suspense fallback={<RouteLoading />}>
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
        </Suspense>
      )}
    </div>
  );
};

export default JobsPage;
