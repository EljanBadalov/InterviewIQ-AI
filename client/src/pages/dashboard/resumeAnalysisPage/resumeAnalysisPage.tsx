import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  ChangeEvent,
  DragEvent,
} from "react";

import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiAward,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiFileText,
  FiRefreshCw,
  FiStar,
  FiTarget,
  FiTrash2,
  FiTrendingUp,
  FiUploadCloud,
  FiX,
  FiZap,
} from "react-icons/fi";

import axios from "axios";

import apiClient from "../../../api/apiClient";

import "./resumeAnalysisPage.scss";

/* =========================================
   TYPES
========================================= */

interface ResumeScores {
  overallScore: number;
  atsScore: number;
  contentScore: number;
  structureScore: number;
  skillsScore: number;
  experienceScore: number;
}

interface ResumeAnalysisResult
  extends ResumeScores {
  _id?: string;

  analysisId?: string;

  fileName?: string;

  fileSize?: number;

  mimeType?: string;

  summary?: string;

  skillsDetected: string[];

  strengths: string[];

  weaknesses: string[];

  recommendedSkills: string[];

  missingSkills: string[];

  atsSuggestions: string[];

  formattingFeedback: string[];

  recommendations: string[];

  createdAt?: string;

  updatedAt?: string;
}

interface ResumeAnalysisPayload
  extends Partial<ResumeAnalysisResult> {}

interface ResumeAnalysisApiResponse {
  success?: boolean;

  message?: string;

  data?: ResumeAnalysisPayload & {
    analysis?: ResumeAnalysisPayload;

    resumeAnalysis?: ResumeAnalysisPayload;

    result?: ResumeAnalysisPayload;
  };
}

interface ResumeHistoryApiResponse {
  success?: boolean;

  data?: {
    analyses?: ResumeAnalysisPayload[];
  };
}

/* =========================================
   CONSTANTS
========================================= */

const ANALYZE_ENDPOINT =
  "/resume/analyze";

const HISTORY_ENDPOINT =
  "/resume/history";

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

/* =========================================
   HELPERS
========================================= */

const clampScore = (
  value: unknown
): number => {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        parsed
      )
    )
  );
};

const stringArray = (
  value: unknown
): string[] => {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value
    .filter(
      (
        item
      ): item is string =>
        typeof item ===
        "string"
    )
    .map((item) =>
      item.trim()
    )
    .filter(Boolean);
};

