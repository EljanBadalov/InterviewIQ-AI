import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import { City, Country, State } from "country-state-city";

import {
  FiAlertCircle,
  FiArrowRight,
  FiBriefcase,
  FiCheck,
  FiClock,
  FiRefreshCw,
  FiSettings,
  FiTarget,
  FiTrendingUp,
  FiX,
  FiZap,
} from "react-icons/fi";

import {
  getCareerAutomation,
  getCareerAutomationSummary,
  getCareerFields,
  isCareerAutomationNotFoundError,
  replanCareerAutomation,
  refreshExternalCareerJobs,
  getExternalCareerJobMatches,
  updateCareerJobPreferences,
  type ICareerAutomation,
  type ICareerAutomationSummary,
  type ICareerFieldOption,
  type IExternalCareerJobMatch,
} from "../../../api/careerAutomationApi";

import "./careerAutomationPage.scss";

/* =========================================================
   TYPES
========================================================= */

type SkillStatus = "strong" | "priority" | "next" | "later";

type WorkModeInput = "any" | "remote" | "hybrid" | "onsite";

type PreferencesMessageType = "success" | "warning" | "error" | null;

interface ISkillNode {
  id: string;

  label: string;

  status: SkillStatus;

  score?: number;

  x: number;

  y: number;

  reason: string;

  milestoneId?: string;

  category?: string;

  recommendationTitle?: string;

  whatToLearn: string[];

  action?: string;

  proofOfCompletion?: string;

  priority?: "high" | "medium" | "low";

  source?: string;

  evidence: string[];
}

/* =========================================================
   CONSTANTS
========================================================= */

const DAILY_JOB_TARGET = 3;

/* =========================================================
   HELPERS
========================================================= */

const uniqueStrings = (
  values:
    Array<
      string |
      undefined |
      null
    >
): string[] => {
  const seen =
    new Set<string>();

  const result:
    string[] =
      [];

  for (
    const rawValue
    of values
  ) {
    const value =
      (
        rawValue ||
        ""
      )
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    if (!value) {
      continue;
    }

    const key =
      value.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
};

const roadmapCategoryToStatus = ({
  readinessScore,
  priority,
  completed,
}: {
  readinessScore?: number;

  priority?:
    "high" |
    "medium" |
    "low";

  completed: boolean;
}): SkillStatus => {
  if (
    completed ||
    (
      typeof readinessScore ===
        "number" &&
      readinessScore >= 80
    )
  ) {
    return "strong";
  }

  if (
    priority === "high" ||
    (
      typeof readinessScore ===
        "number" &&
      readinessScore < 50
    )
  ) {
    return "priority";
  }

  if (
    priority === "medium" ||
    (
      typeof readinessScore ===
        "number" &&
      readinessScore < 75
    )
  ) {
    return "next";
  }

  return "later";
};

const buildSkillNodesFromRoadmap = (
  automation:
    ICareerAutomation
): ISkillNode[] => {
  const ROADMAP_START_X = 74;
  const ROADMAP_HORIZONTAL_GAP = 205;

  const ROADMAP_ROWS = [
    104,
    246,
  ];

  const nodes:
    ISkillNode[] =
      [];

  let visualIndex =
    0;

  for (
    const milestone
    of automation.roadmap
  ) {
    const recommendations =
      milestone.recommendations ||
      [];

    if (
      recommendations.length > 0
    ) {
      for (
        const [
          recommendationIndex,
          recommendation,
        ]
        of recommendations.entries()
      ) {
        const label =
          (
            recommendation.title ||
            milestone.title
          )
            .replace(
              /\s+/g,
              " "
            )
            .trim();

        if (!label) {
          continue;
        }

        const score =
          typeof milestone.readinessScore ===
            "number"
            ? Math.max(
                0,
                Math.min(
                  100,
                  Math.round(
                    milestone.readinessScore
                  )
                )
              )
            : undefined;

        const status =
          roadmapCategoryToStatus({
            readinessScore:
              score,

            priority:
              recommendation.priority,

            completed:
              milestone.status ===
              "completed",
          });

        nodes.push({
          id:
            `${milestone.id}-${recommendationIndex}`,

          label,

          status,

          score,

          x:
            ROADMAP_START_X +
            visualIndex *
              ROADMAP_HORIZONTAL_GAP,

          y:
            ROADMAP_ROWS[
              visualIndex %
              ROADMAP_ROWS.length
            ],

          reason:
            (
              recommendation.whyItMatters ||
              milestone.reason ||
              milestone.description ||
              "This recommendation supports your target role."
            )
              .replace(
                /\s+/g,
                " "
              )
              .trim(),

          milestoneId:
            milestone.id,

          category:
            milestone.category,

          recommendationTitle:
            recommendation.title,

          whatToLearn:
            uniqueStrings(
              recommendation.whatToLearn ||
              []
            ),

          action:
            recommendation.action,

          proofOfCompletion:
            recommendation.proofOfCompletion,

          priority:
            recommendation.priority,

          source:
            recommendation.source,

          evidence:
            uniqueStrings(
              recommendation.evidence ||
              []
            ),
        });

        visualIndex += 1;
      }

      continue;
    }

    const label =
      milestone.title
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    const score =
      typeof milestone.readinessScore ===
        "number"
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                milestone.readinessScore
              )
            )
          )
        : undefined;

    nodes.push({
      id:
        milestone.id,

      label,

      status:
        roadmapCategoryToStatus({
          readinessScore:
            score,

          completed:
            milestone.status ===
            "completed",
        }),

      score,

      x:
        ROADMAP_START_X +
        visualIndex *
          ROADMAP_HORIZONTAL_GAP,

      y:
        ROADMAP_ROWS[
          visualIndex %
          ROADMAP_ROWS.length
        ],

      reason:
        milestone.reason ||
        milestone.description ||
        "This roadmap section supports your target role.",

      milestoneId:
        milestone.id,

      category:
        milestone.category,

      whatToLearn:
        uniqueStrings(
          milestone.relatedSkills ||
          []
        ),

      evidence:
        [],
    });

    visualIndex += 1;
  }

  return nodes.slice(
    0,
    18
  );
};

