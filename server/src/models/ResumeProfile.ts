import {
  Schema,
  model,
  type Types,
} from "mongoose";

export interface IResumeContact {
  fullName?: string;

  email?: string;

  phone?: string;

  location?: string;

  linkedin?: string;

  github?: string;

  website?: string;
}

export interface IResumeExperience {
  _id?: Types.ObjectId;

  title: string;

  company?: string;

  location?: string;

  employmentType?: string;

  startDate?: string;

  endDate?: string;

  isCurrent: boolean;

  description?: string;

  bullets: string[];

  technologies: string[];
}

export interface IResumeProject {
  _id?: Types.ObjectId;

  name: string;

  role?: string;

  description?: string;

  startDate?: string;

  endDate?: string;

  technologies: string[];

  bullets: string[];

  url?: string;

  github?: string;
}

export interface IResumeEducation {
  _id?: Types.ObjectId;

  institution: string;

  degree?: string;

  field?: string;

  location?: string;

  startDate?: string;

  endDate?: string;

  isCurrent: boolean;

  gpa?: string;

  coursework: string[];

  achievements: string[];
}

export interface IResumeCertification {
  _id?: Types.ObjectId;

  name: string;

  issuer?: string;

  issueDate?: string;

  expirationDate?: string;

  credentialId?: string;

  credentialUrl?: string;

  status:
    | "completed"
    | "in-progress"
    | "expired";
}

export interface IResumeLanguage {
  language: string;

  level?: string;
}

export interface IResumeVolunteer {
  _id?: Types.ObjectId;

  organization: string;

  role?: string;

  location?: string;

  startDate?: string;

  endDate?: string;

  isCurrent?: boolean;

  description?: string;

  bullets: string[];
}

export interface IResumeHackathon {
  _id?: Types.ObjectId;

  name: string;

  organization?: string;

  role?: string;

  date?: string;

  description?: string;

  achievements: string[];
}

export interface IResumeProfile {
  _id?: Types.ObjectId;

  user: Types.ObjectId;

  resumeAnalysis?: Types.ObjectId;

  fileId?: Types.ObjectId;

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

  rawSections: Array<{
    title: string;

    content: string;
  }>;

  extractionStatus:
    | "pending"
    | "completed"
    | "partial"
    | "failed";

  extractionWarnings: string[];

  createdAt?: Date;

  updatedAt?: Date;
}

const resumeContactSchema =
  new Schema<IResumeContact>(
    {
      fullName: {
        type: String,
        trim: true,
      },

      email: {
        type: String,
        trim: true,
        lowercase: true,
      },

      phone: {
        type: String,
        trim: true,
      },

      location: {
        type: String,
        trim: true,
      },

      linkedin: {
        type: String,
        trim: true,
      },

      github: {
        type: String,
        trim: true,
      },

      website: {
        type: String,
        trim: true,
      },
    },
    {
      _id: false,
    }
  );

const resumeExperienceSchema =
  new Schema<IResumeExperience>(
    {
      title: {
        type: String,
        required: false,
        default: "",
        trim: true,
      },

      company: {
        type: String,
        trim: true,
      },

      location: {
        type: String,
        trim: true,
      },

      employmentType: {
        type: String,
        trim: true,
      },

      startDate: {
        type: String,
        trim: true,
      },

      endDate: {
        type: String,
        trim: true,
      },

      isCurrent: {
        type: Boolean,
        default: false,
      },

      description: {
        type: String,
        trim: true,
      },

      bullets: {
        type: [String],
        default: [],
      },

      technologies: {
        type: [String],
        default: [],
      },
    },
    {
      _id: true,
    }
  );

const resumeProjectSchema =
  new Schema<IResumeProject>(
    {
      name: {
        type: String,
        required: false,
        default: "",
        trim: true,
      },

      role: {
        type: String,
        trim: true,
      },

      description: {
        type: String,
        trim: true,
      },

      startDate: {
        type: String,
        trim: true,
      },

      endDate: {
        type: String,
        trim: true,
      },

      technologies: {
        type: [String],
        default: [],
      },

      bullets: {
        type: [String],
        default: [],
      },

      url: {
        type: String,
        trim: true,
      },

      github: {
        type: String,
        trim: true,
      },
    },
    {
      _id: true,
    }
  );

const resumeEducationSchema =
  new Schema<IResumeEducation>(
    {
      institution: {
        type: String,
        required: false,
        default: "",
        trim: true,
      },

      degree: {
        type: String,
        trim: true,
      },

      field: {
        type: String,
        trim: true,
      },

      location: {
        type: String,
        trim: true,
      },

      startDate: {
        type: String,
        trim: true,
      },

      endDate: {
        type: String,
        trim: true,
      },

      isCurrent: {
        type: Boolean,
        default: false,
      },

      gpa: {
        type: String,
        trim: true,
      },

      coursework: {
        type: [String],
        default: [],
      },

      achievements: {
        type: [String],
        default: [],
      },
    },
    {
      _id: true,
    }
  );

