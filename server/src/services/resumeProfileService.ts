import mongoose, {
  Types,
  type HydratedDocument,
} from "mongoose";

import {
  ResumeProfile,
  type IResumeProfile,
  type IResumeContact,
  type IResumeExperience,
  type IResumeProject,
  type IResumeEducation,
  type IResumeCertification,
  type IResumeLanguage,
  type IResumeVolunteer,
  type IResumeHackathon,
} from "../models/ResumeProfile";

type ResumeProfileDocument =
  HydratedDocument<IResumeProfile>;


interface IResumeGridFSFile {
  _id:
    Types.ObjectId;

  metadata?: {
    source?:
      string;
  };
}

const IMPROVED_CV_GRIDFS_SOURCE =
  "cv-improvement-quality-gate";

interface CreateResumeProfileParams {
  userId:
    | Types.ObjectId
    | string;

  resumeAnalysisId?:
    | Types.ObjectId
    | string;

  fileId?:
    | Types.ObjectId
    | string;

  fileName: string;

  contact?: IResumeContact;

  professionalSummary?: string;

  skills?: string[];

  technicalSkills?: string[];

  softSkills?: string[];

  experience?: IResumeExperience[];

  projects?: IResumeProject[];

  education?: IResumeEducation[];

  certifications?: IResumeCertification[];

  languages?: IResumeLanguage[];

  volunteering?: IResumeVolunteer[];

  hackathons?: IResumeHackathon[];

  achievements?: string[];

  interests?: string[];

  rawSections?: Array<{
    title: string;

    content: string;
  }>;

  extractionStatus?:
    | "pending"
    | "completed"
    | "partial"
    | "failed";

  extractionWarnings?: string[];
}

interface UpdateResumeProfileParams {
  contact?: IResumeContact;

  professionalSummary?: string;

  skills?: string[];

  technicalSkills?: string[];

  softSkills?: string[];

  experience?: IResumeExperience[];

  projects?: IResumeProject[];

  education?: IResumeEducation[];

  certifications?: IResumeCertification[];

  languages?: IResumeLanguage[];

  volunteering?: IResumeVolunteer[];

  hackathons?: IResumeHackathon[];

  achievements?: string[];

  interests?: string[];

  rawSections?: Array<{
    title: string;

    content: string;
  }>;

  extractionStatus?:
    | "pending"
    | "completed"
    | "partial"
    | "failed";

  extractionWarnings?: string[];
}

export interface ICVBuilderResumeProfile {
  id: string;

  fileName: string;

  contact: IResumeContact;

  professionalSummary: string;

  skills: string[];

  technicalSkills: string[];

  softSkills: string[];

  experience: IResumeExperience[];

  projects: IResumeProject[];

  education: IResumeEducation[];

  certifications: IResumeCertification[];

  languages: IResumeLanguage[];

  volunteering: IResumeVolunteer[];

  hackathons: IResumeHackathon[];

  achievements: string[];

  interests: string[];

  rawSections?: Array<{
    title: string;

    content: string;
  }>;

  extractionStatus:
    | "pending"
    | "completed"
    | "partial"
    | "failed";

  extractionWarnings: string[];
}

const toObjectId = (
  value:
    | Types.ObjectId
    | string
): Types.ObjectId => {
  if (
    value instanceof
    Types.ObjectId
  ) {
    return value;
  }

  if (
    !Types.ObjectId.isValid(
      value
    )
  ) {
    throw new Error(
      "Invalid ObjectId"
    );
  }

  return new Types.ObjectId(
    value
  );
};

const normalizeText = (
  value: string
): string => {
  return value
    .trim()
    .replace(
      /\s+/g,
      " "
    );
};

const uniqueStrings = (
  values:
    | string[]
    | undefined
): string[] => {
  if (!values) {
    return [];
  }

  const seen =
    new Set<string>();

  const result:
    string[] = [];

  for (
    const value
    of values
  ) {
    const cleaned =
      normalizeText(
        value
      );

    if (!cleaned) {
      continue;
    }

    const key =
      cleaned.toLowerCase();

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    result.push(
      cleaned
    );
  }

  return result;
};

const cleanContact = (
  contact?:
    IResumeContact
): IResumeContact => {
  if (!contact) {
    return {};
  }

  return {
    fullName:
      contact.fullName
        ?.trim(),

    email:
      contact.email
        ?.trim()
        .toLowerCase(),

    phone:
      contact.phone
        ?.trim(),

    location:
      contact.location
        ?.trim(),

    linkedin:
      contact.linkedin
        ?.trim(),

    github:
      contact.github
        ?.trim(),

    website:
      contact.website
        ?.trim(),
  };
};

