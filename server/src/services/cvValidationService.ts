import {
  type IGeneratedCVData,
} from "./cvBuilderService";

/* =========================================================
   TYPES
========================================================= */

export type ICVValidationSeverity =
  | "error"
  | "warning";

export interface ICVValidationIssue {
  code:
    string;

  message:
    string;

  severity:
    ICVValidationSeverity;
}

export interface ICVValidationResult {
  valid:
    boolean;

  errors:
    ICVValidationIssue[];

  warnings:
    ICVValidationIssue[];
}

/* =========================================================
   HELPERS
========================================================= */

const clean = (
  value:
    unknown
): string => {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
};

const nonEmptyStrings = (
  value:
    unknown
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
    .map(
      (
        item
      ) =>
        item.trim()
    )
    .filter(
      Boolean
    );
};

const countMeaningfulHistory = (
  cv:
    IGeneratedCVData
): number => {
  return (
    (
      cv.experience
        ?.items
        ?.length ||
      0
    ) +
    (
      cv.projects
        ?.items
        ?.length ||
      0
    ) +
    (
      cv.education
        ?.items
        ?.length ||
      0
    ) +
    (
      cv.volunteering
        ?.items
        ?.length ||
      0
    )
  );
};

/* =========================================================
   VALIDATION
========================================================= */

/*
 * This validator protects against truly broken/empty generated CVs,
 * but it does NOT reject a legitimate CV simply because:
 *
 * - the selected vacancy is a low match,
 * - no target-job skill can be truthfully added,
 * - education is absent,
 * - projects are absent,
 * - experience is limited,
 * - the candidate name parser missed a field.
 *
 * Those cases are warnings, not fatal generation errors.
 *
 * A generation is rejected only when the produced structure is
 * effectively empty and therefore unsafe to export.
 */
export const validateGeneratedCV =
  (
    cv:
      IGeneratedCVData
  ): ICVValidationResult => {
    const errors:
      ICVValidationIssue[] =
      [];

    const warnings:
      ICVValidationIssue[] =
      [];

    const fullName =
      clean(
        cv.contact
          ?.fullName
      );

    const email =
      clean(
        cv.contact
          ?.email
      );

    const phone =
      clean(
        cv.contact
          ?.phone
      );

    const summary =
      clean(
        cv.professionalSummary
      );

    const primarySkills =
      nonEmptyStrings(
        cv.skills
          ?.primary
      );

    const verifiedSkills =
      nonEmptyStrings(
        cv.skills
          ?.verified
      );

    const additionalSkills =
      nonEmptyStrings(
        cv.skills
          ?.additionalSupported
      );

    const allSkills =
      Array.from(
        new Set(
          [
            ...primarySkills,
            ...verifiedSkills,
            ...additionalSkills,
          ].map(
            (
              skill
            ) =>
              skill.toLowerCase()
          )
        )
      );

    const experienceCount =
      cv.experience
        ?.items
        ?.length ||
      0;

    const projectCount =
      cv.projects
        ?.items
        ?.length ||
      0;

    const educationCount =
      cv.education
        ?.items
        ?.length ||
      0;

    const volunteeringCount =
      cv.volunteering
        ?.items
        ?.length ||
      0;

    const certificationCount =
      cv.certifications
        ?.items
        ?.length ||
      0;

    const languageCount =
      cv.languages
        ?.items
        ?.length ||
      0;

    const achievementCount =
      cv.achievements
        ?.items
        ?.length ||
      0;

    const meaningfulHistoryCount =
      countMeaningfulHistory(
        cv
      );

    const hasAnyContact =
      Boolean(
        fullName ||
        email ||
        phone
      );

    const hasAnySkills =
      allSkills.length >
      0;

    const hasAnyContent =
      Boolean(
        summary ||
        meaningfulHistoryCount >
          0 ||
        certificationCount >
          0 ||
        languageCount >
          0 ||
        achievementCount >
          0
      );

    /*
     * The only hard failure:
     * the generated CV is essentially empty.
     */
    if (
      !hasAnyContact &&
      !hasAnySkills &&
      !hasAnyContent
    ) {
      errors.push({
        code:
          "CV_GENERATED_CONTENT_EMPTY",

        message:
          "The generated CV is effectively empty. Original resume profile data could not be carried into the generated CV.",

        severity:
          "error",
      });
    }

    /*
     * Everything below is advisory.
     * We still generate/download the CV so a low-match vacancy does
     * not incorrectly become a 422 response.
     */

    if (
      !fullName
    ) {
      warnings.push({
        code:
          "CV_NAME_MISSING",

        message:
          "Candidate name is missing from the generated CV.",

        severity:
          "warning",
      });
    }

    if (
      !email &&
      !phone
    ) {
      warnings.push({
        code:
          "CV_CONTACT_LIMITED",

        message:
          "The generated CV does not contain an email address or phone number.",

        severity:
          "warning",
      });
    }

    if (
      !summary
    ) {
      warnings.push({
        code:
          "CV_SUMMARY_EMPTY",

        message:
          "The generated CV does not contain a professional summary.",

        severity:
          "warning",
      });
    }

    if (
      !hasAnySkills
    ) {
      warnings.push({
        code:
          "CV_SKILLS_MISSING",

        message:
          "The generated CV does not contain any supported skills.",

        severity:
          "warning",
      });
    }

    if (
      experienceCount ===
        0 &&
      projectCount ===
        0
    ) {
      warnings.push({
        code:
          "CV_EXPERIENCE_PROJECTS_EMPTY",

        message:
          "The generated CV contains neither experience nor projects.",

        severity:
          "warning",
      });
    }

    if (
      educationCount ===
      0
    ) {
      warnings.push({
        code:
          "CV_EDUCATION_EMPTY",

        message:
          "The generated CV does not contain an education section.",

        severity:
          "warning",
      });
    }

    if (
      volunteeringCount ===
        0
    ) {
      warnings.push({
        code:
          "CV_VOLUNTEERING_EMPTY",

        message:
          "The generated CV does not contain volunteering entries.",

        severity:
          "warning",
      });
    }

    /*
     * A targeted vacancy with zero supported matching skills is
     * completely valid. We must never invent missing vacancy skills.
     */
    if (
      cv.metadata
        ?.targetJob &&
      primarySkills.length ===
        0 &&
      (
        cv.skills
          ?.missingForTargetJob
          ?.length ||
        0
      ) >
        0
    ) {
      warnings.push({
        code:
          "CV_LOW_TARGET_MATCH",

        message:
          "The target vacancy has requirements that are not currently supported by the candidate's resume evidence. Unsupported skills were not added.",

        severity:
          "warning",
      });
    }

    return {
      valid:
        errors.length ===
        0,

      errors,

      warnings,
    };
  };

export default {
  validateGeneratedCV,
};
