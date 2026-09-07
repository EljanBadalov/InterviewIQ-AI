import {
  type Request,
  type Response,
  type NextFunction,
} from "express";

import {
  Types,
} from "mongoose";

import {
  ResumeProfile,
} from "../models/ResumeProfile";

import {
  getLatestResumeProfile,
  getResumeProfileForBuilder,
  updateResumeProfile,
} from "../services/resumeProfileService";

import {
  checkResumeProfileCompleteness,
} from "../services/resumeProfileCompletenessService";

/* =========================================================
   HELPERS
========================================================= */

const getUserObjectId = (
  req: Request
): Types.ObjectId | null => {
  if (
    !req.user ||
    !req.user._id
  ) {
    return null;
  }

  const value =
    req.user._id.toString();

  if (
    !Types.ObjectId.isValid(
      value
    )
  ) {
    return null;
  }

  return new Types.ObjectId(
    value
  );
};

const cleanText = (
  value: unknown
): string | undefined => {
  if (
    typeof value !==
    "string"
  ) {
    return undefined;
  }

  const cleaned =
    value
      .trim()
      .replace(
        /\s+/g,
        " "
      );

  return (
    cleaned ||
    undefined
  );
};

const cleanStringArray = (
  value: unknown
): string[] | undefined => {
  if (
    !Array.isArray(
      value
    )
  ) {
    return undefined;
  }

  const seen =
    new Set<string>();

  const result:
    string[] = [];

  for (
    const item
    of value
  ) {
    if (
      typeof item !==
      "string"
    ) {
      continue;
    }

    const cleaned =
      item
        .trim()
        .replace(
          /\s+/g,
          " "
        );

    if (!cleaned) {
      continue;
    }

    const key =
      cleaned.toLowerCase();

    if (
      seen.has(
        key
      )
    ) {
      continue;
    }

    seen.add(
      key
    );

    result.push(
      cleaned
    );
  }

  return result;
};

/* =========================================================
   CREATE EMPTY PROFILE WHEN USER HAS NO CV
========================================================= */

const createEmptyProfile =
  async (
    userId: Types.ObjectId
  ) => {
    return ResumeProfile.create({
      user:
        userId,

      fileName:
        "Created with InterviewIQ",

      contact: {},

      professionalSummary:
        "",

      skills: [],

      technicalSkills:
        [],

      softSkills: [],

      experience: [],

      projects: [],

      education: [],

      certifications: [],

      languages: [],

      volunteering: [],

      achievements: [],

      interests: [],

      rawSections: [],

      extractionStatus:
        "completed",

      extractionWarnings:
        [],
    });
  };

/* =========================================================
   GET COMPLETENESS
========================================================= */

export const getResumeProfileCompletenessController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getUserObjectId(
          req
        );

      if (!userId) {
        res.status(
          401
        ).json({
          success:
            false,

          message:
            "Not authorized",
        });

        return;
      }

      let profile =
        await getLatestResumeProfile(
          userId
        );

      /*
       * If user has never uploaded or created a CV,
       * create an empty ResumeProfile.
       *
       * This lets the same onboarding flow work for:
       *
       * 1. existing CV users
       * 2. users creating a CV from scratch
       */

      if (!profile) {
        profile =
          await createEmptyProfile(
            userId
          );
      }

      const builderProfile =
        await getResumeProfileForBuilder(
          userId
        );

      if (!builderProfile) {
        res.status(
          500
        ).json({
          success:
            false,

          message:
            "Resume profile could not be prepared.",
        });

        return;
      }

      const completeness =
        checkResumeProfileCompleteness(
          builderProfile
        );

      res.status(
        200
      ).json({
        success:
          true,

        message:
          completeness
            .canGenerateCV
            ? "Resume profile has the required information."
            : "Additional information is required before generating the CV.",

        data: {
          profileId:
            builderProfile.id,

          source: {
            hasUploadedResume:
              Boolean(
                profile.resumeAnalysis
              ),

            fileName:
              profile.fileName,
          },

          completeness,
        },
      });
    } catch (
      error
    ) {
      next(
        error
      );
    }
  };