const hasMeaningfulText = (
  ...values:
    Array<
      | string
      | undefined
      | null
    >
): boolean => {
  return values.some(
    (value) =>
      Boolean(
        value &&
        value.trim().length >
          0
      )
  );
};

const hasMeaningfulList = (
  ...values:
    Array<
      | string[]
      | undefined
    >
): boolean => {
  return values.some(
    (value) =>
      Boolean(
        value &&
        value.some(
          (item) =>
            Boolean(
              item &&
              item.trim().length >
                0
            )
        )
      )
  );
};

/*
 * IMPORTANT:
 *
 * Structured extraction may identify a real resume item while failing
 * to confidently identify its primary label (for example, a project
 * description with no safe project name).
 *
 * Those partial records must be preserved so the completeness/review
 * layer can ask the user to confirm the missing field.
 *
 * We only remove records that contain no meaningful source data at all.
 */

const cleanExperience = (
  items:
    IResumeExperience[] =
      []
): IResumeExperience[] => {
  return items
    .filter(
      (item) =>
        Boolean(
          hasMeaningfulText(
            item.title,
            item.company,
            item.location,
            item.employmentType,
            item.startDate,
            item.endDate,
            item.description
          ) ||
          hasMeaningfulList(
            item.bullets,
            item.technologies
          )
        )
    )
    .map(
      (item) => ({
        title:
          item.title
            ?.trim() ||
          "",

        company:
          item.company
            ?.trim(),

        location:
          item.location
            ?.trim(),

        employmentType:
          item.employmentType
            ?.trim(),

        startDate:
          item.startDate
            ?.trim(),

        endDate:
          item.endDate
            ?.trim(),

        isCurrent:
          Boolean(
            item.isCurrent
          ),

        description:
          item.description
            ?.trim(),

        bullets:
          uniqueStrings(
            item.bullets
          ),

        technologies:
          uniqueStrings(
            item.technologies
          ),
      })
    );
};

const cleanProjects = (
  items:
    IResumeProject[] =
      []
): IResumeProject[] => {
  return items
    .filter(
      (item) =>
        Boolean(
          hasMeaningfulText(
            item.name,
            item.role,
            item.description,
            item.startDate,
            item.endDate,
            item.url,
            item.github
          ) ||
          hasMeaningfulList(
            item.technologies,
            item.bullets
          )
        )
    )
    .map(
      (item) => ({
        name:
          item.name
            ?.trim() ||
          "",

        role:
          item.role
            ?.trim(),

        description:
          item.description
            ?.trim(),

        startDate:
          item.startDate
            ?.trim(),

        endDate:
          item.endDate
            ?.trim(),

        technologies:
          uniqueStrings(
            item.technologies
          ),

        bullets:
          uniqueStrings(
            item.bullets
          ),

        url:
          item.url
            ?.trim(),

        github:
          item.github
            ?.trim(),
      })
    );
};

const cleanEducation = (
  items:
    IResumeEducation[] =
      []
): IResumeEducation[] => {
  return items
    .filter(
      (item) =>
        Boolean(
          hasMeaningfulText(
            item.institution,
            item.degree,
            item.field,
            item.location,
            item.startDate,
            item.endDate,
            item.gpa
          ) ||
          hasMeaningfulList(
            item.coursework,
            item.achievements
          )
        )
    )
    .map(
      (item) => ({
        institution:
          item.institution
            ?.trim() ||
          "",

        degree:
          item.degree
            ?.trim(),

        field:
          item.field
            ?.trim(),

        location:
          item.location
            ?.trim(),

        startDate:
          item.startDate
            ?.trim(),

        endDate:
          item.endDate
            ?.trim(),

        isCurrent:
          Boolean(
            item.isCurrent
          ),

        gpa:
          item.gpa
            ?.trim(),

        coursework:
          uniqueStrings(
            item.coursework
          ),

        achievements:
          uniqueStrings(
            item.achievements
          ),
      })
    );
};

