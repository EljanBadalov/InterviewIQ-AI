import Field, {
  type IField,
} from "../models/Field";

/* =========================================================
   TYPES
========================================================= */

export interface ICareerRelatedRole {
  title: string;

  similarity: number;
}

export interface ICareerRelatedField {
  fieldSlug: string;

  similarity: number;
}

export interface ICareerFieldSummary {
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

  relatedRoles: ICareerRelatedRole[];

  relatedFields: ICareerRelatedField[];
}

export interface ICareerFieldResolved {
  field: ICareerFieldSummary;

  matchedBy:
    | "slug"
    | "name"
    | "alias";

  exactMatch: boolean;
}

export interface ICareerFieldSearchRole {
  title: string;

  similarity: number;

  source:
    | "target"
    | "alias"
    | "related-role";
}

export interface ICareerFieldSearchPlan {
  targetField: ICareerFieldSummary;

  searchQueries: string[];

  searchRoles: ICareerFieldSearchRole[];

  relatedRoles: ICareerRelatedRole[];

  relatedFields: Array<{
    field: ICareerFieldSummary;

    similarity: number;
  }>;

  coreSkills: string[];

  secondarySkills: string[];

  allSkills: string[];

  keywords: string[];

  negativeKeywords: string[];
}

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_MIN_RELATED_ROLE_SIMILARITY =
  55;

const DEFAULT_MIN_RELATED_FIELD_SIMILARITY =
  50;

const DEFAULT_MAX_RELATED_ROLES =
  15;

const DEFAULT_MAX_RELATED_FIELDS =
  5;

const DEFAULT_MAX_SEARCH_QUERIES =
  20;

/* =========================================================
   BASIC HELPERS
========================================================= */

const normalizeString = (
  value:
    string | undefined | null
): string => {
  return (
    value
      ?.replace(
        /\s+/g,
        " "
      )
      .trim() ||
    ""
  );
};

const normalizeLower = (
  value:
    string | undefined | null
): string => {
  return normalizeString(
    value
  ).toLowerCase();
};

const normalizeSlug = (
  value:
    string | undefined | null
): string => {
  return normalizeString(
    value
  )
    .toLowerCase()
    .replace(
      /[_\s]+/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    );
};