/* =========================================================
   UPDATE PROFILE
========================================================= */

export const updateResumeProfileController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getUserObjectId(
          req
        );

      if (!userId) {
        res.status(
          401
        ).json({
          success:
            false,

          message:
            "Not authorized",
        });

        return;
      }

      let profile =
        await getLatestResumeProfile(
          userId
        );

      /*
       * User can arrive here without having uploaded
       * any resume. Create the profile automatically.
       */

      if (!profile) {
        profile =
          await createEmptyProfile(
            userId
          );
      }

      const body =
        req.body ??
        {};

      const currentContact =
        profile.contact ??
        {};

      const contactInput =
        body.contact &&
        typeof body.contact ===
          "object"
          ? body.contact
          : {};

      const contact = {
        fullName:
          cleanText(
            contactInput
              .fullName
          ) ??
          currentContact
            .fullName,

        email:
          cleanText(
            contactInput
              .email
          ) ??
          currentContact
            .email,

        phone:
          cleanText(
            contactInput
              .phone
          ) ??
          currentContact
            .phone,

        location:
          cleanText(
            contactInput
              .location
          ) ??
          currentContact
            .location,

        linkedin:
          cleanText(
            contactInput
              .linkedin
          ) ??
          currentContact
            .linkedin,

        github:
          cleanText(
            contactInput
              .github
          ) ??
          currentContact
            .github,

        website:
          cleanText(
            contactInput
              .website
          ) ??
          currentContact
            .website,
      };

      const updatedProfile =
        await updateResumeProfile(
          userId,
          profile._id,
          {
            contact,

            professionalSummary:
              cleanText(
                body
                  .professionalSummary
              ) ??
              profile
                .professionalSummary,

            skills:
              cleanStringArray(
                body.skills
              ) ??
              profile.skills,

            technicalSkills:
              cleanStringArray(
                body
                  .technicalSkills
              ) ??
              profile
                .technicalSkills,

            softSkills:
              cleanStringArray(
                body.softSkills
              ) ??
              profile
                .softSkills,

            experience:
              Array.isArray(
                body.experience
              )
                ? body.experience
                : undefined,

            projects:
              Array.isArray(
                body.projects
              )
                ? body.projects
                : undefined,

            education:
              Array.isArray(
                body.education
              )
                ? body.education
                : undefined,

            certifications:
              Array.isArray(
                body.certifications
              )
                ? body
                    .certifications
                : undefined,

            languages:
              Array.isArray(
                body.languages
              )
                ? body.languages
                : undefined,

            volunteering:
              Array.isArray(
                body.volunteering
              )
                ? body.volunteering
                : undefined,

            achievements:
              cleanStringArray(
                body
                  .achievements
              ),

            interests:
              cleanStringArray(
                body.interests
              ),
          }
        );

      if (
        !updatedProfile
      ) {
        res.status(
          404
        ).json({
          success:
            false,

          message:
            "Resume profile not found.",
        });

        return;
      }

      const builderProfile =
        await getResumeProfileForBuilder(
          userId
        );

      if (!builderProfile) {
        res.status(
          500
        ).json({
          success:
            false,

          message:
            "Updated resume profile could not be loaded.",
        });

        return;
      }

      const completeness =
        checkResumeProfileCompleteness(
          builderProfile
        );

      res.status(
        200
      ).json({
        success:
          true,

        message:
          completeness
            .canGenerateCV
            ? "Resume profile updated. CV generation is ready."
            : "Resume profile updated. Some required information is still missing.",

        data: {
          profile:
            builderProfile,

          completeness,
        },
      });
    } catch (
      error
    ) {
      next(
        error
      );
    }
  };