const cleanCertifications = (
  items:
    IResumeCertification[] =
      []
): IResumeCertification[] => {
  return items
    .filter(
      (item) =>
        hasMeaningfulText(
          item.name,
          item.issuer,
          item.issueDate,
          item.expirationDate,
          item.credentialId,
          item.credentialUrl
        )
    )
    .map(
      (item) => ({
        name:
          item.name
            ?.trim() ||
          "",

        issuer:
          item.issuer
            ?.trim(),

        issueDate:
          item.issueDate
            ?.trim(),

        expirationDate:
          item.expirationDate
            ?.trim(),

        credentialId:
          item.credentialId
            ?.trim(),

        credentialUrl:
          item.credentialUrl
            ?.trim(),

        status:
          item.status,
      })
    );
};

const cleanLanguages = (
  items:
    IResumeLanguage[] =
      []
): IResumeLanguage[] => {
  return items
    .filter(
      (item) =>
        hasMeaningfulText(
          item.language,
          item.level
        )
    )
    .map(
      (item) => ({
        language:
          item.language
            ?.trim() ||
          "",

        level:
          item.level
            ?.trim(),
      })
    );
};

const cleanVolunteering = (
  items:
    IResumeVolunteer[] =
      []
): IResumeVolunteer[] => {
  return items
    .filter(
      (item) =>
        Boolean(
          hasMeaningfulText(
            item.organization,
            item.role,
            item.location,
            item.startDate,
            item.endDate,
            item.description
          ) ||
          hasMeaningfulList(
            item.bullets
          )
        )
    )
    .map(
      (item) => ({
        organization:
          item.organization
            ?.trim() ||
          "",

        role:
          item.role
            ?.trim(),

        location:
          item.location
            ?.trim(),

        startDate:
          item.startDate
            ?.trim(),

        endDate:
          item.endDate
            ?.trim(),

        isCurrent:
          Boolean(
            item.isCurrent
          ),

        description:
          item.description
            ?.trim(),

        bullets:
          uniqueStrings(
            item.bullets
          ),
      })
    );
};

const cleanHackathons = (
  items:
    IResumeHackathon[] =
      []
): IResumeHackathon[] => {
  return items
    .filter(
      (item) =>
        Boolean(
          hasMeaningfulText(
            item.name,
            item.organization,
            item.role,
            item.date,
            item.description
          ) ||
          hasMeaningfulList(
            item.achievements
          )
        )
    )
    .map(
      (item) => ({
        name:
          item.name
            ?.trim() ||
          "",

        organization:
          item.organization
            ?.trim(),

        role:
          item.role
            ?.trim(),

        date:
          item.date
            ?.trim(),

        description:
          item.description
            ?.trim(),

        achievements:
          uniqueStrings(
            item.achievements
          ),
      })
    );
};

const cleanRawSections = (
  items:
    Array<{
      title: string;
      content: string;
    }> =
      []
) => {
  return items
    .filter(
      (item) =>
        hasMeaningfulText(
          item.title,
          item.content
        )
    )
    .map(
      (item) => ({
        title:
          item.title
            ?.trim() ||
          "",

        content:
          item.content
            ?.trim() ||
          "",
      })
    );
};

export const createResumeProfile =
  async ({
    userId,
    resumeAnalysisId,
    fileId,
    fileName,
    contact,
    professionalSummary,
    skills,
    technicalSkills,
    softSkills,
    experience,
    projects,
    education,
    certifications,
    languages,
    volunteering,
    hackathons,
    achievements,
    interests,
    rawSections,
    extractionStatus =
      "completed",
    extractionWarnings,
  }: CreateResumeProfileParams): Promise<ResumeProfileDocument> => {
    const userObjectId =
      toObjectId(
        userId
      );

    const analysisObjectId =
      resumeAnalysisId
        ? toObjectId(
            resumeAnalysisId
          )
        : undefined;

    const fileObjectId =
      fileId
        ? toObjectId(
            fileId
          )
        : undefined;

    if (
      analysisObjectId
    ) {
      const existing =
        await ResumeProfile.findOne({
          user:
            userObjectId,

          resumeAnalysis:
            analysisObjectId,
        });

      if (
        existing
      ) {
        return existing;
      }
    }

    const profile =
      await ResumeProfile.create({
        user:
          userObjectId,

        resumeAnalysis:
          analysisObjectId,

        fileId:
          fileObjectId,

        fileName:
          fileName.trim(),

        contact:
          cleanContact(
            contact
          ),

        professionalSummary:
          professionalSummary
            ?.trim() ||
          "",

        skills:
          uniqueStrings(
            skills
          ),

        technicalSkills:
          uniqueStrings(
            technicalSkills
          ),

        softSkills:
          uniqueStrings(
            softSkills
          ),

        experience:
          cleanExperience(
            experience
          ),

        projects:
          cleanProjects(
            projects
          ),

        education:
          cleanEducation(
            education
          ),

        certifications:
          cleanCertifications(
            certifications
          ),

        languages:
          cleanLanguages(
            languages
          ),

        volunteering:
          cleanVolunteering(
            volunteering
          ),

        hackathons:
          cleanHackathons(
            hackathons
          ),

        achievements:
          uniqueStrings(
            achievements
          ),

        interests:
          uniqueStrings(
            interests
          ),

        rawSections:
          cleanRawSections(
            rawSections
          ),

        extractionStatus,

        extractionWarnings:
          uniqueStrings(
            extractionWarnings
          ),
      });

    return profile;
  };

