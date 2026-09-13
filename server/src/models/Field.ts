import {
  Schema,
  model,
  type Document,
} from "mongoose";

/* =========================================================
   TYPES
========================================================= */

export interface IRelatedField {
  fieldSlug: string;

  similarity: number;
}

export interface IRelatedRole {
  title: string;

  similarity: number;
}

export interface IField
  extends Document {
  slug: string;

  name: string;

  category: string;

  description: string;

  aliases: string[];

  searchQueries: string[];

  coreSkills: string[];

  secondarySkills: string[];

  keywords: string[];

  negativeKeywords: string[];

  relatedRoles: IRelatedRole[];

  relatedFields: IRelatedField[];

  isActive: boolean;

  createdAt: Date;

  updatedAt: Date;
}

/* =========================================================
   RELATED ROLE SCHEMA
========================================================= */

const relatedRoleSchema =
  new Schema<IRelatedRole>(
    {
      title: {
        type: String,
        required: true,
        trim: true,
      },

      similarity: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },
    },
    {
      _id: false,
    }
  );

/* =========================================================
   RELATED FIELD SCHEMA
========================================================= */

const relatedFieldSchema =
  new Schema<IRelatedField>(
    {
      fieldSlug: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },

      similarity: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },
    },
    {
      _id: false,
    }
  );

/* =========================================================
   FIELD SCHEMA
========================================================= */

const fieldSchema =
  new Schema<IField>(
    {
      slug: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
      },

      name: {
        type: String,
        required: true,
        trim: true,
      },

      category: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },

      description: {
        type: String,
        required: true,
        trim: true,
      },

      aliases: {
        type: [String],
        default: [],
      },

      searchQueries: {
        type: [String],
        default: [],
      },

      coreSkills: {
        type: [String],
        default: [],
      },

      secondarySkills: {
        type: [String],
        default: [],
      },

      keywords: {
        type: [String],
        default: [],
      },

      negativeKeywords: {
        type: [String],
        default: [],
      },

      relatedRoles: {
        type: [relatedRoleSchema],
        default: [],
      },

      relatedFields: {
        type: [relatedFieldSchema],
        default: [],
      },

      isActive: {
        type: Boolean,
        default: true,
      },
    },
    {
      timestamps: true,
      collection: "fields",
    }
  );

/* =========================================================
   INDEXES
========================================================= */

fieldSchema.index({
  slug: 1,
});

fieldSchema.index({
  name: 1,
});

fieldSchema.index({
  aliases: 1,
});

fieldSchema.index({
  keywords: 1,
});

fieldSchema.index({
  "relatedRoles.title": 1,
});

fieldSchema.index({
  "relatedFields.fieldSlug": 1,
});

fieldSchema.index({
  isActive: 1,
});

/* =========================================================
   MODEL
========================================================= */

export const Field =
  model<IField>(
    "Field",
    fieldSchema
  );

export default Field;