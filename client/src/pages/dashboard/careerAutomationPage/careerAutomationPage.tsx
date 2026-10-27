import { useCareerQuery } from '../../../query/useCareerQuery';
import { useApiQuery } from "../../../query/apiQueries";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

type LocationData = typeof import("country-state-city");

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
  isCareerAutomationNotFoundError,
  replanCareerAutomation,
  refreshExternalCareerJobs,
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
    of automation.roadmap.filter(section=>!section.metadata?.retainedForCompletedTasks)
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

        const notes=milestone.metadata?.roadmapNarrative as {nodes?:Array<{learning?:{score:number|null;state:string}}> }|undefined;
        const learning=notes?.nodes?.[recommendationIndex]?.learning;
        const measuredScore=(automation.careerContext?.status!=='current' || (automation.careerContext.evidenceFreshness!==undefined && automation.careerContext.evidenceFreshness!=='current')) ? undefined : learning ? (learning.state==='verified_proficiency'||learning.state==='verified_gap'?learning.score:undefined) : (milestone.category==='CORE_SKILLS'||milestone.category==='ROLE_SKILLS'?undefined:milestone.readinessScore);
        const score =
          typeof measuredScore ===
            "number"
            ? Math.max(
                0,
                Math.min(
                  100,
                  Math.round(
                    measuredScore
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
              "completed" && milestone.metadata?.completionContext!=='unverified-history',
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
      automation.careerContext?.status==='current' && (automation.careerContext.evidenceFreshness===undefined || automation.careerContext.evidenceFreshness==='current') && typeof milestone.readinessScore ===
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
            "completed" && milestone.metadata?.completionContext!=='unverified-history',
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

  const automationQuery = useCareerQuery<{ success: boolean; data: ICareerAutomation; summary?: ICareerAutomationSummary | null }>("/career-automation?includeSummary=true");
  const summaryQuery = useCareerQuery<{ success: boolean; data: ICareerAutomationSummary | null }>("/career-automation/summary", Boolean(automationQuery.data && !('summary' in automationQuery.data)));
  const automation = automationQuery.data?.data ?? null;
  const summary = summaryQuery.data?.data ?? automationQuery.data?.summary ?? null;
  const loading = automationQuery.isPending;
  const setAutomation = (data: ICareerAutomation) => automationQuery.setData({ success: true, data });
  const setSummary = (data: ICareerAutomationSummary | null) => summaryQuery.setData({ success: true, data });

  const [actionKey, setActionKey] = useState<string | null>(null);

  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  const [actionError, setError] = useState<string | null>(null);
  const error = actionError || (automationQuery.isError && !isCareerAutomationNotFoundError(automationQuery.error)
    ? "Career roadmap could not be loaded." : null);

  /* =====================================================
       EXTERNAL JOBS
    ===================================================== */

  const matchesQuery = useCareerQuery<{ success: boolean; data: { jobs: IExternalCareerJobMatch[] } }>("/jobs/external/matches", Boolean(automation));
  const externalJobs = matchesQuery.data?.data.jobs ?? [];
  const setExternalJobs = (jobs: IExternalCareerJobMatch[]) => matchesQuery.setData({ success: true, data: { jobs } });
  const [jobsRefreshing, setJobsLoading] = useState(false);
  const jobsLoading = jobsRefreshing || (Boolean(automation) && matchesQuery.isPending);
  const [actionJobsError, setJobsError] = useState<string | null>(null);
  const jobsError = actionJobsError || (matchesQuery.isError ? "Real job opportunities could not be loaded." : null);

  /* =====================================================
       JOB PREFERENCES
    ===================================================== */

  const [jobPreferencesOpen, setJobPreferencesOpen] = useState(false);
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [locationLoadError, setLocationLoadError] = useState(false);
  const [locationLoadAttempt, setLocationLoadAttempt] = useState(0);

  useEffect(() => {
    if (!jobPreferencesOpen || locationData) return;
    let active = true;
    import("country-state-city")
      .then((data) => {
        if (active) setLocationData(data);
      })
      .catch(() => {
        if (active) setLocationLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [jobPreferencesOpen, locationData, locationLoadAttempt]);

  const [targetRoleInput, setTargetRoleInput] = useState("");

  const [locationInput, setLocationInput] = useState("");

  const fieldsQuery = useApiQuery<{ success: boolean; data: { fields: ICareerFieldOption[] } }>("/career-automation/fields", jobPreferencesOpen || (!loading && isCareerAutomationNotFoundError(automationQuery.error)));
  const careerFields = fieldsQuery.data?.data.fields ?? [];
  const careerFieldsLoading = fieldsQuery.isPending && (jobPreferencesOpen || !automation);
  const careerFieldsError = fieldsQuery.isError ? "Career fields could not be loaded." : null;

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

  const loadExternalJobs = async (forceRefresh: boolean = false) => {
    try {
      setJobsLoading(true);
      setJobsError(null);
      if (forceRefresh) {
        const refreshed = await refreshExternalCareerJobs();
        setExternalJobs(normalizeFreshJobMatches(refreshed.jobs || []));
      } else {
        await matchesQuery.refetch();
      }
    } catch {
      setJobsError("Real job opportunities could not be loaded.");
    } finally {
      setJobsLoading(false);
    }
  };

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
    return [...(locationData?.Country.getAllCountries() ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [locationData]);

  const subdivisionOptions = useMemo(() => {
    if (!countryCodeInput || !locationData) {
      return [];
    }

    return [...locationData.State.getStatesOfCountry(countryCodeInput)].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [countryCodeInput, locationData]);

  const hasSubdivisions = subdivisionOptions.length > 0;

  const cityOptions = useMemo(() => {
    if (!countryCodeInput || !locationData) {
      return [];
    }

    /*
     * Countries such as the United States expose cities under
     * a state/region. Countries without subdivisions can load
     * their cities directly.
     */
    const cities = hasSubdivisions
      ? subdivisionCodeInput
        ? locationData.City.getCitiesOfState(countryCodeInput, subdivisionCodeInput)
        : []
      : locationData.City.getCitiesOfCountry(countryCodeInput);

    return [...(cities || [])].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [
    countryCodeInput,
    locationData,
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
    if (!countryCodeInput || !locationData) {
      return "";
    }

    const country = locationData.Country.getCountryByCode(countryCodeInput);

    const subdivision =
      hasSubdivisions && subdivisionCodeInput
        ? locationData.State.getStateByCodeAndCountry(
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
    locationData,
    hasSubdivisions,
    selectedCity,
    subdivisionCodeInput,
  ]);

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
      void matchesQuery.refetch();
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
      setTargetRoleInput(
      automation.jobPreferences.targetRoles?.[0] ||
        automation.targetRole ||
        "",
    );

      setLocationInput(automation.jobPreferences.locations?.[0] || "");

      setCountryCodeInput("");

      setSubdivisionCodeInput("");

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
      setTargetRoleInput(
      automation.jobPreferences.targetRoles?.[0] ||
        automation.targetRole ||
        "",
    );

      setLocationInput(automation.jobPreferences.locations?.[0] || "");

      setCountryCodeInput("");

      setSubdivisionCodeInput("");

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

  const preferenceFlight = useRef(false);
  const preferenceVersion = useRef(0);
  useEffect(() => () => { preferenceVersion.current++; }, []);

  const handleSaveJobPreferences = async () => {
    if (preferenceFlight.current) return;
    const targetRole = targetRoleInput.replace(/\s+/g, " ").trim();

    const selectedStructuredLocation = buildSelectedLocation();

    /*
     * The dropdown is the source of truth.
     * If the user leaves Country unselected, save [] = Any location.
     * Do not silently restore the previously saved city.
     */
    const location = selectedStructuredLocation;

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

    preferenceFlight.current = true;
    const version = ++preferenceVersion.current;
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
        expectedRevision: automation ? automation.__v ?? 0 : null,
        targetRole,

        enabled: true,

        /*
         * Empty locations means worldwide search.
         */
        locations: location ? [location] : [],

        workModes: workModeInput === "any" ? [] : [workModeInput],
      });

      if (version !== preferenceVersion.current) return;
      // Use the server's canonical title and revision; do not restore submitted text.
      setAutomation(result.automation);
      if (result.summary) setSummary(result.summary);
      setExternalJobs([]);
      setPreferencesMessage("Career preferences saved. Use Refresh Jobs separately when needed.");
      setPreferencesMessageType("success");
      setJobPreferencesOpen(false);
    } catch (requestError) {
      if (version !== preferenceVersion.current) return;
      console.error(
        "[Career Automation] Preferences update failed.",
      );

      const conflict = (requestError as { response?: { status?: number } })?.response?.status === 409;
      setPreferencesMessage(conflict ? "Your career data changed. Reload before saving again." : "Could not save job search preferences.");

      setPreferencesMessageType("error");
    } finally {
      if (version === preferenceVersion.current) {
        preferenceFlight.current = false;
        setPreferencesSaving(false);
      }
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

          <p role={error ? "alert" : undefined}>
            {error || "Choose your target career. This saves your selection without generating a roadmap."}
          </p>
          {!error && <div className="career-job-preferences-grid">
            <label className="career-job-preference-field">
              Target career
              <select value={targetRoleInput} onChange={event => setTargetRoleInput(event.target.value)} disabled={preferencesSaving || careerFieldsLoading}>
                <option value="">{careerFieldsLoading ? "Loading career fields..." : "Select a career field"}</option>
                {careerFields.map(field => <option key={field.slug} value={field.name}>{field.name}</option>)}
              </select>
            </label>
            {careerFieldsError && <p role="alert">{careerFieldsError}</p>}
            <button type="button" className="career-replan-button" disabled={!targetRoleInput || preferencesSaving || careerFieldsLoading} onClick={() => void handleSaveJobPreferences()}>
              {preferencesSaving ? "Saving..." : "Save target career"}
            </button>
            {preferencesMessage && <p role="status">{preferencesMessage}</p>}
          </div>}
          {error && <button type="button" className="career-replan-button" onClick={() => void automationQuery.refetch()}>Retry</button>}
        </div>
      </section>
    );
  }

  /* =====================================================
       DERIVED VALUES
    ===================================================== */

  const roadmapCurrent=automation.careerContext?.status==='current';
  const hasReadiness = roadmapCurrent && automation.careerContext?.evidenceFreshness==='current' && typeof (summary?.currentReadinessScore ?? automation.currentReadinessScore) === "number";
  const readiness = Math.round(
    summary?.currentReadinessScore ?? automation.currentReadinessScore ?? 0,
  );

  const selectedTopics =
    selectedSkill?.whatToLearn ||
    [];

  const visibleJobs = externalJobs.slice(0, DAILY_JOB_TARGET);

  const selectedTargetRole =
    automation.targetRole;

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

          <h1>{roadmapCurrent || !automation.roadmap.length ? selectedTargetRole : automation.careerContext?.generatedForRole || 'Saved roadmap'}</h1>
          {!automation.roadmap.length && <p role="status">No roadmap has been generated for this career. Generation requires your explicit action.</p>}
          {!roadmapCurrent && automation.roadmap.length>0 && <p role="status">{automation.careerContext?.generatedForRole ? `Saved roadmap for ${automation.careerContext.generatedForRole}. Active career: ${automation.targetRole}.` : 'Saved roadmap provenance is unverified; this is not a current-career assessment.'} History and completed tasks are preserved. Rebuild only when you choose.</p>}
          {automation.roadmap.length>0 && <p role="status">Saved roadmap evidence: {automation.careerContext?.evidenceFreshness || 'unverified'}. Knowledge freshness is unverified. Opening this page does not regenerate it.</p>}
          <p>Saved job candidates are rescored for your current preferences. Opening this page does not refresh the job catalog.</p>
          {automationQuery.isFetching && <p role="status">Updating roadmap...</p>}
          {error && <p role="alert">{error}</p>}
          {summaryQuery.isError && (
            <p role="alert">Roadmap summary could not be refreshed. <button type="button" onClick={() => void summaryQuery.refetch()}>Retry</button></p>
          )}

          <p>
            {roadmapCurrent ? 'Saved plan for your active career. Its evidence freshness is shown separately.' : 'Historical saved plan. Percentages are hidden until its career context can be verified.'}
          </p>
        </div>

        <div className="career-graph-header-actions">
          <div className="career-readiness-pill">
            <FiTrendingUp />

            <span>Readiness</span>

            <strong>{hasReadiness ? `${readiness}%` : "Not assessed"}</strong>
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

          <strong>{selectedTargetRole}</strong>
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

          <strong>{`Get a ${selectedTargetRole} job`}</strong>
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

            {!locationData && (
              <p className="career-job-preferences-message" role="status">
                {locationLoadError ? "Locations could not be loaded. " : "Loading locations..."}
                {locationLoadError && (
                  <button type="button" onClick={() => {
                    setLocationLoadError(false);
                    setLocationLoadAttempt((attempt) => attempt + 1);
                  }}>Retry</button>
                )}
              </p>
            )}
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
                    disabled={preferencesSaving || !locationData}
                  >
                    <option value="">{locationData ? "Select country" : "Loading locations..."}</option>

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
                    Saving...
                  </>
                ) : (
                  <>
                    <FiBriefcase />
                    Save Preferences
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