export const getLatestResumeProfile =
  async (
    userId:
      | Types.ObjectId
      | string
  ): Promise<ResumeProfileDocument | null> => {
    return ResumeProfile.findOne({
      user:
        toObjectId(
          userId
        ),
    })
      .sort({
        createdAt: -1,
      });
  };


/* =========================================================
   LATEST ORIGINAL RESUME PROFILE
========================================================= */

/*
 * Improved CVs are intentionally stored in ResumeProfile history.
 * They must NOT become the source of another improvement request.
 *
 * This helper walks newest -> oldest and returns the newest profile
 * whose GridFS file was NOT created by the CV improvement pipeline.
 *
 * Original uploads normally have either:
 * - no metadata.source, or
 * - a source value different from "cv-improvement-quality-gate".
 *
 * Generated improved PDFs use:
 * metadata.source = "cv-improvement-quality-gate"
 */
export const getLatestOriginalResumeProfile =
  async (
    userId:
      | Types.ObjectId
      | string
  ): Promise<ResumeProfileDocument | null> => {
    const userObjectId =
      toObjectId(
        userId
      );

    const profiles =
      await ResumeProfile.find({
        user:
          userObjectId,
      })
        .sort({
          createdAt:
            -1,
        });

    if (
      profiles.length ===
      0
    ) {
      return null;
    }

    const db =
      mongoose.connection.db;

    /*
     * The application should already have an active Mongo connection.
     * If it does not, fail safely instead of accidentally selecting
     * a generated profile as the canonical source.
     */
    if (!db) {
      return null;
    }

    const filesCollection =
      db.collection<IResumeGridFSFile>(
        "resumeFiles.files"
      );

    for (
      const profile
      of profiles
    ) {
      /*
       * Legacy/original profiles may not have fileId.
       * Improved CV persistence always stores a GridFS fileId, so a
       * missing fileId is treated as an original source candidate.
       */
      if (
        !profile.fileId
      ) {
        return profile;
      }

      const gridFile =
        await filesCollection.findOne(
          {
            _id:
              profile.fileId,
          },
          {
            projection: {
              _id:
                1,

              "metadata.source":
                1,
            },
          }
        );

      const source =
        gridFile
          ?.metadata
          ?.source;

      if (
        source !==
        IMPROVED_CV_GRIDFS_SOURCE
      ) {
        return profile;
      }
    }

    return null;
  };

export const getResumeProfileById =
  async (
    userId:
      | Types.ObjectId
      | string,
    profileId:
      | Types.ObjectId
      | string
  ): Promise<ResumeProfileDocument | null> => {
    return ResumeProfile.findOne({
      _id:
        toObjectId(
          profileId
        ),

      user:
        toObjectId(
          userId
        ),
    });
  };

export const getResumeProfileByAnalysisId =
  async (
    userId:
      | Types.ObjectId
      | string,
    resumeAnalysisId:
      | Types.ObjectId
      | string
  ): Promise<ResumeProfileDocument | null> => {
    return ResumeProfile.findOne({
      user:
        toObjectId(
          userId
        ),

      resumeAnalysis:
        toObjectId(
          resumeAnalysisId
        ),
    });
  };

