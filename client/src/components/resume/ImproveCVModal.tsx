import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FiAlertCircle,
  FiBriefcase,
  FiCheck,
  FiMapPin,
  FiSearch,
  FiTarget,
  FiX,
  FiZap,
} from "react-icons/fi";

import apiClient from "../../api/apiClient";

import "./improveCVModal.scss";

interface JobMatch {
  overallMatch?: number;

  matchLevel?:
    | "strong"
    | "good"
    | "partial"
    | "low";
}

interface JobOption {
  _id: string;

  title: string;

  company: string;

  location?: string;

  remoteType?: string;

  employmentType?: string;

  skills?: string[];

  match?: JobMatch | null;
}

interface JobsApiResponse {
  success: boolean;

  data: {
    jobs: JobOption[];

    total: number;
  };
}

interface ImproveCVModalProps {
  open: boolean;

  /*
   * Exact ResumeAnalysis currently open on ResumeAnalysisPage.
   * Generation MUST use this CV, not the latest uploaded CV.
   */
  sourceAnalysisId:
    string | null;

  sourceFileName?:
    string | null;

  onClose: () => void;

  onCompleted: () => void;
}

/* =========================================================
   FILE NAME
========================================================= */

const getGeneratedFileName = (
  contentDisposition:
    string | undefined
): string => {
  if (
    !contentDisposition
  ) {
    return "Improved_CV.pdf";
  }

  const utf8Match =
    contentDisposition.match(
      /filename\*=UTF-8''([^;]+)/
    );

  if (
    utf8Match?.[1]
  ) {
    try {
      return decodeURIComponent(
        utf8Match[1]
      );
    } catch {
      return utf8Match[1];
    }
  }

  const normalMatch =
    contentDisposition.match(
      /filename="?([^";]+)"?/
    );

  return (
    normalMatch?.[1] ||
    "Improved_CV.pdf"
  );
};

/* =========================================================
   DOWNLOAD PDF
========================================================= */

const downloadPdf = (
  blob:
    Blob,

  fileName:
    string
): void => {
  const url =
    URL.createObjectURL(
      blob
    );

  const anchor =
    document.createElement(
      "a"
    );

  anchor.href =
    url;

  anchor.download =
    fileName;

  document.body.appendChild(
    anchor
  );

  anchor.click();

  anchor.remove();

  window.setTimeout(
    () => {
      URL.revokeObjectURL(
        url
      );
    },
    1000
  );
};

/* =========================================================
   COMPONENT
========================================================= */