const formatDate = (value?: string): string => {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",

    day: "numeric",
  }).format(date);
};


/* =========================================================
   FRESH JOB RESPONSE NORMALIZER
========================================================= */

type ExternalJobRefreshResult = Awaited<
  ReturnType<typeof refreshExternalCareerJobs>
>;

type ExternalJobRefreshItem = ExternalJobRefreshResult["jobs"][number];

const getStringArrayField = (
  value: unknown,
): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === "string",
  );
};

const normalizeFreshJobMatch = (
  item: ExternalJobRefreshItem,
): IExternalCareerJobMatch => {
  const rawJob = item.job as typeof item.job & {
    keywords?: unknown;
  };

  return {
    job: {
      _id: rawJob._id,
      title: rawJob.title,
      company: rawJob.company,
      location: rawJob.location,
      remoteType: rawJob.remoteType,
      employmentType: rawJob.employmentType,
      experienceLevel: rawJob.experienceLevel,
      description: rawJob.description,
      skills: rawJob.skills || [],
      keywords: getStringArrayField(rawJob.keywords),
      source: rawJob.source,
      externalUrl: rawJob.externalUrl,
      postedAt: rawJob.postedAt,
    },
    matchScore: item.matchScore,
    matchedSkills: item.matchedSkills || [],
    missingSkills: item.missingSkills || [],
  };
};

const normalizeFreshJobMatches = (
  jobs: ExternalJobRefreshResult["jobs"],
): IExternalCareerJobMatch[] => {
  return jobs.map(normalizeFreshJobMatch);
};

/* =========================================================
   COMPONENT
========================================================= */