export const updateResumeProfile =
  async (
    userId:
      | Types.ObjectId
      | string,
    profileId:
      | Types.ObjectId
      | string,
    updates:
      UpdateResumeProfileParams
  ): Promise<ResumeProfileDocument | null> => {
    const profile =
      await getResumeProfileById(
        userId,
        profileId
      );

    if (!profile) {
      return null;
    }

    if (
      updates.contact !==
      undefined
    ) {
      const existingContact:
        IResumeContact = {
          fullName:
            profile.contact
              ?.fullName,

          email:
            profile.contact
              ?.email,

          phone:
            profile.contact
              ?.phone,

          location:
            profile.contact
              ?.location,

          linkedin:
            profile.contact
              ?.linkedin,

          github:
            profile.contact
              ?.github,

          website:
            profile.contact
              ?.website,
        };

      profile.contact =
        cleanContact({
          ...existingContact,
          ...updates.contact,
        });
    }

    if (
      updates.professionalSummary !==
      undefined
    ) {
      profile.professionalSummary =
        updates.professionalSummary.trim();
    }

    if (
      updates.skills !==
      undefined
    ) {
      profile.skills =
        uniqueStrings(
          updates.skills
        );
    }

    if (
      updates.technicalSkills !==
      undefined
    ) {
      profile.technicalSkills =
        uniqueStrings(
          updates.technicalSkills
        );
    }

    if (
      updates.softSkills !==
      undefined
    ) {
      profile.softSkills =
        uniqueStrings(
          updates.softSkills
        );
    }

    if (
      updates.experience !==
      undefined
    ) {
      profile.experience =
        cleanExperience(
          updates.experience
        ) as typeof profile.experience;
    }

    if (
      updates.projects !==
      undefined
    ) {
      profile.projects =
        cleanProjects(
          updates.projects
        ) as typeof profile.projects;
    }

    if (
      updates.education !==
      undefined
    ) {
      profile.education =
        cleanEducation(
          updates.education
        ) as typeof profile.education;
    }

    if (
      updates.certifications !==
      undefined
    ) {
      profile.certifications =
        cleanCertifications(
          updates.certifications
        ) as typeof profile.certifications;
    }

    if (
      updates.languages !==
      undefined
    ) {
      profile.languages =
        cleanLanguages(
          updates.languages
        ) as typeof profile.languages;
    }

    if (
      updates.volunteering !==
      undefined
    ) {
      profile.volunteering =
        cleanVolunteering(
          updates.volunteering
        ) as typeof profile.volunteering;
    }

    if (
      updates.hackathons !==
      undefined
    ) {
      profile.hackathons =
        cleanHackathons(
          updates.hackathons
        ) as typeof profile.hackathons;
    }

    if (
      updates.achievements !==
      undefined
    ) {
      profile.achievements =
        uniqueStrings(
          updates.achievements
        );
    }

    if (
      updates.interests !==
      undefined
    ) {
      profile.interests =
        uniqueStrings(
          updates.interests
        );
    }

    if (
      updates.rawSections !==
      undefined
    ) {
      profile.rawSections =
        cleanRawSections(
          updates.rawSections
        );
    }

    if (
      updates.extractionStatus !==
      undefined
    ) {
      profile.extractionStatus =
        updates.extractionStatus;
    }

    if (
      updates.extractionWarnings !==
      undefined
    ) {
      profile.extractionWarnings =
        uniqueStrings(
          updates.extractionWarnings
        );
    }

    profile.markModified(
      "contact"
    );

    profile.markModified(
      "experience"
    );

    profile.markModified(
      "projects"
    );

    profile.markModified(
      "education"
    );

    profile.markModified(
      "certifications"
    );

    profile.markModified(
      "languages"
    );

    profile.markModified(
      "volunteering"
    );

    profile.markModified(
      "hackathons"
    );

    await profile.save();

    return profile;
  };

export const deleteResumeProfile =
  async (
    userId:
      | Types.ObjectId
      | string,
    profileId:
      | Types.ObjectId
      | string
  ): Promise<boolean> => {
    const result =
      await ResumeProfile.deleteOne({
        _id:
          toObjectId(
            profileId
          ),

        user:
          toObjectId(
            userId
          ),
      });

    return (
      result.deletedCount >
      0
    );
  };

export const getResumeProfilesForUser =
  async (
    userId:
      | Types.ObjectId
      | string,
    limit = 10
  ): Promise<ResumeProfileDocument[]> => {
    return ResumeProfile.find({
      user:
        toObjectId(
          userId
        ),
    })
      .sort({
        createdAt: -1,
      })
      .limit(
        Math.max(
          1,
          Math.min(
            limit,
            50
          )
        )
      );
  };