const normalizeAnalysis = (
  data:
    ResumeAnalysisPayload
): ResumeAnalysisResult => {
  return {
    _id:
      data._id,

    analysisId:
      data.analysisId ??
      data._id,

    fileName:
      data.fileName,

    fileSize:
      data.fileSize,

    mimeType:
      data.mimeType,

    overallScore:
      clampScore(
        data.overallScore
      ),

    atsScore:
      clampScore(
        data.atsScore
      ),

    contentScore:
      clampScore(
        data.contentScore
      ),

    structureScore:
      clampScore(
        data.structureScore
      ),

    skillsScore:
      clampScore(
        data.skillsScore
      ),

    experienceScore:
      clampScore(
        data.experienceScore
      ),

    summary:
      typeof data.summary ===
      "string"
        ? data.summary
        : "",

    skillsDetected:
      stringArray(
        data.skillsDetected
      ),

    strengths:
      stringArray(
        data.strengths
      ),

    weaknesses:
      stringArray(
        data.weaknesses
      ),

    missingSkills:
      stringArray(
        data.missingSkills
      ),

    recommendedSkills:
      stringArray(
        data.recommendedSkills ??
        data.missingSkills
      ),

    atsSuggestions:
      stringArray(
        data.atsSuggestions
      ),

    formattingFeedback:
      stringArray(
        data.formattingFeedback
      ),

    recommendations:
      stringArray(
        data.recommendations
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
};

const normalizeApiResponse = (
  response:
    ResumeAnalysisApiResponse
): ResumeAnalysisResult => {
  const root =
    response.data ?? {};

  const nested =
    root.analysis ??
    root.resumeAnalysis ??
    root.result ??
    root;

  return normalizeAnalysis(
    nested
  );
};

const formatFileSize = (
  bytes?: number
): string => {
  if (!bytes) {
    return "";
  }

  if (
    bytes <
    1024
  ) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(
      1
    )} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(
    1
  )} MB`;
};

const formatDate = (
  date?: string
): string => {
  if (!date) {
    return "";
  }

  const parsed =
    new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "";
  }

  return parsed.toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
};

/* =========================================
   SCORE RING
========================================= */

const ScoreRing = ({
  score,
}: {
  score: number;
}) => {
  const radius =
    62;

  const circumference =
    2 *
    Math.PI *
    radius;

  const offset =
    circumference -
    (score / 100) *
      circumference;

  return (
    <div className="resume-score-ring">
      <svg
        viewBox="0 0 150 150"
      >
        <circle
          className="ring-background"
          cx="75"
          cy="75"
          r={radius}
        />

        <circle
          className="ring-progress"
          cx="75"
          cy="75"
          r={radius}
          strokeDasharray={
            circumference
          }
          strokeDashoffset={
            offset
          }
        />
      </svg>

      <div className="ring-score">
        <strong>
          {score}
        </strong>

        <span>
          /100
        </span>
      </div>
    </div>
  );
};

/* =========================================
   PAGE
========================================= */

const ResumeAnalysisPage =
  () => {
    const inputRef =
      useRef<HTMLInputElement | null>(
        null
      );

    const [
      selectedFile,
      setSelectedFile,
    ] =
      useState<File | null>(
        null
      );

    const [
      loading,
      setLoading,
    ] =
      useState(false);

    const [
      historyLoading,
      setHistoryLoading,
    ] =
      useState(false);

    const [
      dragActive,
      setDragActive,
    ] =
      useState(false);

    const [
      error,
      setError,
    ] =
      useState("");

    const [
      result,
      setResult,
    ] =
      useState<ResumeAnalysisResult | null>(
        null
      );

    const [
      history,
      setHistory,
    ] =
      useState<
        ResumeAnalysisResult[]
      >([]);

    const [
      previewUrl,
      setPreviewUrl,
    ] =
      useState<
        string | null
      >(null);

    /* =====================================
       CLEAR PREVIEW
    ===================================== */

    const clearPreview =
      () => {
        if (
          previewUrl
        ) {
          URL.revokeObjectURL(
            previewUrl
          );
        }

        setPreviewUrl(
          null
        );
      };

    /* =====================================
       FETCH PDF PREVIEW
    ===================================== */

    const loadPreview =
      async (
        analysisId:
          string
      ) => {
        clearPreview();

        const response =
          await apiClient.get(
            `/resume/${analysisId}/file`,
            {
              responseType:
                "blob",
            }
          );

        const blob =
          new Blob(
            [
              response.data,
            ],
            {
              type:
                "application/pdf",
            }
          );

        const url =
          URL.createObjectURL(
            blob
          );

        setPreviewUrl(
          url
        );
      };

    /* =====================================
       HISTORY
    ===================================== */

    const loadHistory =
      async () => {
        setHistoryLoading(
          true
        );

        try {
          const response =
            await apiClient.get<ResumeHistoryApiResponse>(
              HISTORY_ENDPOINT
            );

          const rows =
            response.data
              .data
              ?.analyses ??
            [];

          setHistory(
            rows.map(
              normalizeAnalysis
            )
          );
        } catch (
          historyError
        ) {
          console.error(
            "Resume history error:",
            historyError
          );
        } finally {
          setHistoryLoading(
            false
          );
        }
      };

    useEffect(
      () => {
        void loadHistory();

        return () => {
          if (
            previewUrl
          ) {
            URL.revokeObjectURL(
              previewUrl
            );
          }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      },
      []
    );

    /* =====================================
       FILE
    ===================================== */

    const selectFile =
      (
        file: File
      ) => {
        setError("");

        const extension =
          file.name
            .toLowerCase()
            .endsWith(
              ".pdf"
            );

        if (
          !extension
        ) {
          setError(
            "Please upload a PDF resume."
          );

          return;
        }

        if (
          file.size >
          MAX_FILE_SIZE
        ) {
          setError(
            "Resume file must be smaller than 10 MB."
          );

          return;
        }

        setSelectedFile(
          file
        );

        setResult(
          null
        );

        clearPreview();
      };

    const handleFileChange =
      (
        event:
          ChangeEvent<HTMLInputElement>
      ) => {
        const file =
          event.target
            .files?.[0];

        if (file) {
          selectFile(
            file
          );
        }
      };

    const handleDrop =
      (
        event:
          DragEvent<HTMLDivElement>
      ) => {
        event.preventDefault();

        setDragActive(
          false
        );

        const file =
          event
            .dataTransfer
            .files?.[0];

        if (file) {
          selectFile(
            file
          );
        }
      };

    /* =====================================
       ANALYZE
    ===================================== */

    const analyzeResume =
      async () => {
        if (
          !selectedFile ||
          loading
        ) {
          return;
        }

        setLoading(
          true
        );

        setError("");

        try {
          const formData =
            new FormData();

          formData.append(
            "resume",
            selectedFile,
            selectedFile.name
          );

          const response =
            await apiClient.post<ResumeAnalysisApiResponse>(
              ANALYZE_ENDPOINT,
              formData
            );

          const analysis =
            normalizeApiResponse(
              response.data
            );

          setResult(
            analysis
          );

          if (
            analysis.analysisId
          ) {
            await loadPreview(
              analysis.analysisId
            );
          }

          await loadHistory();
        } catch (err) {
          if (
            axios.isAxiosError(
              err
            )
          ) {
            setError(
              err.response
                ?.data
                ?.message ??
              "Resume analysis failed."
            );
          } else {
            setError(
              "Resume analysis failed."
            );
          }
        } finally {
          setLoading(
            false
          );
        }
      };

    /* =====================================
       OPEN HISTORY ANALYSIS
    ===================================== */

    const openAnalysis =
      async (
        analysisId:
          string
      ) => {
        setLoading(
          true
        );

        setError("");

        try {
          const response =
            await apiClient.get<ResumeAnalysisApiResponse>(
              `/resume/${analysisId}`
            );

          const analysis =
            normalizeApiResponse(
              response.data
            );

          setResult(
            analysis
          );

          setSelectedFile(
            null
          );

          await loadPreview(
            analysisId
          );
        } catch (err) {
          if (
            axios.isAxiosError(
              err
            )
          ) {
            setError(
              err.response
                ?.data
                ?.message ??
              "Could not load resume analysis."
            );
          } else {
            setError(
              "Could not load resume analysis."
            );
          }
        } finally {
          setLoading(
            false
          );
        }
      };

    /* =====================================
       DELETE
    ===================================== */

    const deleteAnalysis =
      async (
        analysisId:
          string
      ) => {
        try {
          await apiClient.delete(
            `/resume/${analysisId}`
          );

          if (
            result
              ?.analysisId ===
            analysisId
          ) {
            setResult(
              null
            );

            clearPreview();
          }

          await loadHistory();
        } catch (err) {
          console.error(
            err
          );

          setError(
            "Could not delete resume analysis."
          );
        }
      };

    /* =====================================
       NEW ANALYSIS
    ===================================== */

    const newAnalysis =
      () => {
        setResult(
          null
        );

        setSelectedFile(
          null
        );

        setError("");

        clearPreview();

        if (
          inputRef.current
        ) {
          inputRef.current.value =
            "";
        }
      };

    /* =====================================
       UI
    ===================================== */

    return (
      <div className="resume-analysis-page">
        <section className="resume-page-header">
          <div>
            <span className="resume-eyebrow">
              AI Resume Intelligence
            </span>

            <h1>
              Resume Analysis
            </h1>

            <p>
              Upload your resume, analyze it with AI and revisit previous resume analyses whenever you want.
            </p>
          </div>

          {result && (
            <button
              type="button"
              className="new-analysis-btn"
              onClick={
                newAnalysis
              }
            >
              <FiRefreshCw />

              Analyze another resume
            </button>
          )}
        </section>

        {error && (
          <div className="resume-error">
            <FiAlertCircle />

            <div>
              <strong>
                Analysis error
              </strong>

              <span>
                {error}
              </span>
            </div>
          </div>
        )}

        {/* =================================
            UPLOAD
        ================================= */}

        {!result && (
          <>
            <section className="resume-upload-layout">
              <div className="resume-upload-card">
                <div className="upload-card-heading">
                  <div className="upload-heading-icon">
                    <FiFileText />
                  </div>

                  <div>
                    <span>
                      Resume Upload
                    </span>

                    <h2>
                      Upload your resume
                    </h2>

                    <p>
                      Upload a PDF to generate a new AI analysis.
                    </p>
                  </div>
                </div>

                {!selectedFile ? (
                  <div
                    className={`resume-drop-zone ${
                      dragActive
                        ? "drag-active"
                        : ""
                    }`}
                    onDragOver={(
                      event
                    ) => {
                      event.preventDefault();

                      setDragActive(
                        true
                      );
                    }}
                    onDragLeave={(
                      event
                    ) => {
                      event.preventDefault();

                      setDragActive(
                        false
                      );
                    }}
                    onDrop={
                      handleDrop
                    }
                    onClick={() =>
                      inputRef.current?.click()
                    }
                  >
                    <input
                      ref={
                        inputRef
                      }
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={
                        handleFileChange
                      }
                      hidden
                    />

                    <div className="drop-icon">
                      <FiUploadCloud />
                    </div>

                    <h3>
                      Drop your resume here
                    </h3>

                    <p>
                      Drag and drop your PDF file, or click to browse.
                    </p>

                    <button
                      type="button"
                      onClick={(
                        event
                      ) => {
                        event.stopPropagation();

                        inputRef.current?.click();
                      }}
                    >
                      Browse files
                    </button>

                    <span className="file-limit">
                      PDF · Max 10 MB
                    </span>
                  </div>
                ) : (
                  <div className="selected-resume-file">
                    <div className="selected-file-main">
                      <div className="selected-file-icon">
                        <FiFileText />
                      </div>

                      <div className="selected-file-copy">
                        <strong>
                          {
                            selectedFile.name
                          }
                        </strong>

                        <span>
                          {formatFileSize(
                            selectedFile.size
                          )}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="remove-resume-btn"
                        onClick={() => {
                          setSelectedFile(
                            null
                          );

                          if (
                            inputRef.current
                          ) {
                            inputRef.current.value =
                              "";
                          }
                        }}
                      >
                        <FiX />
                      </button>
                    </div>

                    <div className="selected-file-status">
                      <FiCheckCircle />

                      Ready for analysis
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="analyze-resume-btn"
                  disabled={
                    !selectedFile ||
                    loading
                  }
                  onClick={() =>
                    void analyzeResume()
                  }
                >
                  {loading ? (
                    <>
                      <span className="resume-loader" />

                      Analyzing resume...
                    </>
                  ) : (
                    <>
                      <FiZap />

                      Analyze Resume

                      <FiArrowRight />
                    </>
                  )}
                </button>
              </div>

              <aside className="resume-upload-side">
                <div className="analysis-features-card">
                  <span className="side-card-eyebrow">
                    AI Analysis
                  </span>

                  <h2>
                    What we analyze
                  </h2>

                  <div className="analysis-features-list">
                    <div>
                      <div className="feature-icon">
                        <FiTarget />
                      </div>

                      <div>
                        <strong>
                          ATS Compatibility
                        </strong>

                        <span>
                          Keywords, parsing and ATS readiness.
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="feature-icon">
                        <FiFileText />
                      </div>

                      <div>
                        <strong>
                          Content Quality
                        </strong>

                        <span>
                          Clarity, achievements and professional impact.
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="feature-icon">
                        <FiTrendingUp />
                      </div>

                      <div>
                        <strong>
                          Career Strength
                        </strong>

                        <span>
                          Skills, experience and improvement opportunities.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="resume-tip-card">
                  <FiStar />

                  <div>
                    <strong>
                      Saved automatically
                    </strong>

                    <span>
                      Every analyzed resume is stored in your resume history.
                    </span>
                  </div>
                </div>
              </aside>
            </section>

            {/* HISTORY */}

            <section className="resume-history-section">
              <div className="resume-history-header">
                <div>
                  <span>
                    Your resumes
                  </span>

                  <h2>
                    Previous analyses
                  </h2>
                </div>

                <span className="history-count">
                  {history.length}
                </span>
              </div>

              {historyLoading ? (
                <div className="history-empty">
                  Loading resume history...
                </div>
              ) : history.length ===
                0 ? (
                <div className="history-empty">
                  <FiFileText />

                  <strong>
                    No resume history yet
                  </strong>

                  <span>
                    Your analyzed resumes will appear here.
                  </span>
                </div>
              ) : (
                <div className="resume-history-grid">
                  {history.map(
                    (
                      analysis
                    ) => (
                      <article
                        key={
                          analysis.analysisId
                        }
                        className="resume-history-card"
                      >
                        <div className="history-file-icon">
                          <FiFileText />
                        </div>

                        <div className="history-file-info">
                          <strong>
                            {
                              analysis.fileName
                            }
                          </strong>

                          <span>
                            <FiClock />

                            {formatDate(
                              analysis.createdAt
                            )}
                          </span>
                        </div>

                        <div className="history-score">
                          <strong>
                            {
                              analysis.overallScore
                            }
                          </strong>

                          <span>
                            /100
                          </span>
                        </div>

                        <div className="history-actions">
                          <button
                            type="button"
                            className="history-view-btn"
                            onClick={() => {
                              if (
                                analysis.analysisId
                              ) {
                                void openAnalysis(
                                  analysis.analysisId
                                );
                              }
                            }}
                          >
                            <FiEye />

                            View Analysis
                          </button>

                          <button
                            type="button"
                            className="history-delete-btn"
                            onClick={() => {
                              if (
                                analysis.analysisId
                              ) {
                                void deleteAnalysis(
                                  analysis.analysisId
                                );
                              }
                            }}
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </article>
                    )
                  )}
                </div>
              )}
            </section>
          </>
        )}

        {/* =================================
            RESULT
        ================================= */}

        {result && (
          <section className="resume-results">
            <button
              type="button"
              className="back-to-resumes-btn"
              onClick={
                newAnalysis
              }
            >
              <FiArrowLeft />

              Back to resumes
            </button>

            <div className="resume-result-layout">
              {/* PDF */}

              <aside className="resume-preview-card">
                <div className="preview-header">
                  <div>
                    <span>
                      Resume preview
                    </span>

                    <strong>
                      {
                        result.fileName
                      }
                    </strong>
                  </div>

                  <FiFileText />
                </div>

                {previewUrl ? (
                  <iframe
                    src={
                      previewUrl
                    }
                    className="resume-pdf-preview"
                    title="Resume PDF preview"
                  />
                ) : (
                  <div className="preview-loading">
                    Loading resume preview...
                  </div>
                )}
              </aside>

              {/* ANALYSIS */}

              <div className="resume-result-content">
                <div className="resume-score-card">
                  <div className="score-card-left">
                    <span className="result-eyebrow">
                      Resume Score
                    </span>

                    <h2>
                      Your resume analysis
                    </h2>

                    <p>
                      {
                        result.summary
                      }
                    </p>

                    <div className="analyzed-file">
                      <FiFileText />

                      {
                        result.fileName
                      }
                    </div>
                  </div>

                  <ScoreRing
                    score={
                      result.overallScore
                    }
                  />
                </div>

                <div className="resume-score-grid">
                  {[
                    {
                      title:
                        "ATS Score",
                      value:
                        result.atsScore,
                      icon:
                        <FiTarget />,
                    },

                    {
                      title:
                        "Content",
                      value:
                        result.contentScore,
                      icon:
                        <FiFileText />,
                    },

                    {
                      title:
                        "Structure",
                      value:
                        result.structureScore,
                      icon:
                        <FiTrendingUp />,
                    },

                    {
                      title:
                        "Skills",
                      value:
                        result.skillsScore,
                      icon:
                        <FiAward />,
                    },

                    {
                      title:
                        "Experience",
                      value:
                        result.experienceScore,
                      icon:
                        <FiStar />,
                    },
                  ].map(
                    (
                      metric
                    ) => (
                      <article
                        className="resume-metric-card"
                        key={
                          metric.title
                        }
                      >
                        <div className="metric-card-top">
                          <div className="metric-icon">
                            {
                              metric.icon
                            }
                          </div>

                          <span>
                            {
                              metric.title
                            }
                          </span>
                        </div>

                        <strong>
                          {
                            metric.value
                          }
                          %
                        </strong>

                        <div className="metric-progress">
                          <div
                            style={{
                              width: `${metric.value}%`,
                            }}
                          />
                        </div>
                      </article>
                    )
                  )}
                </div>

                <div className="resume-analysis-grid">
                  <article className="resume-analysis-card strengths-card">
                    <div className="analysis-card-heading">
                      <div className="analysis-card-icon">
                        <FiCheckCircle />
                      </div>

                      <div>
                        <span>
                          What works
                        </span>

                        <h3>
                          Strengths
                        </h3>
                      </div>
                    </div>

                    <div className="resume-list">
                      {result.strengths.map(
                        (
                          item,
                          index
                        ) => (
                          <div
                            key={
                              index
                            }
                          >
                            <FiCheck />

                            <p>
                              {
                                item
                              }
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </article>

                  <article className="resume-analysis-card improvement-card">
                    <div className="analysis-card-heading">
                      <div className="analysis-card-icon">
                        <FiTarget />
                      </div>

                      <div>
                        <span>
                          Opportunities
                        </span>

                        <h3>
                          Areas to Improve
                        </h3>
                      </div>
                    </div>

                    <div className="resume-list">
                      {result.weaknesses.map(
                        (
                          item,
                          index
                        ) => (
                          <div
                            key={
                              index
                            }
                          >
                            <FiArrowRight />

                            <p>
                              {
                                item
                              }
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </article>

                  <article className="resume-analysis-card skills-card">
                    <div className="analysis-card-heading">
                      <div className="analysis-card-icon">
                        <FiZap />
                      </div>

                      <div>
                        <span>
                          Skill gaps
                        </span>

                        <h3>
                          Recommended Skills
                        </h3>
                      </div>
                    </div>

                    <div className="recommended-skills">
                      {result.recommendedSkills.map(
                        (
                          skill,
                          index
                        ) => (
                          <span
                            key={
                              index
                            }
                          >
                            {
                              skill
                            }
                          </span>
                        )
                      )}
                    </div>
                  </article>

                  <article className="resume-analysis-card recommendations-card">
                    <div className="analysis-card-heading">
                      <div className="analysis-card-icon">
                        <FiTrendingUp />
                      </div>

                      <div>
                        <span>
                          Next steps
                        </span>

                        <h3>
                          AI Recommendations
                        </h3>
                      </div>
                    </div>

                    <div className="recommendation-list">
                      {result.recommendations.map(
                        (
                          recommendation,
                          index
                        ) => (
                          <div
                            key={
                              index
                            }
                          >
                            <span>
                              {String(
                                index +
                                  1
                              ).padStart(
                                2,
                                "0"
                              )}
                            </span>

                            <p>
                              {
                                recommendation
                              }
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </article>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    );
  };

export default ResumeAnalysisPage;