const CareerAutomationPage: React.FC = () => {
  const navigate = useNavigate();

  /* =====================================================
       MAIN DATA
    ===================================================== */

  const [automation, setAutomation] = useState<ICareerAutomation | null>(null);

  const [summary, setSummary] = useState<ICareerAutomationSummary | null>(null);

  const [loading, setLoading] = useState(true);

  const [actionKey, setActionKey] = useState<string | null>(null);

  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  /* =====================================================
       EXTERNAL JOBS
    ===================================================== */

  const [externalJobs, setExternalJobs] = useState<IExternalCareerJobMatch[]>(
    [],
  );

  const [jobsLoading, setJobsLoading] = useState(false);

  const [jobsError, setJobsError] = useState<string | null>(null);

  /* =====================================================
       JOB PREFERENCES
    ===================================================== */

  const [jobPreferencesOpen, setJobPreferencesOpen] = useState(false);

  const [targetRoleInput, setTargetRoleInput] = useState("");

  const [locationInput, setLocationInput] = useState("");

  const [careerFields, setCareerFields] = useState<ICareerFieldOption[]>([]);

  const [careerFieldsLoading, setCareerFieldsLoading] = useState(false);

  const [careerFieldsError, setCareerFieldsError] = useState<string | null>(null);

  const [countryCodeInput, setCountryCodeInput] = useState("");

  const [subdivisionCodeInput, setSubdivisionCodeInput] = useState("");

  const [cityInput, setCityInput] = useState("");

  const [locationSelectionTouched, setLocationSelectionTouched] = useState(false);

  const [workModeInput, setWorkModeInput] = useState<WorkModeInput>("any");

  const [preferencesSaving, setPreferencesSaving] = useState(false);

  const [preferencesMessage, setPreferencesMessage] = useState<string | null>(
    null,
  );

  const [preferencesMessageType, setPreferencesMessageType] =
    useState<PreferencesMessageType>(null);

  /* =====================================================
       LOAD AUTOMATION
    ===================================================== */

  const loadAutomation = useCallback(async () => {
    try {
      setLoading(true);

      setError(null);

      const [automationData, summaryData] = await Promise.all([
        getCareerAutomation(),
        getCareerAutomationSummary(),
      ]);

      setAutomation(automationData);

      setSummary(summaryData);
    } catch (requestError) {
      if (isCareerAutomationNotFoundError(requestError)) {
        setAutomation(null);

        setSummary(null);

        return;
      }

      console.error("[Career Automation Page] Load failed:", requestError);

      setError("Career roadmap could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* =====================================================
       LOAD EXTERNAL JOBS
    ===================================================== */

  const loadExternalJobs = useCallback(
    async (forceRefresh: boolean = false) => {
      try {
        setJobsLoading(true);

        setJobsError(null);

        /*
         * When the user explicitly searches again, use the fresh
         * jobs returned by the refresh endpoint directly.
         *
         * Do NOT refresh and then immediately reload saved matches,
         * because that can reintroduce stale CareerAutomation
         * jobMatches from the previous recommendation cycle.
         */
        if (forceRefresh) {
          const refreshed = await refreshExternalCareerJobs();

          setExternalJobs(normalizeFreshJobMatches(refreshed.jobs || []));

          return;
        }

        /*
         * Initial page load can use the already saved matches so
         * opening Career Automation does not trigger a new ATS search.
         */
        const result = await getExternalCareerJobMatches();

        setExternalJobs(result.jobs || []);
      } catch (requestError) {
        console.error(
          "[Career Automation] External jobs failed:",
          requestError,
        );

        setJobsError("Real job opportunities could not be loaded.");
      } finally {
        setJobsLoading(false);
      }
    },
    [],
  );

  /* =====================================================
       INITIAL LOAD
    ===================================================== */

  useEffect(() => {
    void loadAutomation();
  }, [loadAutomation]);

  useEffect(() => {
    if (!automation) {
      return;
    }

    void loadExternalJobs(false);
  }, [automation?._id, loadExternalJobs]);

  /* =====================================================
       LOAD CAREER FIELDS
    ===================================================== */

  useEffect(() => {
    let cancelled = false;

    const loadCareerFields = async () => {
      try {
        setCareerFieldsLoading(true);

        setCareerFieldsError(null);

        const result = await getCareerFields();

        if (!cancelled) {
          setCareerFields(result.fields || []);
        }
      } catch (requestError) {
        console.error(
          "[Career Automation] Career fields failed:",
          requestError,
        );

        if (!cancelled) {
          setCareerFieldsError("Career fields could not be loaded.");
        }
      } finally {
        if (!cancelled) {
          setCareerFieldsLoading(false);
        }
      }
    };

    void loadCareerFields();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =====================================================
       LOCATION OPTIONS

       Progressive flow:
       1. Country
       2. State / Region / District (only when the selected
          country has administrative subdivisions)
       3. City

       The next control is rendered only after the previous
       selection is made.
    ===================================================== */

  const countryOptions = useMemo(() => {
    return [...Country.getAllCountries()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, []);

  const subdivisionOptions = useMemo(() => {
    if (!countryCodeInput) {
      return [];
    }

    return [...State.getStatesOfCountry(countryCodeInput)].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [countryCodeInput]);

  const hasSubdivisions = subdivisionOptions.length > 0;

  const cityOptions = useMemo(() => {
    if (!countryCodeInput) {
      return [];
    }

    /*
     * Countries such as the United States expose cities under
     * a state/region. Countries without subdivisions can load
     * their cities directly.
     */
    const cities = hasSubdivisions
      ? subdivisionCodeInput
        ? City.getCitiesOfState(countryCodeInput, subdivisionCodeInput)
        : []
      : City.getCitiesOfCountry(countryCodeInput);

    return [...(cities || [])].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [
    countryCodeInput,
    hasSubdivisions,
    subdivisionCodeInput,
  ]);

  const selectedCity = useMemo(() => {
    if (!cityInput) {
      return undefined;
    }

    return cityOptions.find((city) => city.name === cityInput);
  }, [cityInput, cityOptions]);

  const getSubdivisionLabel = useCallback((): string => {
    if (!countryCodeInput) {
      return "State / Region / District";
    }

    /*
     * Keep the UI generic because administrative divisions vary
     * by country: state, province, region, district, governorate,
     * prefecture, etc.
     */
    if (countryCodeInput === "US") {
      return "State";
    }

    if (countryCodeInput === "CA") {
      return "Province / Territory";
    }

    if (countryCodeInput === "AU") {
      return "State / Territory";
    }

    return "Region / District";
  }, [countryCodeInput]);

  const buildSelectedLocation = useCallback((): string => {
    /*
     * Location is optional.
     *
     * No country selected:
     *   "" -> worldwide search
     *
     * Country selected only:
     *   "United States"
     *
     * Country + state/region:
     *   "Massachusetts, United States"
     *
     * Full selection:
     *   "Boston, MA" (US)
     *   "Baku, Azerbaijan" (other countries)
     */
    if (!countryCodeInput) {
      return "";
    }

    const country = Country.getCountryByCode(countryCodeInput);

    const subdivision =
      hasSubdivisions && subdivisionCodeInput
        ? State.getStateByCodeAndCountry(
            subdivisionCodeInput,
            countryCodeInput,
          )
        : undefined;

    if (!selectedCity) {
      return [
        subdivision?.name,
        country?.name,
      ]
        .filter(Boolean)
        .join(", ");
    }

    if (countryCodeInput === "US") {
      return subdivision?.isoCode
        ? `${selectedCity.name}, ${subdivision.isoCode}`
        : selectedCity.name;
    }

    return [
      selectedCity.name,
      subdivision?.name,
      country?.name,
    ]
      .filter(Boolean)
      .join(", ");
  }, [
    countryCodeInput,
    hasSubdivisions,
    selectedCity,
    subdivisionCodeInput,
  ]);

  /* =====================================================
       SYNC JOB PREFERENCES
    ===================================================== */

  useEffect(() => {
    if (!automation) {
      return;
    }

    setTargetRoleInput(automation.targetRole || "");

    setLocationInput(automation.jobPreferences.locations?.[0] || "");

    setCountryCodeInput("");

    setSubdivisionCodeInput("");

    setCityInput("");

    setLocationSelectionTouched(false);

    const savedWorkModes = automation.jobPreferences.workModes || [];

    if (savedWorkModes.length === 1) {
      setWorkModeInput(savedWorkModes[0]);
    } else {
      setWorkModeInput("any");
    }
  }, [
    automation?._id,
    automation?.targetRole,
    automation?.jobPreferences?.locations,
    automation?.jobPreferences?.workModes,
  ]);

  /* =====================================================
       SKILLS
    ===================================================== */

  const skillNodes: ISkillNode[] =
    useMemo(() => {
      if (!automation) {
        return [];
      }

      return buildSkillNodesFromRoadmap(
        automation
      );
    }, [
      automation,
    ]);

  const selectedSkill =
    selectedSkillId
      ? skillNodes.find(
          (node) =>
            node.id === selectedSkillId
        ) || null
      : null;

  /*
   * Do NOT auto-select the first roadmap node.
   *
   * selectedSkillId === null means the roadmap view should be visible.
   * This is what allows "Back to roadmap" to work correctly.
   *
   * If the roadmap is rebuilt while a detail is open and that selected
   * node no longer exists, close the detail view safely.
   */
  useEffect(() => {
    if (
      selectedSkillId &&
      !skillNodes.some(
        (node) =>
          node.id === selectedSkillId
      )
    ) {
      setSelectedSkillId(null);
    }
  }, [
    selectedSkillId,
    skillNodes,
  ]);

  /* =====================================================
       REPLAN
    ===================================================== */

  const handleReplan = async () => {
    try {
      setActionKey("replan");

      setError(null);

      const result = await replanCareerAutomation(
        "Recalculate the roadmap around my target role, weakest skill gaps, and current career progress.",
      );

      setAutomation(result.automation);

      setSummary(result.summary);
    } catch (requestError) {
      console.error(requestError);

      setError("Career roadmap could not be recalculated.");
    } finally {
      setActionKey(null);
    }
  };

  /* =====================================================
       OPEN JOB PREFERENCES
    ===================================================== */

  const handleOpenJobPreferences = () => {
    if (automation) {
      setTargetRoleInput(automation.targetRole || "");

      setLocationInput(automation.jobPreferences.locations?.[0] || "");

      setCountryCodeInput("");

        setCityInput("");

      setLocationSelectionTouched(false);

      const savedWorkModes = automation.jobPreferences.workModes || [];

      setWorkModeInput(savedWorkModes.length === 1 ? savedWorkModes[0] : "any");
    }

    setPreferencesMessage(null);

    setPreferencesMessageType(null);

    setJobPreferencesOpen(true);
  };

  /* =====================================================
       CANCEL JOB PREFERENCES
    ===================================================== */

  const handleCancelJobPreferences = () => {
    if (automation) {
      setTargetRoleInput(automation.targetRole || "");

      setLocationInput(automation.jobPreferences.locations?.[0] || "");

      setCountryCodeInput("");

        setCityInput("");

      setLocationSelectionTouched(false);

      const savedWorkModes = automation.jobPreferences.workModes || [];

      setWorkModeInput(savedWorkModes.length === 1 ? savedWorkModes[0] : "any");
    }

    setPreferencesMessage(null);

    setPreferencesMessageType(null);

    setJobPreferencesOpen(false);
  };

  /* =====================================================
       SAVE JOB PREFERENCES
    ===================================================== */

  const handleSaveJobPreferences = async () => {
    const targetRole = targetRoleInput.replace(/\s+/g, " ").trim();

    const selectedStructuredLocation = buildSelectedLocation();

    const location = locationSelectionTouched
      ? selectedStructuredLocation
      : locationInput.replace(/\s+/g, " ").trim();

    if (!targetRole) {
      setPreferencesMessage("Target role is required.");

      setPreferencesMessageType("error");

      return;
    }

    if (
      careerFields.length > 0 &&
      !careerFields.some((field) => field.name === targetRole)
    ) {
      setPreferencesMessage("Please select a target role from the available career fields.");

      setPreferencesMessageType("error");

      return;
    }

    try {
      setPreferencesSaving(true);

      setPreferencesMessage(null);

      setPreferencesMessageType(null);

      setJobsError(null);

      /* ===============================================
             STEP 1
             SAVE PREFERENCES
          =============================================== */

      const result = await updateCareerJobPreferences({
        targetRole,

        enabled: true,

        /*
         * Empty locations means worldwide search.
         */
        locations: location ? [location] : [],

        workModes: workModeInput === "any" ? [] : [workModeInput],
      });

      setAutomation(result.automation);

      if (result.summary) {
        setSummary(result.summary);
      }

      setPreferencesMessage("Job search preferences saved successfully.");

      setPreferencesMessageType("success");

      /* ===============================================
             STEP 2
             SEARCH NEW JOBS

             Important:
             This has its own try/catch.
          =============================================== */

      try {
        setJobsLoading(true);

        /*
         * The refresh endpoint already returns the newly ranked
         * recommendation set. Use it directly instead of loading
         * older saved matches immediately afterwards.
         */
        const refreshed = await refreshExternalCareerJobs();

        setExternalJobs(normalizeFreshJobMatches(refreshed.jobs || []));

        setPreferencesMessage(
          "Preferences saved and new job opportunities loaded.",
        );

        setPreferencesMessageType("success");

        setJobPreferencesOpen(false);
      } catch (searchError) {
        console.error(
          "[Career Automation] Job search failed after preferences were saved:",
          searchError,
        );

        setPreferencesMessage(
          "Preferences were saved, but new jobs could not be loaded. You can try searching again.",
        );

        setPreferencesMessageType("warning");

        setJobsError(
          "Your job preferences were saved, but InterviewIQ could not load new opportunities.",
        );
      } finally {
        setJobsLoading(false);
      }
    } catch (requestError) {
      console.error(
        "[Career Automation] Preferences update failed:",
        requestError,
      );

      setPreferencesMessage("Could not save job search preferences.");

      setPreferencesMessageType("error");
    } finally {
      setPreferencesSaving(false);
    }
  };

  /* =====================================================
       LOADING
    ===================================================== */

  if (loading) {
    return (
      <section className="career-graph-page career-graph-page--skeleton">
        {/* ===================================================
              HEADER SKELETON
          =================================================== */}

        <header className="career-graph-header career-graph-header--skeleton">
          <div className="career-header-skeleton-copy">
            <span className="career-skeleton career-skeleton--eyebrow" />
            <span className="career-skeleton career-skeleton--page-title" />
            <span className="career-skeleton career-skeleton--header-copy" />
            <span className="career-skeleton career-skeleton--header-copy career-skeleton--header-copy-short" />
          </div>

          <div className="career-graph-header-actions career-graph-header-actions--skeleton">
            <span className="career-skeleton career-skeleton--header-action" />
            <span className="career-skeleton career-skeleton--header-action career-skeleton--header-action-wide" />
            <span className="career-skeleton career-skeleton--header-action career-skeleton--header-action-wide" />
          </div>
        </header>

        {/* ===================================================
              PREFERENCES SKELETON
          =================================================== */}

        <div className="career-current-job-preferences career-current-job-preferences--skeleton">
          {[1, 2, 3, 4].map((item) => (
            <div key={item}>
              <span className="career-skeleton career-skeleton--pref-label" />
              <span className="career-skeleton career-skeleton--pref-value" />
            </div>
          ))}
        </div>

        {/* ===================================================
              ROADMAP SKELETON
          =================================================== */}

        <section className="career-roadmap-shell">
          <article className="career-skill-map-card career-skill-map-card--full career-roadmap-skeleton-card">
            <div className="career-section-heading career-section-heading--roadmap career-section-heading--skeleton">
              <div>
                <span className="career-skeleton career-skeleton--section-label" />
                <span className="career-skeleton career-skeleton--section-title" />
                <span className="career-skeleton career-skeleton--section-copy" />
              </div>

              <div className="career-skeleton-legend">
                {[1, 2, 3, 4].map((item) => (
                  <span
                    className="career-skeleton career-skeleton--legend-pill"
                    key={item}
                  />
                ))}
              </div>
            </div>

            <div className="career-skill-map-scroll">
              <div className="career-skill-map-canvas career-skill-map-canvas--skeleton">
                <svg
                  className="career-skill-map-lines career-skill-map-lines--skeleton"
                  viewBox="0 0 1180 405"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M 130 140 C 210 140, 250 282, 330 282" />
                  <path d="M 330 282 C 410 282, 455 140, 535 140" />
                  <path d="M 535 140 C 615 140, 660 282, 740 282" />
                  <path d="M 740 282 C 820 282, 865 140, 945 140" />
                </svg>

                <div className="career-skeleton-node career-skeleton-node--one">
                  <span className="career-skeleton career-skeleton--node-title" />
                  <span className="career-skeleton career-skeleton--node-subtitle" />
                </div>

                <div className="career-skeleton-node career-skeleton-node--two">
                  <span className="career-skeleton career-skeleton--node-title" />
                  <span className="career-skeleton career-skeleton--node-subtitle" />
                </div>

                <div className="career-skeleton-node career-skeleton-node--three">
                  <span className="career-skeleton career-skeleton--node-title" />
                  <span className="career-skeleton career-skeleton--node-subtitle" />
                </div>

                <div className="career-skeleton-node career-skeleton-node--four">
                  <span className="career-skeleton career-skeleton--node-title" />
                  <span className="career-skeleton career-skeleton--node-subtitle" />
                </div>

                <div className="career-skeleton-node career-skeleton-node--five">
                  <span className="career-skeleton career-skeleton--node-title" />
                  <span className="career-skeleton career-skeleton--node-subtitle" />
                </div>
              </div>
            </div>
          </article>
        </section>

        {/* ===================================================
              OPPORTUNITIES SKELETON
          =================================================== */}

        <div className="career-opportunities-section">
          <article className="career-job-card career-job-card--skeleton">
            <div className="career-section-heading compact career-section-heading--jobs-skeleton">
              <div className="career-opportunities-title-group">
                <span className="career-skeleton career-skeleton--jobs-icon" />

                <div>
                  <span className="career-skeleton career-skeleton--section-label" />
                  <span className="career-skeleton career-skeleton--jobs-title" />
                  <span className="career-skeleton career-skeleton--jobs-copy" />
                </div>
              </div>

              <span className="career-skeleton career-skeleton--search-button" />
            </div>

            <div className="career-job-list career-job-list--skeleton">
              {[1, 2, 3].map((item) => (
                <div className="career-job-row-skeleton" key={item}>
                  <span className="career-skeleton career-skeleton--job-score" />

                  <div>
                    <span className="career-skeleton career-skeleton--job-title" />
                    <span className="career-skeleton career-skeleton--job-company" />
                    <span className="career-skeleton career-skeleton--job-description" />
                  </div>

                  <span className="career-skeleton career-skeleton--job-action" />
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    );
  }

  /* =====================================================
       NO AUTOMATION
    ===================================================== */

  if (!automation) {
    return (
      <section className="career-graph-page">
        <div className="career-graph-empty">
          <FiTarget />

          <h1>Career Automation</h1>

          <p>
            Create your Career Automation profile first so InterviewIQ can build
            a personalized skill roadmap.
          </p>
        </div>
      </section>
    );
  }

  /* =====================================================
       DERIVED VALUES
    ===================================================== */

  const readiness = Math.round(
    summary?.currentReadinessScore ?? automation.currentReadinessScore ?? 0,
  );

  const selectedTopics =
    selectedSkill?.whatToLearn ||
    [];

  const visibleJobs = externalJobs.slice(0, DAILY_JOB_TARGET);

  const selectedLocation =
    automation.jobPreferences.locations?.[0] || "Any location";

  const selectedWorkModes = automation.jobPreferences.workModes || [];

  const selectedWorkModeLabel =
    selectedWorkModes.length === 0
      ? "Any work mode"
      : selectedWorkModes
          .map((value) =>
            value === "onsite"
              ? "On-site"
              : value.charAt(0).toUpperCase() + value.slice(1),
          )
          .join(", ");

  /* =====================================================
       RENDER
    ===================================================== */

  return (
    <section className="career-graph-page">
      {/* ===================================================
            HEADER
        =================================================== */}

      <header className="career-graph-header">
        <div>
          <span className="career-graph-eyebrow">AI CAREER ROADMAP</span>

          <h1>{automation.targetRole}</h1>

          <p>
            A role-first path built from your current evidence, target-role
            knowledge, skill gaps, and practical next steps.
          </p>
        </div>

        <div className="career-graph-header-actions">
          <div className="career-readiness-pill">
            <FiTrendingUp />

            <span>Readiness</span>

            <strong>{readiness}%</strong>
          </div>

          <button
            type="button"
            className="career-job-preferences-button"
            onClick={handleOpenJobPreferences}
          >
            <FiSettings />
            Job Preferences
          </button>

          <button
            type="button"
            className="career-replan-button"
            onClick={handleReplan}
            disabled={actionKey === "replan"}
          >
            <FiRefreshCw className={actionKey === "replan" ? "spin" : ""} />
            Rebuild roadmap
          </button>
        </div>
      </header>

      {/* ===================================================
            CURRENT JOB SEARCH PREFERENCES
        =================================================== */}

      <div className="career-current-job-preferences">
        <div>
          <span>Target Role</span>

          <strong>{automation.targetRole}</strong>
        </div>

        <div>
          <span>Location</span>

          <strong>{selectedLocation}</strong>
        </div>

        <div>
          <span>Work Mode</span>

          <strong>{selectedWorkModeLabel}</strong>
        </div>

        <div>
          <span>Daily Opportunities</span>

          <strong>3 jobs / day</strong>
        </div>
      </div>

      {/* ===================================================
            ERROR
        =================================================== */}

      {error && (
        <div className="career-graph-alert">
          <FiAlertCircle />

          <span>{error}</span>
        </div>
      )}

      {/* ===================================================
            ROADMAP / FULL-WIDTH DETAIL
        =================================================== */}

      <section className="career-roadmap-shell">
        {!selectedSkill ? (
          <article className="career-skill-map-card career-skill-map-card--full">
            <div className="career-section-heading career-section-heading--roadmap">
              <div>
                <span>YOUR SKILL PATH</span>

                <h2>Personalized Skill Roadmap</h2>

                <p>
                  Click any recommendation to open a full learning plan with
                  specific topics, practical action, and proof of completion.
                </p>
              </div>

              <div className="career-skill-legend">
                <span className="strong">Strong</span>

                <span className="priority">Priority gap</span>

                <span className="next">Next</span>

                <span className="later">Later</span>
              </div>
            </div>

            <div className="career-skill-map-scroll">
              <div
                className="career-skill-map-canvas"
                style={{
                  minWidth: `${Math.max(
                    1180,
                    skillNodes.length * 205 + 165,
                  )}px`,
                }}
              >
                <svg
                  className="career-skill-map-lines"
                  viewBox={`0 0 ${Math.max(
                    1180,
                    skillNodes.length * 205 + 165,
                  )} 405`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {skillNodes.slice(0, -1).map((node, index) => {
                    const next = skillNodes[index + 1];

                    if (!next) {
                      return null;
                    }

                    const startX =
                      node.x + 168;

                    const startY =
                      node.y + 36;

                    const endX =
                      next.x;

                    const endY =
                      next.y + 36;

                    const horizontalDistance =
                      Math.max(
                        44,
                        (endX - startX) * 0.46,
                      );

                    const control1X =
                      startX +
                      horizontalDistance;

                    const control2X =
                      endX -
                      horizontalDistance;

                    const path = `M ${startX} ${startY}
                           C ${control1X} ${startY},
                             ${control2X} ${endY},
                             ${endX} ${endY}`;

                    return (
                      <path
                        key={`${node.id}-${next.id}`}
                        d={path}
                      />
                    );
                  })}
                </svg>

                {skillNodes.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    className={`career-skill-node ${node.status}`}
                    style={{
                      left: `${node.x}px`,
                      top: `${node.y}px`,
                    }}
                    onClick={() => setSelectedSkillId(node.id)}
                  >
                    <span className="career-skill-node-index">
                      {node.status === "strong" ? (
                        <FiCheck />
                      ) : node.status === "priority" ? (
                        "!"
                      ) : null}
                    </span>

                    <strong>
                      {node.label}
                    </strong>

                    <small>
                      {typeof node.score === "number"
                        ? `${node.score}% readiness`
                        : "Evidence pending"}
                    </small>
                  </button>
                ))}

                {skillNodes.length === 0 && (
                  <div className="career-roadmap-empty-state">
                    No personalized roadmap recommendations are available yet.
                  </div>
                )}
              </div>
            </div>
          </article>
        ) : (
          <article className="career-skill-full-detail">
            <div className="career-skill-full-detail-topbar">
              <button
                type="button"
                className="career-skill-back-button"
                onClick={() => setSelectedSkillId(null)}
              >
                ← Back to roadmap
              </button>

              <span
                className={`career-detail-status ${selectedSkill.status}`}
              >
                {selectedSkill.status === "priority"
                  ? "High priority"
                  : selectedSkill.status === "strong"
                    ? "Strong"
                    : selectedSkill.status === "next"
                      ? "Next to learn"
                      : "Later"}
              </span>
            </div>

            <div className="career-skill-full-detail-hero">
              <div className="career-skill-full-detail-copy">
                <span className="career-detail-label">
                  SELECTED RECOMMENDATION
                </span>

                <h2>{selectedSkill.label}</h2>

                <p>{selectedSkill.reason}</p>
              </div>

              <div className="career-skill-readiness-card">
                <span>Current readiness</span>

                <strong>
                  {typeof selectedSkill.score === "number"
                    ? `${selectedSkill.score}%`
                    : "Not enough evidence"}
                </strong>

                {typeof selectedSkill.score === "number" && (
                  <div className="career-detail-score-track">
                    <span
                      style={{
                        width: `${selectedSkill.score}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="career-skill-full-detail-grid">
              <section className="career-detail-panel career-detail-panel--topics">
                <div className="career-detail-panel-heading">
                  <div className="career-detail-panel-icon">
                    <FiZap />
                  </div>

                  <div>
                    <span>WHAT TO LEARN</span>

                    <h3>Specific topics for this recommendation</h3>
                  </div>
                </div>

                {selectedTopics.length > 0 ? (
                  <div className="career-detail-topic-grid">
                    {selectedTopics.map((topic, index) => (
                      <div
                        key={`${selectedSkill.id}-${topic}`}
                        className="career-detail-topic-card"
                      >
                        <span>{index + 1}</span>

                        <p>{topic}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="career-detail-empty-message">
                    InterviewIQ does not have enough structured subtopic data
                    for this recommendation yet.
                  </div>
                )}
              </section>

              <section className="career-detail-panel">
                <div className="career-detail-panel-heading">
                  <div>
                    <span>RECOMMENDED ACTION</span>

                    <h3>What you should do next</h3>
                  </div>
                </div>

                <p className="career-detail-panel-text">
                  {selectedSkill.action ||
                    "Complete a realistic exercise or project task that proves this capability in the context of your target role."}
                </p>
              </section>

              <section className="career-detail-panel">
                <div className="career-detail-panel-heading">
                  <div>
                    <span>PROOF OF COMPLETION</span>

                    <h3>How to prove that you learned it</h3>
                  </div>
                </div>

                <p className="career-detail-panel-text">
                  {selectedSkill.proofOfCompletion ||
                    "Keep a concrete artifact such as working code, tests, documentation, analysis, or a project result that demonstrates this skill."}
                </p>
              </section>

              <section className="career-detail-panel career-detail-panel--evidence">
                <div className="career-detail-panel-heading">
                  <div>
                    <span>WHY INTERVIEWIQ RECOMMENDS THIS</span>

                    <h3>Evidence behind the recommendation</h3>
                  </div>
                </div>

                {selectedSkill.evidence.length > 0 ? (
                  <ul className="career-detail-evidence-list">
                    {selectedSkill.evidence
                      .slice(0, 6)
                      .map((item) => (
                        <li key={`${selectedSkill.id}-${item}`}>
                          {item}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="career-detail-panel-text">
                    This recommendation was selected from your target-role
                    roadmap and current career evidence.
                  </p>
                )}
              </section>
            </div>

            <div className="career-skill-full-detail-meta">
              {selectedSkill.priority && (
                <span>
                  Priority:
                  <strong>
                    {selectedSkill.priority.charAt(0).toUpperCase() +
                      selectedSkill.priority.slice(1)}
                  </strong>
                </span>
              )}

              {selectedSkill.source && (
                <span>
                  Source:
                  <strong>
                    {selectedSkill.source
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (char) => char.toUpperCase())}
                  </strong>
                </span>
              )}

              {selectedSkill.category && (
                <span>
                  Category:
                  <strong>
                    {selectedSkill.category
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (char) => char.toUpperCase())}
                  </strong>
                </span>
              )}
            </div>
          </article>
        )}
      </section>

      {/* ===================================================
            OPPORTUNITIES
        =================================================== */}

      <div className="career-opportunities-section">
        <article className="career-job-card">
          <div className="career-section-heading compact">
            <div className="career-opportunities-title-group">
              <FiBriefcase />

              <div>
                <span>TODAY&apos;S OPPORTUNITIES</span>

                <h2>Best jobs matched to your skills</h2>

                <p>
                  InterviewIQ selects your 3 strongest opportunities based on
                  role, location, work mode and your career profile.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="career-opportunities-refresh-button"
              onClick={() => void loadExternalJobs(true)}
            >
              <FiRefreshCw />
              Search again
            </button>
          </div>

          <div className="career-job-list">
            {jobsLoading ? (
              <div className="career-job-list career-job-list--skeleton career-job-list--inline-loading">
                {[1, 2, 3].map((item) => (
                  <div className="career-job-row-skeleton" key={item}>
                    <span className="career-skeleton career-skeleton--job-score" />

                    <div>
                      <span className="career-skeleton career-skeleton--job-title" />
                      <span className="career-skeleton career-skeleton--job-company" />
                      <span className="career-skeleton career-skeleton--job-description" />
                    </div>

                    <span className="career-skeleton career-skeleton--job-action" />
                  </div>
                ))}
              </div>
            ) : jobsError ? (
              <div className="career-job-empty">
                <FiAlertCircle />

                <h3>Could not load opportunities</h3>

                <p>{jobsError}</p>

                <button
                  type="button"
                  onClick={() => void loadExternalJobs(true)}
                >
                  Try again
                </button>
              </div>
            ) : visibleJobs.length > 0 ? (
              visibleJobs.map((item, index) => {
                const job = item.job;

                const matchedSkills = item.matchedSkills?.slice(0, 4) || [];

                return (
                  <article key={job._id} className="career-opportunity-card">
                    <div className="career-opportunity-rank">
                      <span>#{index + 1}</span>
                    </div>

                    <div className="career-opportunity-score">
                      <strong>{Math.round(item.matchScore)}%</strong>

                      <span>MATCH</span>
                    </div>

                    <div className="career-opportunity-content">
                      <div className="career-opportunity-title-row">
                        <div>
                          <div className="career-opportunity-title">
                            <h3>{job.title}</h3>

                            <span className="career-opportunity-source">
                              {job.source}
                            </span>
                          </div>

                          <p className="career-opportunity-company">
                            {job.company}
                          </p>
                        </div>
                      </div>

                      <div className="career-opportunity-meta">
                        {job.location && <span>{job.location}</span>}

                        {job.remoteType && <span>{job.remoteType}</span>}

                        {job.employmentType && (
                          <span>{job.employmentType}</span>
                        )}

                        {job.experienceLevel && (
                          <span>{job.experienceLevel}</span>
                        )}
                      </div>

                      {matchedSkills.length > 0 && (
                        <div className="career-opportunity-skills">
                          <span className="career-opportunity-skills-label">
                            Matched skills
                          </span>

                          <div>
                            {matchedSkills.map((skill) => (
                              <span
                                key={`${job._id}-${skill}`}
                                className="career-opportunity-skill"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="career-opportunity-action">
                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/dashboard/jobs/${job._id}`);
                        }}
                      >
                        View Details
                        <FiArrowRight />
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="career-job-empty">
                <FiBriefcase />

                <h3>No matching vacancies yet</h3>

                <p>
                  No suitable jobs were found for your current role, location
                  and work mode.
                </p>

                <button type="button" onClick={handleOpenJobPreferences}>
                  Change preferences
                </button>
              </div>
            )}
          </div>
        </article>
      </div>

      {/* ===================================================
            FOOTER
        =================================================== */}

      <footer className="career-roadmap-footer">
        <div>
          <FiClock />

          <span>Next plan refresh:</span>

          <strong>{formatDate(summary?.nextDailyPlanAt)}</strong>
        </div>

        <div>
          <FiTarget />

          <span>Career goal:</span>

          <strong>{automation.careerGoal}</strong>
        </div>
      </footer>

      {/* ===================================================
            JOB PREFERENCES MODAL
        =================================================== */}

      {jobPreferencesOpen && (
        <div
          className="career-job-preferences-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !preferencesSaving) {
              handleCancelJobPreferences();
            }
          }}
        >
          <div
            className="career-job-preferences-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="career-job-preferences-title"
          >
            <div className="career-job-preferences-header">
              <div>
                <span className="career-graph-eyebrow">
                  JOB SEARCH SETTINGS
                </span>

                <h2 id="career-job-preferences-title">Job Preferences</h2>

                <p>
                  Choose your target career and optional location. InterviewIQ will select
                  your 3 strongest opportunities.
                </p>
              </div>

              <button
                type="button"
                className="career-job-preferences-close"
                onClick={handleCancelJobPreferences}
                disabled={preferencesSaving}
                aria-label="Close"
              >
                <FiX />
              </button>
            </div>

            <div className="career-job-preferences-grid">
              {/* TARGET ROLE */}

              <label className="career-job-preference-field">
                <span>Target Role</span>

                <select
                  value={targetRoleInput}
                  onChange={(event) => {
                    setTargetRoleInput(event.target.value);

                    setPreferencesMessage(null);

                    setPreferencesMessageType(null);
                  }}
                  disabled={preferencesSaving || careerFieldsLoading}
                >
                  <option value="">
                    {careerFieldsLoading
                      ? "Loading career fields..."
                      : "Select a career field"}
                  </option>

                  {careerFields.map((field) => (
                    <option key={field.slug} value={field.name}>
                      {field.name}
                    </option>
                  ))}
                </select>

                <small>
                  {careerFieldsError
                    ? careerFieldsError
                    : "Choose one of the active career fields available in InterviewIQ."}
                </small>
              </label>

              {/* LOCATION */}

              <div className="career-job-preference-field career-location-field">
                <span>
                  Location <small className="career-field-optional">(Optional)</small>
                </span>

                <div className="career-location-selects progressive">
                  {/* STEP 1: COUNTRY */}
                  <select
                    value={countryCodeInput}
                    onChange={(event) => {
                      setCountryCodeInput(event.target.value);

                      setSubdivisionCodeInput("");

                      setCityInput("");

                      setLocationSelectionTouched(true);

                      setPreferencesMessage(null);

                      setPreferencesMessageType(null);
                    }}
                    disabled={preferencesSaving}
                  >
                    <option value="">Select country</option>

                    {countryOptions.map((country) => (
                      <option key={country.isoCode} value={country.isoCode}>
                        {country.name}
                      </option>
                    ))}
                  </select>

                  {/* STEP 2: STATE / REGION / DISTRICT */}
                  {countryCodeInput && hasSubdivisions && (
                    <select
                      value={subdivisionCodeInput}
                      onChange={(event) => {
                        setSubdivisionCodeInput(event.target.value);

                        setCityInput("");

                        setLocationSelectionTouched(true);

                        setPreferencesMessage(null);

                        setPreferencesMessageType(null);
                      }}
                      disabled={preferencesSaving}
                    >
                      <option value="">
                        Select {getSubdivisionLabel().toLowerCase()}
                      </option>

                      {subdivisionOptions.map((subdivision) => (
                        <option
                          key={subdivision.isoCode}
                          value={subdivision.isoCode}
                        >
                          {subdivision.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* STEP 3: CITY
                      For countries without subdivisions this becomes STEP 2. */}
                  {countryCodeInput &&
                    (!hasSubdivisions || subdivisionCodeInput) && (
                      <select
                        value={cityInput}
                        onChange={(event) => {
                          setCityInput(event.target.value);

                          setLocationSelectionTouched(true);

                          setPreferencesMessage(null);

                          setPreferencesMessageType(null);
                        }}
                        disabled={preferencesSaving}
                      >
                        <option value="">Select city</option>

                        {cityOptions.map((city) => (
                          <option
                            key={`${city.name}-${city.latitude}-${city.longitude}`}
                            value={city.name}
                          >
                            {city.name}
                          </option>
                        ))}
                      </select>
                    )}
                </div>

                <small>
                  {locationSelectionTouched
                    ? buildSelectedLocation() ||
                      "Optional — leave location empty to search worldwide."
                    : locationInput
                      ? `Current saved location: ${locationInput}`
                      : "Optional — leave location empty to search opportunities worldwide."}
                </small>
              </div>

              {/* WORK MODE */}

              <label className="career-job-preference-field">
                <span>Work Mode</span>

                <select
                  value={workModeInput}
                  onChange={(event) => {
                    setWorkModeInput(event.target.value as WorkModeInput);

                    setPreferencesMessage(null);

                    setPreferencesMessageType(null);
                  }}
                  disabled={preferencesSaving}
                >
                  <option value="any">Any work mode</option>

                  <option value="remote">Remote</option>

                  <option value="hybrid">Hybrid</option>

                  <option value="onsite">On-site</option>
                </select>

                <small>
                  Choose whether you prefer remote, hybrid or on-site
                  opportunities.
                </small>
              </label>

              {/* DAILY TARGET */}

              <div className="career-job-preference-summary">
                <span>Daily Opportunities</span>

                <strong>3 jobs / day</strong>

                <small>
                  InterviewIQ automatically selects your 3 strongest matching
                  opportunities each day.
                </small>
              </div>
            </div>

            {preferencesMessage && (
              <p
                className={`career-job-preferences-message ${
                  preferencesMessageType || ""
                }`}
              >
                {preferencesMessage}
              </p>
            )}

            <div className="career-job-preferences-actions">
              <button
                type="button"
                className="career-job-preferences-cancel"
                onClick={handleCancelJobPreferences}
                disabled={preferencesSaving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="career-job-preferences-save"
                onClick={() => void handleSaveJobPreferences()}
                disabled={preferencesSaving || jobsLoading}
              >
                {preferencesSaving || jobsLoading ? (
                  <>
                    <FiRefreshCw className="spin" />
                    Saving & Searching...
                  </>
                ) : (
                  <>
                    <FiBriefcase />
                    Save & Search Jobs
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default CareerAutomationPage;