const resumeCertificationSchema =
  new Schema<IResumeCertification>(
    {
      name: {
        type: String,
        required: false,
        default: "",
        trim: true,
      },

      issuer: {
        type: String,
        trim: true,
      },

      issueDate: {
        type: String,
        trim: true,
      },

      expirationDate: {
        type: String,
        trim: true,
      },

      credentialId: {
        type: String,
        trim: true,
      },

      credentialUrl: {
        type: String,
        trim: true,
      },

      status: {
        type: String,
        enum: [
          "completed",
          "in-progress",
          "expired",
        ],
        default:
          "completed",
      },
    },
    {
      _id: true,
    }
  );

const resumeLanguageSchema =
  new Schema<IResumeLanguage>(
    {
      language: {
        type: String,
        required: false,
        default: "",
        trim: true,
      },

      level: {
        type: String,
        trim: true,
      },
    },
    {
      _id: false,
    }
  );

const resumeVolunteerSchema =
  new Schema<IResumeVolunteer>(
    {
      organization: {
        type: String,
        required: false,
        default: "",
        trim: true,
      },

      role: {
        type: String,
        trim: true,
      },

      location: {
        type: String,
        trim: true,
      },

      startDate: {
        type: String,
        trim: true,
      },

      endDate: {
        type: String,
        trim: true,
      },

      isCurrent: {
        type: Boolean,
        default: false,
      },

      description: {
        type: String,
        trim: true,
      },

      bullets: {
        type: [String],
        default: [],
      },
    },
    {
      _id: true,
    }
  );


const resumeHackathonSchema =
  new Schema<IResumeHackathon>(
    {
      name: {
        type: String,
        required: false,
        default: "",
        trim: true,
      },

      organization: {
        type: String,
        trim: true,
      },

      role: {
        type: String,
        trim: true,
      },

      date: {
        type: String,
        trim: true,
      },

      description: {
        type: String,
        trim: true,
      },

      achievements: {
        type: [String],
        default: [],
      },
    },
    {
      _id: true,
    }
  );


const rawSectionSchema =
  new Schema(
    {
      title: {
        type: String,
        required: false,
        default: "",
        trim: true,
      },

      content: {
        type: String,
        required: true,
      },
    },
    {
      _id: false,
    }
  );

const resumeProfileSchema =
  new Schema<IResumeProfile>(
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      resumeAnalysis: {
        type: Schema.Types.ObjectId,
        ref: "ResumeAnalysis",
        required: false,
        index: true,
      },

      fileId: {
        type: Schema.Types.ObjectId,
        required: false,
      },

      fileName: {
        type: String,
        required: true,
        trim: true,
      },

      contact: {
        type: resumeContactSchema,
        default: {},
      },

      professionalSummary: {
        type: String,
        default: "",
        trim: true,
      },

      skills: {
        type: [String],
        default: [],
      },

      technicalSkills: {
        type: [String],
        default: [],
      },

      softSkills: {
        type: [String],
        default: [],
      },

      experience: {
        type: [resumeExperienceSchema],
        default: [],
      },

      projects: {
        type: [resumeProjectSchema],
        default: [],
      },

      education: {
        type: [resumeEducationSchema],
        default: [],
      },

      certifications: {
        type: [
          resumeCertificationSchema,
        ],
        default: [],
      },

      languages: {
        type: [resumeLanguageSchema],
        default: [],
      },

      volunteering: {
        type: [resumeVolunteerSchema],
        default: [],
      },

      hackathons: {
        type: [resumeHackathonSchema],
        default: [],
      },

      achievements: {
        type: [String],
        default: [],
      },

      interests: {
        type: [String],
        default: [],
      },

      rawSections: {
        type: [rawSectionSchema],
        default: [],
      },

      extractionStatus: {
        type: String,
        enum: [
          "pending",
          "completed",
          "partial",
          "failed",
        ],
        required: true,
        default: "pending",
      },

      extractionWarnings: {
        type: [String],
        default: [],
      },
    },
    {
      timestamps: true,
    }
  );

resumeProfileSchema.index({
  user: 1,
  createdAt: -1,
});

resumeProfileSchema.index({
  user: 1,
  resumeAnalysis: 1,
});

resumeProfileSchema.index({
  "skills": 1,
});

resumeProfileSchema.index({
  "technicalSkills": 1,
});

export const ResumeProfile =
  model<IResumeProfile>(
    "ResumeProfile",
    resumeProfileSchema
  );