export const getResumeProfileForBuilder =
  async (
    userId:
      | Types.ObjectId
      | string,
    resumeAnalysisId?:
      | Types.ObjectId
      | string
  ): Promise<ICVBuilderResumeProfile | null> => {
    let profile:
      ResumeProfileDocument | null;

    if (
      resumeAnalysisId
    ) {
      profile =
        await getResumeProfileByAnalysisId(
          userId,
          resumeAnalysisId
        );
    } else {
      profile =
        await getLatestResumeProfile(
          userId
        );
    }

    if (!profile) {
      return null;
    }

    return {
      id:
        profile._id
          .toString(),

      fileName:
        profile.fileName,

      contact: {
        fullName:
          profile.contact
            ?.fullName,

        email:
          profile.contact
            ?.email,

        phone:
          profile.contact
            ?.phone,

        location:
          profile.contact
            ?.location,

        linkedin:
          profile.contact
            ?.linkedin,

        github:
          profile.contact
            ?.github,

        website:
          profile.contact
            ?.website,
      },

      professionalSummary:
        profile.professionalSummary,

      skills: [
        ...profile.skills,
      ],

      technicalSkills: [
        ...profile.technicalSkills,
      ],

      softSkills: [
        ...profile.softSkills,
      ],

      experience:
        profile.experience.map(
          (item) => ({
            title:
              item.title,

            company:
              item.company,

            location:
              item.location,

            employmentType:
              item.employmentType,

            startDate:
              item.startDate,

            endDate:
              item.endDate,

            isCurrent:
              item.isCurrent,

            description:
              item.description,

            bullets: [
              ...item.bullets,
            ],

            technologies: [
              ...item.technologies,
            ],
          })
        ),

      projects:
        profile.projects.map(
          (item) => ({
            name:
              item.name,

            role:
              item.role,

            description:
              item.description,

            startDate:
              item.startDate,

            endDate:
              item.endDate,

            technologies: [
              ...item.technologies,
            ],

            bullets: [
              ...item.bullets,
            ],

            url:
              item.url,

            github:
              item.github,
          })
        ),

      education:
        profile.education.map(
          (item) => ({
            institution:
              item.institution,

            degree:
              item.degree,

            field:
              item.field,

            location:
              item.location,

            startDate:
              item.startDate,

            endDate:
              item.endDate,

            isCurrent:
              item.isCurrent,

            gpa:
              item.gpa,

            coursework: [
              ...item.coursework,
            ],

            achievements: [
              ...item.achievements,
            ],
          })
        ),

      certifications:
        profile.certifications.map(
          (item) => ({
            name:
              item.name,

            issuer:
              item.issuer,

            issueDate:
              item.issueDate,

            expirationDate:
              item.expirationDate,

            credentialId:
              item.credentialId,

            credentialUrl:
              item.credentialUrl,

            status:
              item.status,
          })
        ),

      languages:
        profile.languages.map(
          (item) => ({
            language:
              item.language,

            level:
              item.level,
          })
        ),

      volunteering:
        profile.volunteering.map(
          (item) => ({
            organization:
              item.organization,

            role:
              item.role,

            location:
              item.location,

            startDate:
              item.startDate,

            endDate:
              item.endDate,

            isCurrent:
              item.isCurrent,

            description:
              item.description,

            bullets: [
              ...item.bullets,
            ],
          })
        ),


      hackathons:
        (
          profile.hackathons ??
          []
        ).map(
          (item) => ({
            name:
              item.name,

            organization:
              item.organization,

            role:
              item.role,

            date:
              item.date,

            description:
              item.description,

            achievements: [
              ...item.achievements,
            ],
          })
        ),

      achievements: [
        ...profile.achievements,
      ],

      interests: [
        ...profile.interests,
      ],

      rawSections:
        profile.rawSections.map(
          (item) => ({
            title:
              item.title,

            content:
              item.content,
          })
        ),

      extractionStatus:
        profile.extractionStatus,

      extractionWarnings: [
        ...profile.extractionWarnings,
      ],
    };
  };

export const hasUsableResumeProfile =
  async (
    userId:
      | Types.ObjectId
      | string
  ): Promise<boolean> => {
    const profile =
      await getLatestOriginalResumeProfile(
        userId
      );

    if (!profile) {
      return false;
    }

    return Boolean(
      profile.professionalSummary ||
      profile.skills.length >
        0 ||
      profile.technicalSkills
        .length >
        0 ||
      profile.experience.length >
        0 ||
      profile.projects.length >
        0 ||
      profile.education.length >
        0
    );
  };