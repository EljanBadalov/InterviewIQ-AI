import PDFDocument from "pdfkit";

import {
  type IGeneratedCVData,
} from "./cvBuilderService";

/* =========================================================
   TYPES
========================================================= */

interface GenerateCVPdfParams {
  cv: IGeneratedCVData;
}

interface GeneratedPdfResult {
  buffer: Buffer;
  fileName: string;
}

interface TextMeasureOptions {
  font?: string;
  fontSize?: number;
  width?: number;
  lineGap?: number;
}

interface HeadingWithDateOptions {
  heading: string;
  date?: string;
  fontSize?: number;
  dateFontSize?: number;
  bold?: boolean;
}

/* =========================================================
   PAGE
========================================================= */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const MARGIN_LEFT = 42;
const MARGIN_RIGHT = 42;
const MARGIN_TOP = 24;
const MARGIN_BOTTOM = 26;

const CONTENT_WIDTH =
  PAGE_WIDTH -
  MARGIN_LEFT -
  MARGIN_RIGHT;

const CONTENT_BOTTOM =
  PAGE_HEIGHT -
  MARGIN_BOTTOM;

const DATE_WIDTH = 128;
const HEADING_GAP = 8;

const HEADING_WIDTH =
  CONTENT_WIDTH -
  DATE_WIDTH -
  HEADING_GAP;

/* =========================================================
   TYPOGRAPHY
========================================================= */

const FONT_REGULAR = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";
const FONT_ITALIC = "Helvetica-Oblique";

const COLOR_TEXT = "#111111";
const COLOR_SECONDARY = "#333333";
const COLOR_RULE = "#111111";
const COLOR_SECTION = "#ffffff";

/* =========================================================
   TEXT HELPERS
========================================================= */