const ImproveCVModal:
  React.FC<
    ImproveCVModalProps
  > = ({
    open,
    sourceAnalysisId,
    sourceFileName,
    onClose,
    onCompleted,
  }) => {
    const [
      jobs,
      setJobs,
    ] =
      useState<JobOption[]>(
        []
      );

    const [
      loadingJobs,
      setLoadingJobs,
    ] =
      useState(false);

    const [
      generating,
      setGenerating,
    ] =
      useState(false);

    const [
      search,
      setSearch,
    ] =
      useState("");

    const [
      selectedJobId,
      setSelectedJobId,
    ] =
      useState<
        string | null
      >(null);

    const [
      error,
      setError,
    ] =
      useState("");

    /* =====================================================
       LOAD JOBS
    ===================================================== */

    useEffect(
      () => {
        if (
          !open
        ) {
          return;
        }

        setSearch(
          ""
        );

        setSelectedJobId(
          null
        );

        setError(
          ""
        );

        const loadJobs =
          async () => {
            try {
              setLoadingJobs(
                true
              );

              const response =
                await apiClient.get<JobsApiResponse>(
                  "/jobs"
                );

              setJobs(
                response.data
                  .data
                  ?.jobs ||
                  []
              );
            } catch (
              err: any
            ) {
              setError(
                err?.response
                  ?.data
                  ?.message ||
                  "Could not load vacancies."
              );
            } finally {
              setLoadingJobs(
                false
              );
            }
          };

        void loadJobs();
      },
      [
        open,
      ]
    );

    /* =====================================================
       FILTER JOBS
    ===================================================== */

    const filteredJobs =
      useMemo(
        () => {
          const term =
            search
              .trim()
              .toLowerCase();

          const source =
            !term
              ? jobs
              : jobs.filter(
                  (
                    job
                  ) => {
                    return (
                      job.title
                        .toLowerCase()
                        .includes(
                          term
                        ) ||
                      job.company
                        .toLowerCase()
                        .includes(
                          term
                        ) ||
                      (
                        job.location ||
                        ""
                      )
                        .toLowerCase()
                        .includes(
                          term
                        ) ||
                      (
                        job.skills ||
                        []
                      ).some(
                        (
                          skill
                        ) =>
                          skill
                            .toLowerCase()
                            .includes(
                              term
                            )
                      )
                    );
                  }
                );

          return source.slice(
            0,
            8
          );
        },
        [
          jobs,
          search,
        ]
      );

    /* =====================================================
       SELECTED JOB
    ===================================================== */

    const selectedJob =
      useMemo(
        () =>
          jobs.find(
            (
              job
            ) =>
              job._id ===
              selectedJobId
          ) ||
          null,
        [
          jobs,
          selectedJobId,
        ]
      );

    /* =====================================================
       GENERATE IMPROVED CV
    ===================================================== */

    const generateImprovedCV =
      async () => {
        if (
          generating
        ) {
          return;
        }

        if (
          !sourceAnalysisId
        ) {
          setError(
            "The source CV could not be identified. Close this window, reopen the resume analysis, and try again."
          );

          return;
        }

        try {
          setGenerating(
            true
          );

          setError(
            ""
          );

          const endpoint =
            selectedJobId
              ? `/cv-builder/jobs/${selectedJobId}/generate`
              : "/cv-builder/general/generate";

          const response =
            await apiClient.post(
              endpoint,
              {
                sourceAnalysisId,
              },
              {
                responseType:
                  "blob",
              }
            );

          const contentDisposition =
            response.headers[
              "content-disposition"
            ] as
              | string
              | undefined;

          const fileName =
            getGeneratedFileName(
              contentDisposition
            );

          const pdfBlob =
            new Blob(
              [
                response.data,
              ],
              {
                type:
                  "application/pdf",
              }
            );

          downloadPdf(
            pdfBlob,
            fileName
          );

          onCompleted();
        } catch (
          err: any
        ) {
          console.error(
            "Improve CV error:",
            err
          );

          let message =
            "Could not generate the improved CV.";

          const responseData =
            err?.response
              ?.data;

          if (
            responseData instanceof
            Blob
          ) {
            try {
              const text =
                await responseData.text();

              const parsed =
                JSON.parse(
                  text
                );

              if (
                typeof parsed
                  ?.message ===
                "string"
              ) {
                message =
                  parsed.message;
              }

              if (
                Array.isArray(
                  parsed
                    ?.data
                    ?.errors
                ) &&
                parsed.data.errors
                  .length >
                  0
              ) {
                const validationMessages =
                  parsed.data.errors
                    .map(
                      (
                        issue: any
                      ) =>
                        issue
                          ?.message
                    )
                    .filter(
                      Boolean
                    );

                if (
                  validationMessages
                    .length >
                  0
                ) {
                  message =
                    validationMessages.join(
                      " "
                    );
                }
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

          setError(
            message
          );
        } finally {
          setGenerating(
            false
          );
        }
      };

    /* =====================================================
       CLOSED
    ===================================================== */

    if (
      !open
    ) {
      return null;
    }

    /* =====================================================
       UI
    ===================================================== */

    return (
      <div
        className="improve-cv-modal-backdrop"
        onMouseDown={(
          event
        ) => {
          if (
            event.target ===
              event.currentTarget &&
            !generating
          ) {
            onClose();
          }
        }}
      >
        <div className="improve-cv-modal">
          <button
            type="button"
            className="improve-cv-close"
            onClick={
              onClose
            }
            disabled={
              generating
            }
          >
            <FiX />
          </button>

          <div className="improve-cv-modal-heading">
            <div className="improve-cv-heading-icon">
              <FiZap />
            </div>

            <div>
              <span>
                CV IMPROVEMENT
              </span>

              <h2>
                How should we improve your CV?
              </h2>

              <p>
                Selecting a vacancy is optional. Choose one to tailor your CV to that role, or continue without a vacancy for a general improvement based on your professional field.
              </p>
            </div>
          </div>

          <div className="improve-cv-mode-card">
            <div className="improve-cv-mode-icon">
              {selectedJob
                ? (
                    <FiTarget />
                  )
                : (
                    <FiBriefcase />
                  )}
            </div>

            <div>
              <span>
                {selectedJob
                  ? "Vacancy-specific improvement"
                  : "General career improvement"}
              </span>

              <strong>
                {selectedJob
                  ? `${selectedJob.title} — ${selectedJob.company}`
                  : "No vacancy selected"}
              </strong>

              <p>
                {selectedJob
                  ? "InterviewIQ will prioritize the selected vacancy's requirements and ATS keywords without inventing unsupported skills."
                  : "InterviewIQ will improve the CV using your existing resume and verified profile information."}
              </p>

              {sourceFileName && (
                <small>
                  Source CV: {sourceFileName}
                </small>
              )}
            </div>

            {selectedJob && (
              <button
                type="button"
                onClick={() =>
                  setSelectedJobId(
                    null
                  )
                }
                disabled={
                  generating
                }
              >
                Clear
              </button>
            )}
          </div>

          <div className="improve-cv-vacancy-heading">
            <div>
              <span>
                OPTIONAL
              </span>

              <h3>
                Target vacancy
              </h3>
            </div>

            <small>
              {jobs.length}
              {" "}
              available
            </small>
          </div>

          <div className="improve-cv-search">
            <FiSearch />

            <input
              type="text"
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target
                    .value
                )
              }
              placeholder="Search by role, company, location or skill..."
              disabled={
                generating
              }
            />
          </div>

          <div className="improve-cv-results">
            {loadingJobs ? (
              <div className="improve-cv-empty">
                <span className="improve-cv-spinner" />

                Loading vacancies...
              </div>
            ) : filteredJobs.length ===
              0 ? (
              <div className="improve-cv-empty">
                <FiSearch />

                <strong>
                  No vacancies found
                </strong>

                <span>
                  You can still improve your CV generally.
                </span>
              </div>
            ) : (
              filteredJobs.map(
                (
                  job
                ) => {
                  const selected =
                    selectedJobId ===
                    job._id;

                  return (
                    <button
                      type="button"
                      className={`improve-cv-job ${
                        selected
                          ? "selected"
                          : ""
                      }`}
                      key={
                        job._id
                      }
                      onClick={() =>
                        setSelectedJobId(
                          selected
                            ? null
                            : job._id
                        )
                      }
                      disabled={
                        generating
                      }
                    >
                      <div className="improve-cv-job-check">
                        {selected && (
                          <FiCheck />
                        )}
                      </div>

                      <div className="improve-cv-job-main">
                        <strong>
                          {job.title}
                        </strong>

                        <span>
                          {job.company}
                        </span>

                        <small>
                          {job.location && (
                            <>
                              <FiMapPin />

                              {job.location}
                            </>
                          )}

                          {job.remoteType && (
                            <em>
                              {job.remoteType}
                            </em>
                          )}
                        </small>
                      </div>

                      {typeof job.match
                        ?.overallMatch ===
                        "number" && (
                        <div className="improve-cv-job-match">
                          <strong>
                            {Math.round(
                              job.match
                                .overallMatch
                            )}
                            %
                          </strong>

                          <span>
                            match
                          </span>
                        </div>
                      )}
                    </button>
                  );
                }
              )
            )}
          </div>

          {error && (
            <div className="improve-cv-error">
              <FiAlertCircle />

              <span>
                {error}
              </span>
            </div>
          )}

          <div className="improve-cv-actions">
            <button
              type="button"
              className="improve-cv-cancel"
              onClick={
                onClose
              }
              disabled={
                generating
              }
            >
              Cancel
            </button>

            <button
              type="button"
              className="improve-cv-submit"
              onClick={() =>
                void generateImprovedCV()
              }
              disabled={
                generating ||
                !sourceAnalysisId
              }
            >
              {generating ? (
                <>
                  <span className="improve-cv-button-spinner" />

                  Creating improved CV...
                </>
              ) : (
                <>
                  <FiZap />

                  {selectedJob
                    ? "Improve for Selected Vacancy"
                    : "Improve Generally"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

export default ImproveCVModal;