import {
  Schema,
  model,
  type Types,
} from "mongoose";

export type ResumeTemplateRole =
  | "penetration-tester"
  | "soc-analyst"
  | "full-stack-developer"
  | "software-engineer"
  | "machine-learning-engineer"
  | "data-scientist";

export type ResumeTemplateSectionType =
  | "summary"
  | "skills"
  | "experience"
  | "projects"
  | "education"
  | "certifications"
  | "achievements"
  | "other";

export interface IResumeTemplateSection {
  type: ResumeTemplateSectionType;

  title: string;

  order: number;

  required: boolean;

  guidance: string[];

  exampleBullets: string[];
}

export interface IResumeTemplateSkillGroup {
  title: string;

  skills: string[];
}

export interface IResumeTemplateExperiencePattern {
  title: string;

  description: string;

  examples: string[];
}

export interface IResumeTemplate {
  _id?: Types.ObjectId;

  role: ResumeTemplateRole;

  displayName: string;

  aliases: string[];

  description: string;

  professionalSummaryStyle: {
    minWords: number;

    maxWords: number;

    guidance: string[];

    example?: string;
  };

  coreSkills: string[];

  technicalSkills: string[];

  softSkills: string[];

  skillGroups: IResumeTemplateSkillGroup[];

  atsKeywords: string[];

  sections: IResumeTemplateSection[];

  experiencePatterns: IResumeTemplateExperiencePattern[];

  projectPatterns: string[];

  educationPatterns: string[];

  certificationPatterns: string[];

  formattingRules: string[];

  resumeWritingRules: string[];

  recommendedForRoles: string[];

  sourceFileName?: string;

  sourceFileId?: Types.ObjectId;

  version: number;

  isActive: boolean;

  createdAt?: Date;

  updatedAt?: Date;
}

const resumeTemplateSkillGroupSchema =
  new Schema<IResumeTemplateSkillGroup>(
    {
      title: {
        type: String,
        required: true,
        trim: true,
      },

      skills: {
        type: [String],
        default: [],
      },
    },
    {
      _id: false,
    }
  );

const resumeTemplateSectionSchema =
  new Schema<IResumeTemplateSection>(
    {
      type: {
        type: String,
        enum: [
          "summary",
          "skills",
          "experience",
          "projects",
          "education",
          "certifications",
          "achievements",
          "other",
        ],
        required: true,
      },

      title: {
        type: String,
        required: true,
        trim: true,
      },

      order: {
        type: Number,
        required: true,
        min: 0,
      },

      required: {
        type: Boolean,
        default: false,
      },

      guidance: {
        type: [String],
        default: [],
      },

      exampleBullets: {
        type: [String],
        default: [],
      },
    },
    {
      _id: false,
    }
  );

const resumeTemplateExperiencePatternSchema =
  new Schema<IResumeTemplateExperiencePattern>(
    {
      title: {
        type: String,
        required: true,
        trim: true,
      },

      description: {
        type: String,
        default: "",
        trim: true,
      },

      examples: {
        type: [String],
        default: [],
      },
    },
    {
      _id: false,
    }
  );

const resumeTemplateSchema =
  new Schema<IResumeTemplate>(
    {
      role: {
        type: String,
        enum: [
          "penetration-tester",
          "soc-analyst",
          "full-stack-developer",
          "software-engineer",
          "machine-learning-engineer",
          "data-scientist",
        ],
        required: true,
        unique: true,
        index: true,
      },

      displayName: {
        type: String,
        required: true,
        trim: true,
      },

      aliases: {
        type: [String],
        default: [],
      },

      description: {
        type: String,
        default: "",
        trim: true,
      },

      professionalSummaryStyle: {
        minWords: {
          type: Number,
          min: 0,
          default: 40,
        },

        maxWords: {
          type: Number,
          min: 0,
          default: 90,
        },

        guidance: {
          type: [String],
          default: [],
        },

        example: {
          type: String,
          required: false,
          trim: true,
        },
      },

      coreSkills: {
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

      skillGroups: {
        type: [resumeTemplateSkillGroupSchema],
        default: [],
      },

      atsKeywords: {
        type: [String],
        default: [],
      },

      sections: {
        type: [resumeTemplateSectionSchema],
        default: [],
      },

      experiencePatterns: {
        type: [
          resumeTemplateExperiencePatternSchema,
        ],
        default: [],
      },

      projectPatterns: {
        type: [String],
        default: [],
      },

      educationPatterns: {
        type: [String],
        default: [],
      },

      certificationPatterns: {
        type: [String],
        default: [],
      },

      formattingRules: {
        type: [String],
        default: [],
      },

      resumeWritingRules: {
        type: [String],
        default: [],
      },

      recommendedForRoles: {
        type: [String],
        default: [],
      },

      sourceFileName: {
        type: String,
        required: false,
        trim: true,
      },

      sourceFileId: {
        type: Schema.Types.ObjectId,
        required: false,
      },

      version: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
      },

      isActive: {
        type: Boolean,
        default: true,
        index: true,
      },
    },
    {
      timestamps: true,
    }
  );

resumeTemplateSchema.index({
  displayName: "text",
  aliases: "text",
  coreSkills: "text",
  technicalSkills: "text",
  atsKeywords: "text",
  recommendedForRoles: "text",
});

resumeTemplateSchema.index({
  role: 1,
  isActive: 1,
});

export const ResumeTemplate =
  model<IResumeTemplate>(
    "ResumeTemplate",
    resumeTemplateSchema
  );