const cleanText = (
  value:
    | string
    | undefined
    | null
): string => {
  if (!value) {
    return "";
  }

  return value
    .replace(
      /[\u2013\u2014]/g,
      "-"
    )
    .replace(
      /\u00a0/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
};

const normalizeComparableText = (
  value:
    | string
    | undefined
    | null
): string => {
  return cleanText(
    value
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9+#./ ]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
};

const uniqueStrings = (
  values: string[]
): string[] => {
  const seen =
    new Set<string>();

  const result:
    string[] = [];

  for (
    const value
    of values
  ) {
    const cleaned =
      cleanText(
        value
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

const isRendererArtifact = (
  value:
    | string
    | undefined
    | null
): boolean => {
  const cleaned =
    cleanText(
      value
    );

  if (!cleaned) {
    return false;
  }

  return /^[\s\-–—_=]*\d+\s+of\s+\d+[\s\-–—_=]*$/i.test(
    cleaned
  );
};

const cleanRenderableText = (
  value:
    | string
    | undefined
    | null
): string => {
  const cleaned =
    cleanText(
      value
    );

  return isRendererArtifact(
    cleaned
  )
    ? ""
    : cleaned;
};

const capitalizeWord = (
  value: string
): string => {
  if (!value) {
    return "";
  }

  return (
    value
      .charAt(0)
      .toUpperCase() +
    value
      .slice(1)
      .toLowerCase()
  );
};

const escapeRegExp = (
  value: string
): string => {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
};

/* =========================================================
   CANDIDATE NAME
========================================================= */

const cleanPossibleName = (
  value: string
): string => {
  return value
    .replace(
      /\.(pdf|doc|docx)$/i,
      ""
    )
    .replace(
      /\b(cv|resume|curriculum|vitae)\b/gi,
      " "
    )
    .replace(
      /[_\-]+/g,
      " "
    )
    .replace(
      /([a-z])([A-Z])/g,
      "$1 $2"
    )
    .replace(
      /\d+/g,
      " "
    )
    .replace(
      /[^a-zA-ZÀ-ÿƏəĞğÇçŞşİıÖöÜü\s']/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
};

const formatPossibleName = (
  value: string
): string => {
  return cleanPossibleName(
    value
  )
    .split(" ")
    .filter(Boolean)
    .map(capitalizeWord)
    .join(" ");
};

const isUsableName = (
  value:
    | string
    | undefined
    | null
): boolean => {
  const cleaned =
    cleanText(
      value
    );

  if (!cleaned) {
    return false;
  }

  const lower =
    cleaned.toLowerCase();

  if (
    lower ===
      "candidate" ||
    lower ===
      "user" ||
    lower ===
      "resume" ||
    lower ===
      "cv"
  ) {
    return false;
  }

  return (
    cleaned
      .split(/\s+/)
      .filter(Boolean)
      .length >=
    2
  );
};

const getNameFromFileName = (
  fileName?:
    string
): string => {
  if (!fileName) {
    return "";
  }

  const result =
    formatPossibleName(
      fileName
    );

  return isUsableName(
    result
  )
    ? result
    : "";
};

const getNameFromEmail = (
  email?:
    string
): string => {
  if (!email) {
    return "";
  }

  const local =
    email
      .split("@")[0]
      ?.replace(
        /[._\-]+/g,
        " "
      )
      .replace(
        /\d+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  if (!local) {
    return "";
  }

  const name =
    local
      .split(" ")
      .filter(Boolean)
      .map(capitalizeWord)
      .join(" ");

  return isUsableName(
    name
  )
    ? name
    : "";
};

const resolveCandidateName = (
  cv:
    IGeneratedCVData
): string => {
  const profileName =
    cleanText(
      cv.contact
        .fullName
    );

  if (
    isUsableName(
      profileName
    )
  ) {
    return profileName;
  }

  const fromFile =
    getNameFromFileName(
      cv.metadata
        .sourceResume
        .fileName
    );

  if (fromFile) {
    return fromFile;
  }

  const fromEmail =
    getNameFromEmail(
      cv.contact
        .email
    );

  if (fromEmail) {
    return fromEmail;
  }

  throw new Error(
    "Candidate full name could not be determined."
  );
};

/* =========================================================
   FILE NAME
========================================================= */

const sanitizeFileName = (
  value: string
): string => {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-zA-Z0-9-_ ]/g,
      ""
    )
    .trim()
    .replace(
      /\s+/g,
      "_"
    );
};

const buildFileName = (
  cv:
    IGeneratedCVData,
  candidateName: string
): string => {
  const candidate =
    sanitizeFileName(
      candidateName
    );

  const role =
    sanitizeFileName(
      cv.metadata
        .targetJob
        ?.title ||
        (
          cv.metadata.strategy ===
          "general-improvement"
            ? "Improved"
            : "CV"
        )
    );

  return `${candidate}_${role}_CV.pdf`;
};

/* =========================================================
   DATE
========================================================= */

const getDateRange = (
  startDate?: string,
  endDate?: string,
  isCurrent?: boolean
): string => {
  const start =
    cleanText(
      startDate
    );

  const end =
    isCurrent
      ? "Present"
      : cleanText(
          endDate
        );

  if (
    start &&
    end
  ) {
    return `${start} - ${end}`;
  }

  return (
    start ||
    end ||
    ""
  );
};

/* =========================================================
   PAGE / CURSOR HELPERS
========================================================= */

const resetCursor = (
  doc:
    PDFKit.PDFDocument
): void => {
  doc.x =
    MARGIN_LEFT;
};

const addCVPage = (
  doc:
    PDFKit.PDFDocument
): void => {
  doc.addPage({
    size:
      "A4",

    margins: {
      top:
        MARGIN_TOP,

      bottom:
        MARGIN_BOTTOM,

      left:
        MARGIN_LEFT,

      right:
        MARGIN_RIGHT,
    },
  });

  doc.x =
    MARGIN_LEFT;

  doc.y =
    MARGIN_TOP;
};

const getRemainingPageHeight = (
  doc:
    PDFKit.PDFDocument
): number => {
  return (
    CONTENT_BOTTOM -
    doc.y
  );
};

const ensureSpace = (
  doc:
    PDFKit.PDFDocument,
  requiredHeight: number
): void => {
  if (
    requiredHeight <=
    getRemainingPageHeight(
      doc
    )
  ) {
    return;
  }

  /*
   * If we are already almost at the
   * top of a fresh page, do not keep
   * creating pages for one very large
   * content block.
   */
  if (
    doc.y <=
    MARGIN_TOP + 8
  ) {
    return;
  }

  addCVPage(
    doc
  );
};

const addVerticalSpace = (
  doc:
    PDFKit.PDFDocument,
  height: number
): void => {
  if (
    height <= 0
  ) {
    return;
  }

  ensureSpace(
    doc,
    height
  );

  doc.y +=
    height;

  resetCursor(
    doc
  );
};

/* =========================================================
   TEXT MEASUREMENT
========================================================= */

const measureTextHeight = (
  doc:
    PDFKit.PDFDocument,
  text: string,
  options:
    TextMeasureOptions = {}
): number => {
  const cleaned =
    cleanText(
      text
    );

  if (!cleaned) {
    return 0;
  }

  const {
    font =
      FONT_REGULAR,

    fontSize =
      7.6,

    width =
      CONTENT_WIDTH,

    lineGap =
      0.5,
  } = options;

  doc
    .font(
      font
    )
    .fontSize(
      fontSize
    );

  return doc.heightOfString(
    cleaned,
    {
      width,
      lineGap,
    }
  );
};

const measureBulletHeight = (
  doc:
    PDFKit.PDFDocument,
  text: string
): number => {
  const cleaned =
    cleanText(
      text
    );

  if (!cleaned) {
    return 0;
  }

  return (
    measureTextHeight(
      doc,
      cleaned,
      {
        font:
          FONT_REGULAR,

        fontSize:
          7.55,

        width:
          CONTENT_WIDTH -
          16,

        lineGap:
          0.25,
      }
    ) +
    2.5
  );
};

/* =========================================================
   GENERIC DRAW HELPERS
========================================================= */

const drawPlainText = (
  doc:
    PDFKit.PDFDocument,
  text: string,
  options:
    TextMeasureOptions & {
      color?: string;
      leftIndent?: number;
      spacingAfter?: number;
    } = {}
): void => {
  const cleaned =
    cleanText(
      text
    );

  if (!cleaned) {
    return;
  }

  const {
    font =
      FONT_REGULAR,

    fontSize =
      8.4,

    width =
      CONTENT_WIDTH,

    lineGap =
      0.6,

    color =
      COLOR_TEXT,

    leftIndent =
      0,

    spacingAfter =
      0,
  } = options;

  const actualWidth =
    Math.max(
      20,
      width -
      leftIndent
    );

  const height =
    measureTextHeight(
      doc,
      cleaned,
      {
        font,
        fontSize,
        width:
          actualWidth,
        lineGap,
      }
    );

  ensureSpace(
    doc,
    height +
      spacingAfter
  );

  doc
    .font(
      font
    )
    .fontSize(
      fontSize
    )
    .fillColor(
      color
    )
    .text(
      cleaned,
      MARGIN_LEFT +
        leftIndent,
      doc.y,
      {
        width:
          actualWidth,

        lineGap,
      }
    );

  resetCursor(
    doc
  );

  if (
    spacingAfter >
    0
  ) {
    doc.y +=
      spacingAfter;
  }
};

/* =========================================================
   HEADER
========================================================= */

const drawHeader = (
  doc:
    PDFKit.PDFDocument,
  cv:
    IGeneratedCVData,
  candidateName: string
): void => {
  resetCursor(
    doc
  );

  const name =
    cleanText(
      candidateName
    );

  const targetTitle =
    cleanText(
      cv.metadata
        .targetJob
        ?.title
    );

  ensureSpace(
    doc,
    92
  );

  doc
    .font(
      FONT_BOLD
    )
    .fontSize(
      16
    )
    .fillColor(
      COLOR_TEXT
    )
    .text(
      name.toUpperCase(),
      MARGIN_LEFT,
      doc.y,
      {
        width:
          CONTENT_WIDTH,

        align:
          "center",
      }
    );

  resetCursor(
    doc
  );

  addVerticalSpace(
    doc,
    1
  );

  if (targetTitle) {
    drawPlainText(
      doc,
      targetTitle,
      {
        font:
          FONT_REGULAR,

        fontSize:
          7.8,

        width:
          CONTENT_WIDTH,

        spacingAfter:
          0,
      }
    );

    doc.x =
      MARGIN_LEFT;

    doc.y -=
      8.5;

    doc
      .font(
        FONT_REGULAR
      )
      .fontSize(
        7.8
      )
      .text(
        targetTitle,
        MARGIN_LEFT,
        doc.y,
        {
          width:
            CONTENT_WIDTH,

          align:
            "center",
        }
      );

    resetCursor(
      doc
    );

    doc.y +=
      1;
  }

  const rows =
    uniqueStrings([
      cleanText(
        cv.contact.phone
      )
        ? `Mob: ${cleanText(
            cv.contact.phone
          )}`
        : "",

      cleanText(
        cv.contact.email
      )
        ? `E-mail: ${cleanText(
            cv.contact.email
          )}`
        : "",

      cleanText(
        cv.contact.linkedin
      )
        ? `LinkedIn: ${cleanText(
            cv.contact.linkedin
          )}`
        : "",

      cleanText(
        cv.contact.github
      )
        ? `GitHub: ${cleanText(
            cv.contact.github
          )}`
        : "",

      cleanText(
        cv.contact.website
      )
        ? `Website: ${cleanText(
            cv.contact.website
          )}`
        : "",
    ]);

  for (
    const row
    of rows
  ) {
    const height =
      measureTextHeight(
        doc,
        row,
        {
          font:
            FONT_REGULAR,

          fontSize:
            7.5,

          width:
            CONTENT_WIDTH,

          lineGap:
            0,
        }
      );

    ensureSpace(
      doc,
      height +
      1
    );

    doc
      .font(
        FONT_REGULAR
      )
      .fontSize(
        7.5
      )
      .fillColor(
        COLOR_TEXT
      )
      .text(
        row,
        MARGIN_LEFT,
        doc.y,
        {
          width:
            CONTENT_WIDTH,

          align:
            "center",

          lineGap:
            0,
        }
      );

    resetCursor(
      doc
    );
  }

  addVerticalSpace(
    doc,
    5
  );

  const ruleY =
    doc.y;

  doc
    .moveTo(
      MARGIN_LEFT,
      ruleY
    )
    .lineTo(
      PAGE_WIDTH -
        MARGIN_RIGHT,
      ruleY
    )
    .lineWidth(
      0.7
    )
    .strokeColor(
      COLOR_RULE
    )
    .stroke();

  doc.y =
    ruleY + 5;

  resetCursor(
    doc
  );
};

/* =========================================================
   SECTION TITLE
========================================================= */

const drawSectionTitle = (
  doc:
    PDFKit.PDFDocument,
  title: string
): void => {
  const cleaned =
    cleanText(
      title
    );

  if (!cleaned) {
    return;
  }

  ensureSpace(
    doc,
    18
  );

  if (
    doc.y >
    MARGIN_TOP + 2
  ) {
    doc.y +=
      4;
  }

  resetCursor(
    doc
  );

  doc
    .font(
      FONT_BOLD
    )
    .fontSize(
      8.1
    );

  const titleWidth =
    Math.min(
      CONTENT_WIDTH,
      doc.widthOfString(
        cleaned
      ) +
      6
    );

  const y =
    doc.y;

  doc
    .save()
    .fillColor(
      "#e8e8e8"
    )
    .rect(
      MARGIN_LEFT,
      y - 1,
      titleWidth,
      10.5
    )
    .fill()
    .restore();

  doc
    .font(
      FONT_BOLD
    )
    .fontSize(
      8.1
    )
    .fillColor(
      COLOR_TEXT
    )
    .text(
      cleaned,
      MARGIN_LEFT + 2,
      y,
      {
        width:
          Math.max(
            20,
            titleWidth -
            4
          ),

        lineBreak:
          false,
      }
    );

  doc.y =
    y + 13;

  resetCursor(
    doc
  );
};

/* =========================================================
   SUMMARY
========================================================= */

const drawSummary = (
  doc:
    PDFKit.PDFDocument,
  cv:
    IGeneratedCVData
): void => {
  const summary =
    cleanText(
      cv.professionalSummary
    );

  if (!summary) {
    return;
  }

  drawSectionTitle(
    doc,
    "Professional Profile"
  );

  drawPlainText(
    doc,
    summary,
    {
      font:
        FONT_REGULAR,

      fontSize:
        7.6,

      width:
        CONTENT_WIDTH,

      lineGap:
        0.2,

      spacingAfter:
        2,
    }
  );
};

/* =========================================================
   BULLET
========================================================= */

const drawCompactBullet = (
  doc:
    PDFKit.PDFDocument,
  text: string
): void => {
  const cleaned =
    cleanRenderableText(
      text
    );

  if (!cleaned) {
    return;
  }

  const bulletFontSize =
    7.55;

  const bulletLineGap =
    0.25;

  const textWidth =
    CONTENT_WIDTH -
    17;

  const textHeight =
    measureTextHeight(
      doc,
      cleaned,
      {
        font:
          FONT_REGULAR,

        fontSize:
          bulletFontSize,

        width:
          textWidth,

        lineGap:
          bulletLineGap,
      }
    );

  ensureSpace(
    doc,
    textHeight +
    2
  );

  const y =
    doc.y;

  doc
    .font(
      FONT_REGULAR
    )
    .fontSize(
      bulletFontSize
    )
    .fillColor(
      COLOR_TEXT
    )
    .text(
      "•",
      MARGIN_LEFT + 2,
      y,
      {
        width:
          8,

        lineBreak:
          false,
      }
    );

  doc
    .font(
      FONT_REGULAR
    )
    .fontSize(
      bulletFontSize
    )
    .fillColor(
      COLOR_TEXT
    )
    .text(
      cleaned,
      MARGIN_LEFT + 14,
      y,
      {
        width:
          textWidth,

        lineGap:
          bulletLineGap,
      }
    );

  /*
   * Do not trust the y-position left by the bullet glyph.
   * Advance deterministically using the exact same font/lineGap
   * values used for measurement and rendering.
   */
  doc.y =
    y +
    textHeight +
    2;

  resetCursor(
    doc
  );
};

/* =========================================================
   SKILL NORMALIZATION
========================================================= */

const normalizeSkillLabel = (
  skill: string
): string => {
  /*
   * LOSSLESS RENDERING RULE:
   * never upgrade or rename a factual skill.
   *
   * Examples we intentionally do NOT do here:
   * JavaScript -> JavaScript (ES6+)
   * HTML -> HTML5
   * CSS -> CSS3
   */
  return cleanText(
    skill
  );
};

/* =========================================================
   SKILL GROUPING
========================================================= */

interface SkillGroup {
  label: string;
  skills: string[];
}

const groupSkills = (
  skills:
    string[]
): SkillGroup[] => {
  const sourceSkills =
    uniqueStrings(
      skills
    );

  const programmingKeys =
    new Set([
      "javascript",
      "typescript",
      "python",
      "java",
      "c",
      "c++",
      "c#",
      "go",
      "php",
      "ruby",
    ]);

  const frameworkKeys =
    new Set([
      "react",
      "react.js",
      "nextjs",
      "next.js",
      "vue",
      "vue.js",
      "angular",
      "node",
      "nodejs",
      "node.js",
      "express",
      "express.js",
      "bootstrap",
      "tailwind css",
      "tailwindcss",
      "sass",
      "scss",
      "html",
      "html5",
      "css",
      "css3",
    ]);

  const databaseKeys =
    new Set([
      "mongodb",
      "postgresql",
      "postgres",
      "mysql",
      "sql",
      "firebase",
      "redis",
    ]);

  const toolKeys =
    new Set([
      "git",
      "github",
      "docker",
      "postman",
      "vs code",
      "vscode",
      "ci/cd",
      "rest api",
      "restful api",
      "graphql",
      "figma",
    ]);

  const used =
    new Set<number>();

  const result:
    SkillGroup[] = [];

  const takeGroup = (
    label: string,
    allowed:
      Set<string>
  ): void => {
    const values:
      string[] = [];

    sourceSkills.forEach(
      (
        skill,
        index
      ) => {
        const key =
          normalizeComparableText(
            skill
          );

        if (
          !used.has(
            index
          ) &&
          allowed.has(
            key
          )
        ) {
          used.add(
            index
          );

          values.push(
            skill
          );
        }
      }
    );

    if (
      values.length >
      0
    ) {
      result.push({
        label,

        skills:
          values,
      });
    }
  };

  takeGroup(
    "Programming Languages",
    programmingKeys
  );

  takeGroup(
    "Frameworks & Libraries",
    frameworkKeys
  );

  takeGroup(
    "Databases",
    databaseKeys
  );

  takeGroup(
    "Developer Tools",
    toolKeys
  );

  const remaining =
    sourceSkills.filter(
      (
        _skill,
        index
      ) =>
        !used.has(
          index
        )
    );

  if (
    remaining.length >
    0
  ) {
    result.push({
      label:
        "Additional Skills",

      skills:
        remaining,
    });
  }

  return result;
};

/* =========================================================
   SKILLS
========================================================= */

const drawSkills = (
  doc:
    PDFKit.PDFDocument,
  cv:
    IGeneratedCVData
): void => {
  const skills =
    uniqueStrings([
      ...cv.skills
        .primary,

      ...cv.skills
        .verified,

      ...cv.skills
        .additionalSupported,
    ]).filter(
      (
        skill
      ) =>
        !isRendererArtifact(
          skill
        )
    );

  if (
    skills.length ===
    0
  ) {
    return;
  }

  drawSectionTitle(
    doc,
    "Technical Skills"
  );

  drawCompactBullet(
    doc,
    skills.join(
      ", "
    )
  );

  addVerticalSpace(
    doc,
    1
  );
};

/* =========================================================
   HEADING + DATE
========================================================= */

const drawHeadingWithDate = (
  doc:
    PDFKit.PDFDocument,
  options:
    HeadingWithDateOptions
): number => {
  const heading =
    cleanText(
      options.heading
    );

  const date =
    cleanText(
      options.date
    );

  const fontSize =
    options.fontSize ??
    7.9;

  const dateFontSize =
    options.dateFontSize ??
    7.0;

  const headingFont =
    options.bold ===
      false
      ? FONT_REGULAR
      : FONT_BOLD;

  const headingHeight =
    measureTextHeight(
      doc,
      heading,
      {
        font:
          headingFont,

        fontSize,

        width:
          date
            ? HEADING_WIDTH
            : CONTENT_WIDTH,

        lineGap:
          0.5,
      }
    );

  const dateHeight =
    date
      ? measureTextHeight(
          doc,
          date,
          {
            font:
              FONT_ITALIC,

            fontSize:
              dateFontSize,

            width:
              DATE_WIDTH,

            lineGap:
              0,
          }
        )
      : 0;

  const rowHeight =
    Math.max(
      headingHeight,
      dateHeight,
      fontSize + 2
    );

  ensureSpace(
    doc,
    rowHeight + 2
  );

  const y =
    doc.y;

  if (heading) {
    doc
      .font(
        headingFont
      )
      .fontSize(
        fontSize
      )
      .fillColor(
        COLOR_TEXT
      )
      .text(
        heading,
        MARGIN_LEFT,
        y,
        {
          width:
            date
              ? HEADING_WIDTH
              : CONTENT_WIDTH,

          lineGap:
            0.5,
        }
      );
  }

  if (date) {
    doc
      .font(
        FONT_ITALIC
      )
      .fontSize(
        dateFontSize
      )
      .fillColor(
        COLOR_SECONDARY
      )
      .text(
        date,
        MARGIN_LEFT +
          CONTENT_WIDTH -
          DATE_WIDTH,
        y,
        {
          width:
            DATE_WIDTH,

          align:
            "right",

          lineGap:
            0,
        }
      );
  }

  doc.y =
    y +
    rowHeight +
    2;

  resetCursor(
    doc
  );

  return rowHeight;
};

/* =========================================================
   EXPERIENCE HEIGHT
========================================================= */

const estimateExperienceHeight = (
  doc:
    PDFKit.PDFDocument,
  item:
    IGeneratedCVData[
      "experience"
    ][
      "items"
    ][number]
): number => {
  const heading =
    [
      cleanText(
        item.title
      ),

      cleanText(
        item.company
      ),
    ]
      .filter(Boolean)
      .join(
        " — "
      );

  const date =
    getDateRange(
      item.startDate,
      item.endDate,
      item.isCurrent
    );

  let height =
    Math.max(
      measureTextHeight(
        doc,
        heading,
        {
          font:
            FONT_BOLD,

          fontSize:
            8.8,

          width:
            date
              ? HEADING_WIDTH
              : CONTENT_WIDTH,

          lineGap:
            0.5,
        }
      ),
      11
    ) +
    3;

  const meta =
    [
      cleanText(
        item.location
      ),

      cleanText(
        item.employmentType
      ),
    ]
      .filter(Boolean)
      .join(
        " | "
      );

  if (meta) {
    height +=
      measureTextHeight(
        doc,
        meta,
        {
          font:
            FONT_ITALIC,

          fontSize:
            7.6,

          width:
            CONTENT_WIDTH,
        }
      ) +
      2;
  }

  const bullets =
    uniqueStrings([
      cleanText(
        item.description
      ),

      ...item.bullets,
    ]);

  for (
    const bullet
    of bullets
  ) {
    height +=
      measureBulletHeight(
        doc,
        bullet
      );
  }

  return (
    height +
    5
  );
};

/* =========================================================
   EXPERIENCE
========================================================= */

const drawExperience = (
  doc:
    PDFKit.PDFDocument,
  cv:
    IGeneratedCVData
): void => {
  if (
    !cv.experience
      .items.length
  ) {
    return;
  }

  drawSectionTitle(
    doc,
    "Experience"
  );

  for (
    const item
    of cv.experience.items
  ) {
    const estimatedHeight =
      estimateExperienceHeight(
        doc,
        item
      );

    ensureSpace(
      doc,
      estimatedHeight
    );

    const heading =
      [
        cleanText(
          item.title
        ),

        cleanText(
          item.company
        ),
      ]
        .filter(Boolean)
        .join(
          " — "
        );

    const date =
      getDateRange(
        item.startDate,
        item.endDate,
        item.isCurrent
      );

    drawHeadingWithDate(
      doc,
      {
        heading:
          heading,

        date,

        fontSize:
          7.9,

        dateFontSize:
          7.0,
      }
    );

    const metadata =
      [
        cleanText(
          item.location
        ),

        cleanText(
          item.employmentType
        ),
      ]
        .filter(Boolean)
        .join(
          " | "
        );

    if (metadata) {
      drawPlainText(
        doc,
        metadata,
        {
          font:
            FONT_ITALIC,

          fontSize:
            7.6,

          width:
            CONTENT_WIDTH,

          color:
            COLOR_SECONDARY,

          spacingAfter:
            2,
        }
      );
    }

    const bullets =
      item.bullets.length >
      0
        ? uniqueStrings(
            item.bullets
          )
        : cleanText(
            item.description
          )
          ? [
              cleanText(
                item.description
              ),
            ]
          : [];

    for (
      const bullet
      of bullets
    ) {
      drawCompactBullet(
        doc,
        bullet
      );
    }

    addVerticalSpace(
      doc,
      5
    );
  }
};

/* =========================================================
   PROJECT HEIGHT
========================================================= */

const estimateProjectHeight = (
  doc:
    PDFKit.PDFDocument,
  item:
    IGeneratedCVData[
      "projects"
    ][
      "items"
    ][number]
): number => {
  const name =
    cleanText(
      item.name
    );

  const date =
    getDateRange(
      item.startDate,
      item.endDate
    );

  let height =
    Math.max(
      measureTextHeight(
        doc,
        name,
        {
          font:
            FONT_BOLD,

          fontSize:
            8.8,

          width:
            date
              ? HEADING_WIDTH
              : CONTENT_WIDTH,
        }
      ),
      11
    ) +
    3;

  const role =
    cleanText(
      item.role
    );

  if (role) {
    height +=
      measureTextHeight(
        doc,
        role,
        {
          font:
            FONT_ITALIC,

          fontSize:
            7.6,

          width:
            CONTENT_WIDTH,
        }
      ) +
      2;
  }

  const tech =
    uniqueStrings(
      item.technologies
    );

  if (
    tech.length >
    0
  ) {
    height +=
      measureTextHeight(
        doc,
        `Technologies: ${tech.join(
          ", "
        )}`,
        {
          font:
            FONT_REGULAR,

          fontSize:
            7.8,

          width:
            CONTENT_WIDTH,
        }
      ) +
      2;
  }

  const bullets =
    uniqueStrings([
      cleanText(
        item.description
      ),

      ...item.bullets,
    ]);

  for (
    const bullet
    of bullets
  ) {
    height +=
      measureBulletHeight(
        doc,
        bullet
      );
  }

  return (
    height +
    5
  );
};

/* =========================================================
   PROJECTS
========================================================= */

const drawProjects = (
  doc:
    PDFKit.PDFDocument,
  cv:
    IGeneratedCVData
): void => {
  if (
    !cv.projects
      .items.length
  ) {
    return;
  }

  drawSectionTitle(
    doc,
    "Projects"
  );

  for (
    const item
    of cv.projects.items
  ) {
    if (
      !cleanRenderableText(
        item.name
      )
    ) {
      continue;
    }
    const estimatedHeight =
      estimateProjectHeight(
        doc,
        item
      );

    ensureSpace(
      doc,
      estimatedHeight
    );

    const date =
      getDateRange(
        item.startDate,
        item.endDate
      );

    const projectName =
      cleanRenderableText(
        item.name
      );

    drawHeadingWithDate(
      doc,
      {
        heading:
          projectName,

        date,

        fontSize:
          7.9,

        dateFontSize:
          7.0,
      }
    );

    const role =
      cleanText(
        item.role
      );

    if (role) {
      drawPlainText(
        doc,
        role,
        {
          font:
            FONT_ITALIC,

          fontSize:
            7.6,

          color:
            COLOR_SECONDARY,

          spacingAfter:
            1,
        }
      );
    }

    const technologies =
      uniqueStrings(
        item.technologies
      );

    if (
      technologies.length >
      0
    ) {
      drawPlainText(
        doc,
        `Technologies: ${technologies.join(
          ", "
        )}`,
        {
          font:
            FONT_REGULAR,

          fontSize:
            7.8,

          color:
            COLOR_SECONDARY,

          spacingAfter:
            2,
        }
      );
    }

    const bullets =
      uniqueStrings([
        cleanRenderableText(
          item.description
        ),

        ...item.bullets.map(
          (
            bullet
          ) =>
            cleanRenderableText(
              bullet
            )
        ),
      ]).filter(
        (
          bullet
        ) =>
          Boolean(
            bullet
          ) &&
          !isRendererArtifact(
            bullet
          ) &&
          !/^(?:programming languages?|frameworks?(?:\s*&\s*libraries)?|developer tools?|tools|databases?|technical skills?)\s*:/i.test(
            bullet
          )
      );

    for (
      const bullet
      of bullets
    ) {
      drawCompactBullet(
        doc,
        bullet
      );
    }

    const links =
      uniqueStrings([
        cleanText(
          item.github
        ),

        cleanText(
          item.url
        ),
      ]);

    if (
      links.length >
      0
    ) {
      drawPlainText(
        doc,
        links.join(
          " | "
        ),
        {
          font:
            FONT_REGULAR,

          fontSize:
            7.3,

          color:
            COLOR_SECONDARY,

          spacingAfter:
            1,
        }
      );
    }

    addVerticalSpace(
      doc,
      5
    );
  }
};

/* =========================================================
   CERTIFICATIONS
========================================================= */

const drawCertifications = (
  doc:
    PDFKit.PDFDocument,
  cv:
    IGeneratedCVData
): void => {
  if (
    !cv.certifications
      .items.length
  ) {
    return;
  }

  drawSectionTitle(
    doc,
    "Training & Certifications"
  );

  for (
    const cert
    of cv.certifications
      .items
  ) {
    const name =
      formatOrganizationWithLocation(
        cert.name
      );

    const programOrIssuer =
      cleanRenderableText(
        cert.issuer
      );

    const date =
      getDateRange(
        cert.issueDate,
        cert.expirationDate,
        false
      );

    if (!name) {
      continue;
    }

    /*
     * Provider/course name is always the main heading.
     * Program/field belongs only to this same record and is rendered
     * directly underneath, preventing Holberton/Technest data mixing.
     */
    drawHeadingWithDate(
      doc,
      {
        heading:
          name,

        date,

        fontSize:
          7.9,

        dateFontSize:
          7.0,
      }
    );

    if (
      programOrIssuer &&
      normalizeComparableText(
        programOrIssuer
      ) !==
      normalizeComparableText(
        name
      )
    ) {
      drawPlainText(
        doc,
        programOrIssuer,
        {
          font:
            FONT_ITALIC,

          fontSize:
            7.35,

          width:
            CONTENT_WIDTH,

          color:
            COLOR_SECONDARY,

          spacingAfter:
            1,
        }
      );
    }

    const details =
      uniqueStrings([
        cert.status ===
        "in-progress"
          ? "In Progress"
          : "",

        cert.status ===
        "expired"
          ? "Expired"
          : "",

        cleanRenderableText(
          cert.credentialId
        )
          ? `Credential ID: ${cleanRenderableText(
              cert.credentialId
            )}`
          : "",

        cleanRenderableText(
          cert.credentialUrl
        ),
      ]);

    if (
      details.length >
      0
    ) {
      drawPlainText(
        doc,
        details.join(
          " | "
        ),
        {
          font:
            FONT_REGULAR,

          fontSize:
            7.0,

          color:
            COLOR_SECONDARY,

          spacingAfter:
            1,
        }
      );
    }

    addVerticalSpace(
      doc,
      3
    );
  }
};

/* =========================================================
   EDUCATION SANITIZATION
========================================================= */

const removeKnownEducationDates = (
  value: string,
  startDate?: string,
  endDate?: string
): string => {
  let result =
    cleanText(
      value
    );

  const dates =
    uniqueStrings([
      cleanText(
        startDate
      ),

      cleanText(
        endDate
      ),
    ]);

  for (
    const date
    of dates
  ) {
    if (!date) {
      continue;
    }

    result =
      result.replace(
        new RegExp(
          escapeRegExp(
            date
          ),
          "gi"
        ),
        " "
      );
  }

  return result
    .replace(
      /\(\s*\)/g,
      " "
    )
    .replace(
      /\s*[-–—]\s*$/g,
      " "
    )
    .replace(
      /^\s*[-–—]\s*/g,
      " "
    )
    .replace(
      /\s*,\s*,+/g,
      ", "
    )
    .replace(
      /\s+/g,
      " "
    )
    .replace(
      /^[,;|\- ]+/,
      ""
    )
    .replace(
      /[,;|\- ]+$/,
      ""
    )
    .trim();
};

const buildEducationProgramText = (
  degree?: string,
  field?: string,
  _startDate?: string,
  _endDate?: string
): string => {
  const cleanedDegree =
    cleanText(
      degree
    );

  const cleanedField =
    cleanText(
      field
    );

  if (
    cleanedDegree &&
    cleanedField
  ) {
    const degreeNormalized =
      normalizeComparableText(
        cleanedDegree
      );

    const fieldNormalized =
      normalizeComparableText(
        cleanedField
      );

    if (
      degreeNormalized ===
      fieldNormalized
    ) {
      return cleanedDegree;
    }

    if (
      degreeNormalized.includes(
        fieldNormalized
      )
    ) {
      return cleanedDegree;
    }

    if (
      fieldNormalized.includes(
        degreeNormalized
      )
    ) {
      return cleanedField;
    }

    return `${cleanedDegree}, ${cleanedField}`;
  }

  return (
    cleanedDegree ||
    cleanedField ||
    ""
  );
};

/* =========================================================
   EDUCATION
========================================================= */

const formatOrganizationWithLocation = (
  name:
    | string
    | undefined,
  explicitLocation?:
    string
): string => {
  const cleanedName =
    cleanRenderableText(
      name
    );

  const cleanedLocation =
    cleanRenderableText(
      explicitLocation
    );

  if (!cleanedName) {
    return "";
  }

  if (
    cleanedLocation
  ) {
    return `${cleanedName} (${cleanedLocation})`;
  }

  /*
   * Legacy/source profile fallback:
   * "Azerbaijan Technological University Ganja"
   * -> "Azerbaijan Technological University (Ganja)"
   */
  const parts =
    cleanedName
      .split(
        /\s+/
      )
      .filter(
        Boolean
      );

  if (
    parts.length <
    2
  ) {
    return cleanedName;
  }

  const last =
    parts[
      parts.length -
      1
    ] ||
    "";

  const prefix =
    parts
      .slice(
        0,
        -1
      )
      .join(
        " "
      );

  const providerLike =
    /\b(?:university|college|school|academy|institute|institut|universitet|kollec|məktəb|mekteb|akademiya|technest|holberton|training|təlim|telim)\b/i.test(
      prefix
    );

  const locationLike =
    /^[A-Za-zÀ-ÖØ-öø-ÿƏəĞğÇçŞşİıÖöÜü'’-]{2,}$/u.test(
      last
    );

  if (
    providerLike &&
    locationLike
  ) {
    return `${prefix} (${last})`;
  }

  return cleanedName;
};

const drawEducation = (
  doc:
    PDFKit.PDFDocument,
  cv:
    IGeneratedCVData
): void => {
  if (
    !cv.education
      .items.length
  ) {
    return;
  }

  drawSectionTitle(
    doc,
    "Education"
  );

  for (
    const item
    of cv.education
      .items
  ) {
    const institution =
      cleanText(
        item.institution
      );

    const educationHeading =
      formatOrganizationWithLocation(
        institution,
        item.location
      );

    const date =
      getDateRange(
        item.startDate,
        item.endDate,
        item.isCurrent
      );

    const program =
      buildEducationProgramText(
        item.degree,
        item.field,
        item.startDate,
        item.endDate
      );

    let estimatedHeight =
      Math.max(
        measureTextHeight(
          doc,
          educationHeading,
          {
            font:
              FONT_BOLD,

            fontSize:
              8.7,

            width:
              date
                ? HEADING_WIDTH
                : CONTENT_WIDTH,
          }
        ),
        11
      ) +
      4;

    if (program) {
      estimatedHeight +=
        measureTextHeight(
          doc,
          program,
          {
            font:
              FONT_REGULAR,

            fontSize:
              8,

            width:
              CONTENT_WIDTH,
          }
        ) +
        2;
    }

    ensureSpace(
      doc,
      estimatedHeight +
      6
    );

    drawHeadingWithDate(
      doc,
      {
        heading:
          educationHeading,

        date,

        fontSize:
          8.7,

        dateFontSize:
          7.4,
      }
    );

    if (program) {
      drawPlainText(
        doc,
        program,
        {
          font:
            FONT_ITALIC,

          fontSize:
            7.4,

          width:
            CONTENT_WIDTH,

          spacingAfter:
            1,
        }
      );
    }

    const gpa =
      cleanText(
        item.gpa
      );

    if (gpa) {
      drawPlainText(
        doc,
        `GPA: ${gpa}`,
        {
          font:
            FONT_REGULAR,

          fontSize:
            7.6,

          color:
            COLOR_SECONDARY,

          spacingAfter:
            1,
        }
      );
    }

    const coursework =
      uniqueStrings(
        item.coursework
      );

    if (
      coursework.length >
      0
    ) {
      drawPlainText(
        doc,
        `Relevant Coursework: ${coursework.join(
          ", "
        )}`,
        {
          font:
            FONT_REGULAR,

          fontSize:
            7.6,

          color:
            COLOR_SECONDARY,

          spacingAfter:
            2,
        }
      );
    }

    const achievements =
      uniqueStrings(
        item.achievements
      );

    for (
      const achievement
      of achievements
    ) {
      drawCompactBullet(
        doc,
        achievement
      );
    }

    addVerticalSpace(
      doc,
      4
    );
  }
};

/* =========================================================
   VOLUNTEERING
========================================================= */

const drawVolunteering = (
  doc:
    PDFKit.PDFDocument,
  cv:
    IGeneratedCVData
): void => {
  if (
    !cv.volunteering
      .items.length
  ) {
    return;
  }

  drawSectionTitle(
    doc,
    "Volunteer Activities"
  );

  for (
    const item
    of cv.volunteering
      .items
  ) {
    const heading =
      [
        cleanText(
          item.role
        ),

        cleanText(
          item.organization
        ),
      ]
        .filter(Boolean)
        .join(
          ", "
        );

    const date =
      getDateRange(
        item.startDate,
        item.endDate,
        item.isCurrent
      );

    const sourceContent =
      item.bullets.length >
      0
        ? uniqueStrings(
            item.bullets
          )
        : cleanText(
            item.description
          )
          ? [
              cleanText(
                item.description
              ),
            ]
          : [];

    let estimatedHeight =
      Math.max(
        measureTextHeight(
          doc,
          heading,
          {
            font:
              FONT_BOLD,

            fontSize:
              8.5,

            width:
              date
                ? HEADING_WIDTH
                : CONTENT_WIDTH,
          }
        ),
        11
      ) +
      4;

    const location =
      cleanText(
        item.location
      );

    if (location) {
      estimatedHeight +=
        measureTextHeight(
          doc,
          location,
          {
            font:
              FONT_ITALIC,

            fontSize:
              7.5,

            width:
              CONTENT_WIDTH,
          }
        ) +
        2;
    }

    for (
      const content
      of sourceContent
    ) {
      estimatedHeight +=
        measureBulletHeight(
          doc,
          content
        );
    }

    ensureSpace(
      doc,
      estimatedHeight
    );

    drawHeadingWithDate(
      doc,
      {
        heading,

        date,

        fontSize:
          8.5,

        dateFontSize:
          7.3,
      }
    );

    if (location) {
      drawPlainText(
        doc,
        location,
        {
          font:
            FONT_ITALIC,

          fontSize:
            7.5,

          color:
            COLOR_SECONDARY,

          spacingAfter:
            2,
        }
      );
    }

    for (
      const content
      of sourceContent
    ) {
      drawCompactBullet(
        doc,
        content
      );
    }

    addVerticalSpace(
      doc,
      4
    );
  }
};

/* =========================================================
   HACKATHONS & COMPETITIONS
========================================================= */

const drawHackathons = (
  doc:
    PDFKit.PDFDocument,
  cv:
    IGeneratedCVData
): void => {
  if (
    !cv.hackathons
      .items.length
  ) {
    return;
  }

  drawSectionTitle(
    doc,
    "Hackathons & Competitions"
  );

  for (
    const item
    of cv.hackathons
      .items
  ) {
    const heading =
      uniqueStrings([
        cleanText(
          item.role
        ),

        cleanText(
          item.name
        ),

        cleanText(
          item.organization
        ),
      ]).join(
        " — "
      );

    drawHeadingWithDate(
      doc,
      {
        heading,

        date:
          cleanText(
            item.date
          ),

        fontSize:
          8.5,

        dateFontSize:
          7.3,
      }
    );

    const sourceContent =
      uniqueStrings([
        cleanText(
          item.description
        ),

        ...item.achievements,
      ]);

    for (
      const content
      of sourceContent
    ) {
      drawCompactBullet(
        doc,
        content
      );
    }

    addVerticalSpace(
      doc,
      4
    );
  }
};

/* =========================================================
   ACHIEVEMENTS
========================================================= */

const drawAchievements = (
  doc:
    PDFKit.PDFDocument,
  cv:
    IGeneratedCVData
): void => {
  const achievements =
    uniqueStrings(
      cv.achievements
        .items
    );

  if (
    achievements.length ===
    0
  ) {
    return;
  }

  drawSectionTitle(
    doc,
    "Core Achievements"
  );

  for (
    const achievement
    of achievements
  ) {
    drawCompactBullet(
      doc,
      achievement
    );
  }

  addVerticalSpace(
    doc,
    2
  );
};

/* =========================================================
   INTERESTS
========================================================= */

const drawInterests = (
  doc:
    PDFKit.PDFDocument,
  cv:
    IGeneratedCVData
): void => {
  const interests =
    uniqueStrings(
      cv.interests
        .items
    );

  if (
    interests.length ===
    0
  ) {
    return;
  }

  drawSectionTitle(
    doc,
    "Interests"
  );

  drawPlainText(
    doc,
    interests.join(
      ", "
    ),
    {
      font:
        FONT_REGULAR,

      fontSize:
        8,

      width:
        CONTENT_WIDTH,

      spacingAfter:
        2,
    }
  );
};

/* =========================================================
   LANGUAGE SANITIZATION
========================================================= */

const cleanLanguageValue = (
  value:
    | string
    | undefined
): string => {
  return cleanText(
    value
  )
    .replace(
      /(?:,?\s*)[\-–—_=]*\b\d+\s+of\s+\d+\b[\-–—_=]*$/i,
      ""
    )
    .replace(
      /(?:,\s*)?-\s*\(\s*-\s*\)\s*$/i,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
};

const isLanguageArtifact = (
  value: string
): boolean => {
  const cleaned =
    cleanText(
      value
    );

  if (!cleaned) {
    return true;
  }

  return /^\d+\s+of\s+\d+$/i.test(
    cleaned
  );
};

/* =========================================================
   LANGUAGES
========================================================= */

const drawLanguages = (
  doc:
    PDFKit.PDFDocument,
  cv:
    IGeneratedCVData
): void => {
  if (
    !cv.languages
      .items.length
  ) {
    return;
  }

  const languages =
    uniqueStrings(
      cv.languages
        .items
        .map(
          (
            item
          ) => {
            const language =
              cleanLanguageValue(
                item.language
              );

            const level =
              cleanLanguageValue(
                item.level
              );

            if (
              !language ||
              isLanguageArtifact(
                language
              )
            ) {
              return "";
            }

            return level
              ? `${language} (${level})`
              : language;
          }
        )
    );

  if (
    languages.length ===
    0
  ) {
    return;
  }

  drawSectionTitle(
    doc,
    "Languages"
  );

  drawPlainText(
    doc,
    languages.join(
      ", "
    ),
    {
      font:
        FONT_REGULAR,

      fontSize:
        7.4,

      width:
        CONTENT_WIDTH,

      spacingAfter:
        1,
    }
  );
};

/* =========================================================
   PDF GENERATOR
========================================================= */

export const generateCVPdf =
  async ({
    cv,
  }: GenerateCVPdfParams): Promise<GeneratedPdfResult> => {
    const candidateName =
      resolveCandidateName(
        cv
      );

    return new Promise<
      GeneratedPdfResult
    >(
      (
        resolve,
        reject
      ) => {
        try {
          const doc =
            new PDFDocument({
              size:
                "A4",

              margins: {
                top:
                  MARGIN_TOP,

                bottom:
                  MARGIN_BOTTOM,

                left:
                  MARGIN_LEFT,

                right:
                  MARGIN_RIGHT,
              },

              info: {
                Title:
                  `${candidateName} CV`,

                Author:
                  candidateName,

                Subject:
                  "CV generated from verified resume data",

                Creator:
                  "InterviewIQ",
              },
            });

          const chunks:
            Buffer[] = [];

          doc.on(
            "data",
            (
              chunk:
                Buffer
            ) => {
              chunks.push(
                chunk
              );
            }
          );

          doc.on(
            "error",
            (
              error
            ) => {
              reject(
                error
              );
            }
          );

          doc.on(
            "end",
            () => {
              resolve({
                buffer:
                  Buffer.concat(
                    chunks
                  ),

                fileName:
                  buildFileName(
                    cv,
                    candidateName
                  ),
              });
            }
          );

          /* =================================================
             DOCUMENT
          ================================================= */

          drawHeader(
            doc,
            cv,
            candidateName
          );

          /*
           * LOSSLESS DOCUMENT ORDER
           *
           * Summary is rendered only when it exists in the
           * verified source profile. No AI-authored section is
           * introduced here.
           */
          drawSummary(
            doc,
            cv
          );

          drawSkills(
            doc,
            cv
          );

          drawAchievements(
            doc,
            cv
          );

          drawExperience(
            doc,
            cv
          );

          drawVolunteering(
            doc,
            cv
          );

          drawProjects(
            doc,
            cv
          );

          drawEducation(
            doc,
            cv
          );

          drawCertifications(
            doc,
            cv
          );

          drawHackathons(
            doc,
            cv
          );

          drawLanguages(
            doc,
            cv
          );

          drawInterests(
            doc,
            cv
          );

          doc.end();
        } catch (
          error
        ) {
          reject(
            error
          );
        }
      }
    );
  };

export default {
  generateCVPdf,
};