const normalizeComparable = (
  value:
    string | undefined | null
): string => {
  return normalizeLower(
    value
  )
    .replace(
      /[^a-z0-9+#.]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
};

const uniqueStrings = (
  values:
    string[]
): string[] => {
  const seen =
    new Set<string>();

  const result:
    string[] = [];

  for (
    const rawValue of
    values
  ) {
    const value =
      normalizeString(
        rawValue
      );

    if (
      !value
    ) {
      continue;
    }

    const key =
      value.toLowerCase();

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
      value
    );
  }

  return result;
};

/* =========================================================
   DOCUMENT MAPPER
========================================================= */

const mapFieldDocument = (
  field:
    IField
): ICareerFieldSummary => {
  return {
    slug:
      field.slug,

    name:
      field.name,

    category:
      field.category,

    description:
      field.description,

    aliases:
      field.aliases ||
      [],

    searchQueries:
      field.searchQueries ||
      [],

    coreSkills:
      field.coreSkills ||
      [],

    secondarySkills:
      field.secondarySkills ||
      [],

    keywords:
      field.keywords ||
      [],

    negativeKeywords:
      field.negativeKeywords ||
      [],

    relatedRoles:
      (
        field.relatedRoles ||
        []
      )
        .map(
          (
            item
          ) => ({
            title:
              normalizeString(
                item.title
              ),

            similarity:
              Math.max(
                0,
                Math.min(
                  100,
                  item.similarity
                )
              ),
          })
        )
        .filter(
          (
            item
          ) =>
            Boolean(
              item.title
            )
        ),

    relatedFields:
      (
        field.relatedFields ||
        []
      )
        .map(
          (
            item
          ) => ({
            fieldSlug:
              normalizeSlug(
                item.fieldSlug
              ),

            similarity:
              Math.max(
                0,
                Math.min(
                  100,
                  item.similarity
                )
              ),
          })
        )
        .filter(
          (
            item
          ) =>
            Boolean(
              item.fieldSlug
            )
        ),
  };
};

/* =========================================================
   GET ALL ACTIVE FIELDS
========================================================= */

export const getAllCareerFields =
  async (): Promise<ICareerFieldSummary[]> => {
    const fields =
      await Field.find({
        isActive:
          true,
      })
        .sort({
          name:
            1,
        })
        .lean<IField[]>();

    return fields.map(
      mapFieldDocument
    );
  };

/* =========================================================
   GET FIELD BY SLUG
========================================================= */

export const getCareerFieldBySlug =
  async (
    slug:
      string
  ): Promise<ICareerFieldSummary | null> => {
    const normalizedSlug =
      normalizeSlug(
        slug
      );

    if (
      !normalizedSlug
    ) {
      return null;
    }

    const field =
      await Field.findOne({
        slug:
          normalizedSlug,

        isActive:
          true,
      })
        .lean<IField>();

    if (
      !field
    ) {
      return null;
    }

    return mapFieldDocument(
      field
    );
  };

/* =========================================================
   RESOLVE CAREER FIELD
========================================================= */

export const resolveCareerField =
  async (
    value:
      string
  ): Promise<ICareerFieldResolved | null> => {
    const normalizedInput =
      normalizeComparable(
        value
      );

    const normalizedSlug =
      normalizeSlug(
        value
      );

    if (
      !normalizedInput
    ) {
      return null;
    }

    /* =====================================================
       TRY SLUG
    ===================================================== */

    const slugMatch =
      await Field.findOne({
        slug:
          normalizedSlug,

        isActive:
          true,
      })
        .lean<IField>();

    if (
      slugMatch
    ) {
      return {
        field:
          mapFieldDocument(
            slugMatch
          ),

        matchedBy:
          "slug",

        exactMatch:
          true,
      };
    }

    /* =====================================================
       NAME / ALIAS
    ===================================================== */

    const fields =
      await Field.find({
        isActive:
          true,
      })
        .lean<IField[]>();

    for (
      const field of
      fields
    ) {
      if (
        normalizeComparable(
          field.name
        ) ===
        normalizedInput
      ) {
        return {
          field:
            mapFieldDocument(
              field
            ),

          matchedBy:
            "name",

          exactMatch:
            true,
        };
      }

      const aliasMatched =
        (
          field.aliases ||
          []
        ).some(
          (
            alias
          ) =>
            normalizeComparable(
              alias
            ) ===
            normalizedInput
        );

      if (
        aliasMatched
      ) {
        return {
          field:
            mapFieldDocument(
              field
            ),

          matchedBy:
            "alias",

          exactMatch:
            false,
        };
      }
    }

    return null;
  };

/* =========================================================
   RELATED ROLES
========================================================= */

export const getRelatedCareerRoles =
  async (
    fieldSlug:
      string,
    options?: {
      minimumSimilarity?:
        number;

      limit?:
        number;
    }
  ): Promise<ICareerRelatedRole[]> => {
    const field =
      await getCareerFieldBySlug(
        fieldSlug
      );

    if (
      !field
    ) {
      return [];
    }

    const minimumSimilarity =
      Math.max(
        0,
        Math.min(
          100,
          options
            ?.minimumSimilarity ??
          DEFAULT_MIN_RELATED_ROLE_SIMILARITY
        )
      );

    const limit =
      Math.max(
        1,
        Math.min(
          100,
          options
            ?.limit ??
          DEFAULT_MAX_RELATED_ROLES
        )
      );

    return field
      .relatedRoles
      .filter(
        (
          item
        ) =>
          item.similarity >=
          minimumSimilarity
      )
      .sort(
        (
          a,
          b
        ) =>
          b.similarity -
          a.similarity
      )
      .slice(
        0,
        limit
      );
  };

/* =========================================================
   RELATED FIELDS
========================================================= */

export const getRelatedCareerFields =
  async (
    fieldSlug:
      string,
    options?: {
      minimumSimilarity?:
        number;

      limit?:
        number;
    }
  ): Promise<Array<{
    field:
      ICareerFieldSummary;

    similarity:
      number;
  }>> => {
    const targetField =
      await getCareerFieldBySlug(
        fieldSlug
      );

    if (
      !targetField
    ) {
      return [];
    }

    const minimumSimilarity =
      Math.max(
        0,
        Math.min(
          100,
          options
            ?.minimumSimilarity ??
          DEFAULT_MIN_RELATED_FIELD_SIMILARITY
        )
      );

    const limit =
      Math.max(
        1,
        Math.min(
          20,
          options
            ?.limit ??
          DEFAULT_MAX_RELATED_FIELDS
        )
      );

    const relations =
      targetField
        .relatedFields
        .filter(
          (
            item
          ) =>
            item.similarity >=
            minimumSimilarity
        )
        .sort(
          (
            a,
            b
          ) =>
            b.similarity -
            a.similarity
        )
        .slice(
          0,
          limit
        );

    if (
      relations.length ===
      0
    ) {
      return [];
    }

    const slugs =
      relations.map(
        (
          item
        ) =>
          item.fieldSlug
      );

    const relatedDocuments =
      await Field.find({
        slug: {
          $in:
            slugs,
        },

        isActive:
          true,
      })
        .lean<IField[]>();

    const relatedMap =
      new Map<
        string,
        IField
      >(
        relatedDocuments.map(
          (
            item
          ) => [
            item.slug,
            item,
          ]
        )
      );

    return relations
      .map(
        (
          relation
        ) => {
          const document =
            relatedMap.get(
              relation.fieldSlug
            );

          if (
            !document
          ) {
            return null;
          }

          return {
            field:
              mapFieldDocument(
                document
              ),

            similarity:
              relation.similarity,
          };
        }
      )
      .filter(
        (
          item
        ): item is {
          field:
            ICareerFieldSummary;

          similarity:
            number;
        } =>
          item !==
          null
      );
  };

/* =========================================================
   BUILD SEARCH ROLES

   Example for Frontend Developer:

   Frontend Developer        100
   Frontend Engineer         100
   React Developer            96
   React Engineer             95
   JavaScript Developer       92
   TypeScript Developer       88
   UI Engineer                86
   Web Developer              82
   Full Stack Developer       70
   Software Engineer          55
========================================================= */

export const buildCareerSearchRoles =
  async (
    targetRole:
      string,
    options?: {
      minimumRelatedRoleSimilarity?:
        number;

      maxRelatedRoles?:
        number;
    }
  ): Promise<{
    targetField:
      ICareerFieldSummary;

    searchRoles:
      ICareerFieldSearchRole[];
  } | null> => {
    const resolved =
      await resolveCareerField(
        targetRole
      );

    if (
      !resolved
    ) {
      return null;
    }

    const field =
      resolved.field;

    const minimumRelatedRoleSimilarity =
      Math.max(
        0,
        Math.min(
          100,
          options
            ?.minimumRelatedRoleSimilarity ??
          DEFAULT_MIN_RELATED_ROLE_SIMILARITY
        )
      );

    const maxRelatedRoles =
      Math.max(
        1,
        Math.min(
          100,
          options
            ?.maxRelatedRoles ??
          DEFAULT_MAX_RELATED_ROLES
        )
      );

    const result:
      ICareerFieldSearchRole[] =
      [];

    const seen =
      new Set<string>();

    const addRole = (
      title:
        string,
      similarity:
        number,
      source:
        ICareerFieldSearchRole["source"]
    ): void => {
      const normalizedTitle =
        normalizeString(
          title
        );

      if (
        !normalizedTitle
      ) {
        return;
      }

      const key =
        normalizeComparable(
          normalizedTitle
        );

      if (
        seen.has(
          key
        )
      ) {
        return;
      }

      seen.add(
        key
      );

      result.push({
        title:
          normalizedTitle,

        similarity:
          Math.max(
            0,
            Math.min(
              100,
              similarity
            )
          ),

        source,
      });
    };

    /* =====================================================
       TARGET ROLE
    ===================================================== */

    addRole(
      field.name,
      100,
      "target"
    );

    /* =====================================================
       TARGET ALIASES

       Aliases are considered equivalent variations of the
       same career field.
    ===================================================== */

    for (
      const alias of
      field.aliases
    ) {
      addRole(
        alias,
        100,
        "alias"
      );
    }

    /* =====================================================
       RELATED JOB TITLES
    ===================================================== */

    const relatedRoles =
      field
        .relatedRoles
        .filter(
          (
            item
          ) =>
            item.similarity >=
            minimumRelatedRoleSimilarity
        )
        .sort(
          (
            a,
            b
          ) =>
            b.similarity -
            a.similarity
        )
        .slice(
          0,
          maxRelatedRoles
        );

    for (
      const relatedRole of
      relatedRoles
    ) {
      addRole(
        relatedRole.title,
        relatedRole.similarity,
        "related-role"
      );
    }

    return {
      targetField:
        field,

      searchRoles:
        result,
    };
  };

/* =========================================================
   BUILD CAREER FIELD SEARCH PLAN
========================================================= */

export const buildCareerFieldSearchPlan =
  async (
    targetRole:
      string,
    options?: {
      includeRelatedFields?:
        boolean;

      minimumRelatedRoleSimilarity?:
        number;

      minimumRelatedFieldSimilarity?:
        number;

      maxRelatedRoles?:
        number;

      maxRelatedFields?:
        number;

      maxSearchQueries?:
        number;
    }
  ): Promise<ICareerFieldSearchPlan | null> => {
    const resolved =
      await resolveCareerField(
        targetRole
      );

    if (
      !resolved
    ) {
      return null;
    }

    const targetField =
      resolved.field;

    const minimumRelatedRoleSimilarity =
      options
        ?.minimumRelatedRoleSimilarity ??
      DEFAULT_MIN_RELATED_ROLE_SIMILARITY;

    const minimumRelatedFieldSimilarity =
      options
        ?.minimumRelatedFieldSimilarity ??
      DEFAULT_MIN_RELATED_FIELD_SIMILARITY;

    const maxRelatedRoles =
      options
        ?.maxRelatedRoles ??
      DEFAULT_MAX_RELATED_ROLES;

    const maxRelatedFields =
      options
        ?.maxRelatedFields ??
      DEFAULT_MAX_RELATED_FIELDS;

    const maxSearchQueries =
      Math.max(
        1,
        Math.min(
          100,
          options
            ?.maxSearchQueries ??
          DEFAULT_MAX_SEARCH_QUERIES
        )
      );

    /* =====================================================
       RELATED ROLES
    ===================================================== */

    const relatedRoles =
      await getRelatedCareerRoles(
        targetField.slug,
        {
          minimumSimilarity:
            minimumRelatedRoleSimilarity,

          limit:
            maxRelatedRoles,
        }
      );

    /* =====================================================
       RELATED FIELDS

       These are NOT the main vacancy-search mechanism.
       They remain useful for broader career context and
       later skill-roadmap logic.
    ===================================================== */

    const relatedFields =
      options
        ?.includeRelatedFields ===
        false
        ? []
        : await getRelatedCareerFields(
            targetField.slug,
            {
              minimumSimilarity:
                minimumRelatedFieldSimilarity,

              limit:
                maxRelatedFields,
            }
          );

    /* =====================================================
       SEARCH ROLES
    ===================================================== */

    const searchRoleResult =
      await buildCareerSearchRoles(
        targetField.slug,
        {
          minimumRelatedRoleSimilarity,

          maxRelatedRoles,
        }
      );

    const searchRoles =
      searchRoleResult
        ?.searchRoles ||
      [];

    /* =====================================================
       SEARCH QUERIES

       Priority:
       1. Main field searchQueries
       2. Target name / aliases
       3. relatedRoles
    ===================================================== */

    const searchQueries =
      uniqueStrings([
        ...targetField
          .searchQueries,

        targetField.name,

        ...targetField
          .aliases,

        ...relatedRoles
          .map(
            (
              item
            ) =>
              item.title
          ),
      ])
        .slice(
          0,
          maxSearchQueries
        );

    /* =====================================================
       SKILLS
    ===================================================== */

    const coreSkills =
      uniqueStrings(
        targetField
          .coreSkills
      );

    const secondarySkills =
      uniqueStrings(
        targetField
          .secondarySkills
      );

    const allSkills =
      uniqueStrings([
        ...coreSkills,
        ...secondarySkills,
      ]);

    /* =====================================================
       KEYWORDS
    ===================================================== */

    const keywords =
      uniqueStrings(
        targetField
          .keywords
      );

    const negativeKeywords =
      uniqueStrings(
        targetField
          .negativeKeywords
      );

    return {
      targetField,

      searchQueries,

      searchRoles,

      relatedRoles,

      relatedFields,

      coreSkills,

      secondarySkills,

      allSkills,

      keywords,

      negativeKeywords,
    };
  };

/* =========================================================
   GET RELATED ROLE SIMILARITY
========================================================= */

export const getRelatedRoleSimilarity =
  async (
    targetRole:
      string,
    candidateRole:
      string
  ): Promise<number> => {
    const resolved =
      await resolveCareerField(
        targetRole
      );

    if (
      !resolved
    ) {
      return 0;
    }

    const candidateNormalized =
      normalizeComparable(
        candidateRole
      );

    const targetNormalized =
      normalizeComparable(
        resolved.field.name
      );

    if (
      candidateNormalized ===
      targetNormalized
    ) {
      return 100;
    }

    const aliasMatched =
      resolved.field.aliases.some(
        (
          alias
        ) =>
          normalizeComparable(
            alias
          ) ===
          candidateNormalized
      );

    if (
      aliasMatched
    ) {
      return 100;
    }

    const related =
      resolved.field
        .relatedRoles
        .find(
          (
            item
          ) =>
            normalizeComparable(
              item.title
            ) ===
            candidateNormalized
        );

    return (
      related
        ?.similarity ??
      0
    );
  };

/* =========================================================
   GET FIELD SIMILARITY
========================================================= */

export const getCareerFieldSimilarity =
  async (
    sourceFieldSlug:
      string,
    targetFieldSlug:
      string
  ): Promise<number> => {
    const normalizedSource =
      normalizeSlug(
        sourceFieldSlug
      );

    const normalizedTarget =
      normalizeSlug(
        targetFieldSlug
      );

    if (
      !normalizedSource ||
      !normalizedTarget
    ) {
      return 0;
    }

    if (
      normalizedSource ===
      normalizedTarget
    ) {
      return 100;
    }

    const field =
      await getCareerFieldBySlug(
        normalizedSource
      );

    if (
      !field
    ) {
      return 0;
    }

    const relation =
      field
        .relatedFields
        .find(
          (
            item
          ) =>
            item.fieldSlug ===
            normalizedTarget
        );

    return (
      relation
        ?.similarity ??
      0
    );
  };

/* =========================================================
   TITLE SIMILARITY AGAINST FIELD DATA

   Synchronous after a search plan has already been built.
   This will be useful inside jobAggregationService.
========================================================= */

export const calculateRoleTitleSimilarity = (
  plan:
    ICareerFieldSearchPlan,
  jobTitle:
    string
): {
  similarity: number;

  matchedRole?: string;

  matchType:
    | "target"
    | "alias"
    | "related-role"
    | "none";
} => {
  const normalizedJobTitle =
    normalizeComparable(
      jobTitle
    );

  if (
    !normalizedJobTitle
  ) {
    return {
      similarity:
        0,

      matchType:
        "none",
    };
  }

  /* =====================================================
     TARGET NAME
  ===================================================== */

  const normalizedTarget =
    normalizeComparable(
      plan.targetField.name
    );

  if (
    normalizedJobTitle ===
      normalizedTarget ||
    normalizedJobTitle.includes(
      normalizedTarget
    )
  ) {
    return {
      similarity:
        100,

      matchedRole:
        plan.targetField.name,

      matchType:
        "target",
    };
  }

  /* =====================================================
     ALIASES
  ===================================================== */

  for (
    const alias of
    plan.targetField.aliases
  ) {
    const normalizedAlias =
      normalizeComparable(
        alias
      );

    if (
      !normalizedAlias
    ) {
      continue;
    }

    if (
      normalizedJobTitle ===
        normalizedAlias ||
      normalizedJobTitle.includes(
        normalizedAlias
      )
    ) {
      return {
        similarity:
          100,

        matchedRole:
          alias,

        matchType:
          "alias",
      };
    }
  }

  /* =====================================================
     RELATED ROLES
  ===================================================== */

  let bestSimilarity =
    0;

  let bestRole:
    string | undefined;

  for (
    const role of
    plan.relatedRoles
  ) {
    const normalizedRole =
      normalizeComparable(
        role.title
      );

    if (
      !normalizedRole
    ) {
      continue;
    }

    const matched =
      normalizedJobTitle ===
        normalizedRole ||
      normalizedJobTitle.includes(
        normalizedRole
      );

    if (
      matched &&
      role.similarity >
        bestSimilarity
    ) {
      bestSimilarity =
        role.similarity;

      bestRole =
        role.title;
    }
  }

  if (
    bestSimilarity >
    0
  ) {
    return {
      similarity:
        bestSimilarity,

      matchedRole:
        bestRole,

      matchType:
        "related-role",
    };
  }

  return {
    similarity:
      0,

    matchType:
      "none",
  };
};

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  getAllCareerFields,

  getCareerFieldBySlug,

  resolveCareerField,

  getRelatedCareerRoles,

  getRelatedCareerFields,

  buildCareerSearchRoles,

  buildCareerFieldSearchPlan,

  getRelatedRoleSimilarity,

  getCareerFieldSimilarity,

  calculateRoleTitleSimilarity,
};