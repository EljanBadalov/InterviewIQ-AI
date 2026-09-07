import {
  PDFParse,
} from "pdf-parse";

import {
  getDocument,
} from "pdfjs-dist/legacy/build/pdf.mjs";

/*
 * pdfjs-dist exposes TextItem/TextMarkedContent in its declaration
 * source, but they are not runtime/module exports from
 * "pdfjs-dist/legacy/build/pdf.mjs" in several current versions.
 *
 * Keep the service version-independent by using the minimal structural
 * shapes that getTextContent() actually returns.
 */
interface IPdfJsTextItem {
  str: string;

  transform: number[];

  width: number;

  height: number;

  fontName?: string;

  dir?: string;

  hasEOL?: boolean;
}

type PdfDocumentProxyLike =
  Awaited<
    ReturnType<
      typeof getDocument
    >["promise"]
  >;

/* =========================================================
   TYPES
========================================================= */

export type PdfLayoutType =
  | "single-column"
  | "two-column"
  | "three-column"
  | "mixed";

export interface IPdfTextItem {
  text: string;

  pageNumber: number;

  x: number;

  y: number;

  width: number;

  height: number;

  fontSize: number;
}

export interface IPdfTextLine {
  text: string;

  pageNumber: number;

  x: number;

  y: number;

  width: number;

  height: number;

  columnIndex: number | null;

  crossesColumnBoundary: boolean;
}

export interface IPdfPageLayout {
  pageNumber: number;

  width: number;

  height: number;

  layout:
    PdfLayoutType;

  columnCount: number;

  columnBoundaries: number[];

  items:
    IPdfTextItem[];

  lines:
    IPdfTextLine[];

  text: string;
}

export interface IExtractPdfTextResult {
  /*
   * Backward-compatible field used by the rest of InterviewIQ.
   *
   * IMPORTANT:
   * This is no longer pdf-parse's raw stream order.
   * It is reconstructed in a layout-aware reading order.
   */
  text: string;

  characterCount: number;

  /*
   * Raw text is kept for diagnostics/fallback only.
   */
  rawText: string;

  rawCharacterCount: number;

  layout:
    PdfLayoutType;

  pages:
    IPdfPageLayout[];

  warnings: string[];
}

/* =========================================================
   CONSTANTS
========================================================= */

const MIN_EXTRACTED_TEXT_LENGTH =
  20;

const MAX_SUPPORTED_COLUMNS =
  3;

const MIN_ITEM_TEXT_LENGTH =
  1;

const MIN_COLUMN_GAP_RATIO =
  0.035;

const CENTRAL_GAP_MIN_RATIO =
  0.15;

const CENTRAL_GAP_MAX_RATIO =
  0.85;

const MIN_COLUMN_CONTENT_RATIO =
  0.12;

const FULL_WIDTH_LINE_RATIO =
  0.62;

const COLUMN_BOUNDARY_TOLERANCE =
  8;

const MIN_SPACE_GAP =
  1.75;

const LINE_Y_TOLERANCE_MIN =
  2.2;

const LINE_Y_TOLERANCE_MAX =
  6.5;

/* =========================================================
   GENERIC HELPERS
========================================================= */

const clamp = (
  value: number,
  min: number,
  max: number
): number => {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
};

const roundCoordinate = (
  value: number
): number => {
  return Math.round(
    value * 100
  ) / 100;
};

const normalizeInlineWhitespace = (
  value: string
): string => {
  return value
    .replace(
      /\u0000/g,
      ""
    )
    .replace(
      /\u00a0/g,
      " "
    )
    .replace(
      /[\t\f\v]+/g,
      " "
    )
    .replace(
      / {2,}/g,
      " "
    )
    .trim();
};

const normalizeExtractedText = (
  value: string
): string => {
  return value
    .replace(
      /\r\n/g,
      "\n"
    )
    .replace(
      /\r/g,
      "\n"
    )
    .replace(
      /\u0000/g,
      ""
    )
    .replace(
      /[ \t]+\n/g,
      "\n"
    )
    .replace(
      /\n[ \t]+/g,
      "\n"
    )
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .trim();
};

const isTextItem = (
  item: unknown
): item is IPdfJsTextItem => {
  if (
    typeof item !==
      "object" ||
    item ===
      null
  ) {
    return false;
  }

  const candidate =
    item as {
      str?: unknown;
      transform?: unknown;
      width?: unknown;
      height?: unknown;
    };

  return (
    typeof candidate.str ===
      "string" &&
    Array.isArray(
      candidate.transform
    ) &&
    candidate.transform.length >=
      6 &&
    candidate.transform.every(
      (
        value
      ) =>
        typeof value ===
          "number"
    ) &&
    typeof candidate.width ===
      "number" &&
    typeof candidate.height ===
      "number"
  );
};

const getFontSize = (
  item:
    IPdfJsTextItem
): number => {
  const transform =
    item.transform;

  const a =
    Number(
      transform[0] ??
      0
    );

  const b =
    Number(
      transform[1] ??
      0
    );

  const c =
    Number(
      transform[2] ??
      0
    );

  const d =
    Number(
      transform[3] ??
      0
    );

  const horizontalScale =
    Math.sqrt(
      a * a +
      b * b
    );

  const verticalScale =
    Math.sqrt(
      c * c +
      d * d
    );

  const derived =
    Math.max(
      horizontalScale,
      verticalScale,
      Number(
        item.height ??
        0
      )
    );

  return clamp(
    derived ||
    10,
    4,
    72
  );
};

/* =========================================================
   TEXT ITEM EXTRACTION
========================================================= */

const extractPageItems = async (
  pdf:
    PdfDocumentProxyLike,
  pageNumber: number
): Promise<{
  width: number;
  height: number;
  items: IPdfTextItem[];
}> => {
  const page =
    await pdf.getPage(
      pageNumber
    );

  const viewport =
    page.getViewport({
      scale:
        1,
    });

  const textContent =
    await page.getTextContent({
      includeMarkedContent:
        false,
      disableNormalization:
        false,
    });

  const items:
    IPdfTextItem[] = [];

  for (
    const rawItem
    of textContent.items
  ) {
    if (
      !isTextItem(
        rawItem
      )
    ) {
      continue;
    }

    const text =
      normalizeInlineWhitespace(
        rawItem.str
      );

    if (
      text.length <
      MIN_ITEM_TEXT_LENGTH
    ) {
      continue;
    }

    const transform =
      rawItem.transform;

    const x =
      Number(
        transform[4] ??
        0
      );

    /*
     * PDF coordinates start at the bottom-left.
     * Convert them to top-left style coordinates.
     */
    const baselineY =
      Number(
        transform[5] ??
        0
      );

    const fontSize =
      getFontSize(
        rawItem
      );

    const y =
      viewport.height -
      baselineY -
      fontSize;

    const width =
      Math.max(
        Number(
          rawItem.width ??
          0
        ),
        0
      );

    const height =
      Math.max(
        Number(
          rawItem.height ??
          fontSize
        ),
        fontSize
      );

    items.push({
      text,

      pageNumber,

      x:
        roundCoordinate(
          x
        ),

      y:
        roundCoordinate(
          y
        ),

      width:
        roundCoordinate(
          width
        ),

      height:
        roundCoordinate(
          height
        ),

      fontSize:
        roundCoordinate(
          fontSize
        ),
    });
  }

  return {
    width:
      viewport.width,

    height:
      viewport.height,

    items,
  };
};

/* =========================================================
   LINE CONSTRUCTION
========================================================= */

interface IWorkingLine {
  pageNumber: number;

  items:
    IPdfTextItem[];

  y: number;
}

const getLineYTolerance = (
  item:
    IPdfTextItem
): number => {
  return clamp(
    item.fontSize *
    0.35,
    LINE_Y_TOLERANCE_MIN,
    LINE_Y_TOLERANCE_MAX
  );
};

const appendItemToLine = (
  line:
    IWorkingLine,
  item:
    IPdfTextItem
): void => {
  line.items.push(
    item
  );

  const averageY =
    line.items.reduce(
      (
        total,
        current
      ) =>
        total +
        current.y,
      0
    ) /
    line.items.length;

  line.y =
    averageY;
};

const groupItemsIntoLines = (
  items:
    IPdfTextItem[]
): IWorkingLine[] => {
  const sorted =
    [...items].sort(
      (
        a,
        b
      ) => {
        const yDiff =
          a.y -
          b.y;

        if (
          Math.abs(
            yDiff
          ) >
          1.5
        ) {
          return yDiff;
        }

        return (
          a.x -
          b.x
        );
      }
    );

  const lines:
    IWorkingLine[] = [];

  for (
    const item
    of sorted
  ) {
    let bestLine:
      IWorkingLine |
      null =
        null;

    let bestDistance =
      Number.POSITIVE_INFINITY;

    for (
      let index =
        lines.length - 1;
      index >=
        Math.max(
          0,
          lines.length -
          14
        );
      index -=
        1
    ) {
      const line =
        lines[
          index
        ];

      if (!line) {
        continue;
      }

      const distance =
        Math.abs(
          line.y -
          item.y
        );

      const tolerance =
        Math.max(
          getLineYTolerance(
            item
          ),
          ...line.items.map(
            getLineYTolerance
          )
        );

      if (
        distance <=
          tolerance &&
        distance <
          bestDistance
      ) {
        bestLine =
          line;

        bestDistance =
          distance;
      }

      if (
        line.y <
        item.y -
        tolerance * 2
      ) {
        break;
      }
    }

    if (
      bestLine
    ) {
      appendItemToLine(
        bestLine,
        item
      );
    } else {
      lines.push({
        pageNumber:
          item.pageNumber,

        items: [
          item,
        ],

        y:
          item.y,
      });
    }
  }

  return lines.sort(
    (
      a,
      b
    ) =>
      a.y -
      b.y
  );
};

const joinLineItems = (
  items:
    IPdfTextItem[]
): string => {
  const sorted =
    [...items].sort(
      (
        a,
        b
      ) =>
        a.x -
        b.x
    );

  let result =
    "";

  let previousEnd:
    number |
    null =
      null;

  let previousFontSize =
    10;

  for (
    const item
    of sorted
  ) {
    if (
      previousEnd !==
      null
    ) {
      const gap =
        item.x -
        previousEnd;

      const dynamicSpaceGap =
        Math.max(
          MIN_SPACE_GAP,
          Math.min(
            previousFontSize,
            item.fontSize
          ) *
          0.18
        );

      if (
        gap >
        dynamicSpaceGap
      ) {
        result +=
          " ";
      }
    }

    result +=
      item.text;

    previousEnd =
      Math.max(
        item.x +
        item.width,
        item.x
      );

    previousFontSize =
      item.fontSize;
  }

  return normalizeInlineWhitespace(
    result
  );
};

const convertWorkingLines = (
  workingLines:
    IWorkingLine[]
): IPdfTextLine[] => {
  return workingLines
    .map(
      (
        line
      ) => {
        const sortedItems =
          [...line.items].sort(
            (
              a,
              b
            ) =>
              a.x -
              b.x
          );

        const first =
          sortedItems[0];

        const x =
          first
            ?.x ??
          0;

        const xEnd =
          sortedItems.reduce(
            (
              max,
              item
            ) =>
              Math.max(
                max,
                item.x +
                item.width
              ),
            x
          );

        const height =
          sortedItems.reduce(
            (
              max,
              item
            ) =>
              Math.max(
                max,
                item.height
              ),
            0
          );

        return {
          text:
            joinLineItems(
              sortedItems
            ),

          pageNumber:
            line.pageNumber,

          x:
            roundCoordinate(
              x
            ),

          y:
            roundCoordinate(
              line.y
            ),

          width:
            roundCoordinate(
              Math.max(
                0,
                xEnd -
                x
              )
            ),

          height:
            roundCoordinate(
              height
            ),

          columnIndex:
            null,

          crossesColumnBoundary:
            false,
        };
      }
    )
    .filter(
      (
        line
      ) =>
        Boolean(
          line.text
        )
    );
};

/* =========================================================
   COLUMN DETECTION
========================================================= */

interface IColumnGap {
  start: number;

  end: number;

  center: number;

  width: number;

  density: number;
}

const buildHorizontalOccupancy = (
  items:
    IPdfTextItem[],
  pageWidth: number
): number[] => {
  const binCount =
    clamp(
      Math.round(
        pageWidth /
        8
      ),
      60,
      160
    );

  const occupancy =
    Array.from(
      {
        length:
          binCount,
      },
      () =>
        0
    );

  for (
    const item
    of items
  ) {
    if (
      !item.text
    ) {
      continue;
    }

    const startRatio =
      clamp(
        item.x /
        pageWidth,
        0,
        1
      );

    const endRatio =
      clamp(
        (
          item.x +
          Math.max(
            item.width,
            2
          )
        ) /
        pageWidth,
        0,
        1
      );

    const startBin =
      clamp(
        Math.floor(
          startRatio *
          binCount
        ),
        0,
        binCount -
        1
      );

    const endBin =
      clamp(
        Math.ceil(
          endRatio *
          binCount
        ),
        0,
        binCount -
        1
      );

    for (
      let bin =
        startBin;
      bin <=
        endBin;
      bin +=
        1
    ) {
      occupancy[
        bin
      ] +=
        1;
    }
  }

  return occupancy;
};

const findColumnGaps = (
  items:
    IPdfTextItem[],
  pageWidth: number
): IColumnGap[] => {
  const occupancy =
    buildHorizontalOccupancy(
      items,
      pageWidth
    );

  if (
    occupancy.length ===
    0
  ) {
    return [];
  }

  const maxDensity =
    Math.max(
      ...occupancy,
      1
    );

  const threshold =
    Math.max(
      1,
      maxDensity *
      0.08
    );

  const gaps:
    IColumnGap[] = [];

  let currentStart:
    number |
    null =
      null;

  const flushGap = (
    endBin: number
  ): void => {
    if (
      currentStart ===
      null
    ) {
      return;
    }

    const binCount =
      occupancy.length;

    const startRatio =
      currentStart /
      binCount;

    const endRatio =
      endBin /
      binCount;

    const centerRatio =
      (
        startRatio +
        endRatio
      ) /
      2;

    const widthRatio =
      endRatio -
      startRatio;

    if (
      centerRatio >=
        CENTRAL_GAP_MIN_RATIO &&
      centerRatio <=
        CENTRAL_GAP_MAX_RATIO &&
      widthRatio >=
        MIN_COLUMN_GAP_RATIO
    ) {
      const slice =
        occupancy.slice(
          currentStart,
          Math.max(
            currentStart +
            1,
            endBin
          )
        );

      const averageDensity =
        slice.length >
          0
          ? slice.reduce(
              (
                total,
                value
              ) =>
                total +
                value,
              0
            ) /
            slice.length
          : 0;

      gaps.push({
        start:
          startRatio *
          pageWidth,

        end:
          endRatio *
          pageWidth,

        center:
          centerRatio *
          pageWidth,

        width:
          widthRatio *
          pageWidth,

        density:
          averageDensity /
          maxDensity,
      });
    }

    currentStart =
      null;
  };

  for (
    let index = 0;
    index <
    occupancy.length;
    index +=
      1
  ) {
    const value =
      occupancy[
        index
      ] ??
      0;

    if (
      value <=
      threshold
    ) {
      if (
        currentStart ===
        null
      ) {
        currentStart =
          index;
      }
    } else {
      flushGap(
        index
      );
    }
  }

  flushGap(
    occupancy.length
  );

  return gaps.sort(
    (
      a,
      b
    ) => {
      const scoreA =
        a.width *
        (
          1 -
          a.density
        );

      const scoreB =
        b.width *
        (
          1 -
          b.density
        );

      return (
        scoreB -
        scoreA
      );
    }
  );
};

const countItemsOnSide = (
  items:
    IPdfTextItem[],
  startX: number,
  endX: number
): number => {
  return items.filter(
    (
      item
    ) => {
      const center =
        item.x +
        item.width /
        2;

      return (
        center >=
          startX &&
        center <
          endX
      );
    }
  ).length;
};


const detectColumnBoundariesByXClusters = (
  items:
    IPdfTextItem[],
  pageWidth: number
): number[] => {
  /*
   * Fallback for Canva/sidebar resumes.
   *
   * Occupancy-based gap detection can miss a real column split when
   * long text items visually span most of the page width. In that case
   * the LEFT EDGE positions of text items still form strong clusters.
   *
   * Example:
   *   sidebar items start around x=30..80
   *   main column items start around x=220..280
   *
   * We detect the largest stable gaps between these X-start clusters.
   */
  const candidateItems =
    items.filter(
      (
        item
      ) =>
        item.text.length >=
          1 &&
        item.width /
          pageWidth <
          0.72
    );

  if (
    candidateItems.length <
    12
  ) {
    return [];
  }

  const xValues =
    candidateItems
      .map(
        (
          item
        ) =>
          item.x
      )
      .filter(
        (
          value
        ) =>
          value >=
            pageWidth *
            0.02 &&
          value <=
            pageWidth *
            0.95
      )
      .sort(
        (
          a,
          b
        ) =>
          a -
          b
      );

  if (
    xValues.length <
    12
  ) {
    return [];
  }

  interface IXGap {
    left:
      number;

    right:
      number;

    center:
      number;

    width:
      number;

    leftCount:
      number;

    rightCount:
      number;

    score:
      number;
  }

  const gaps:
    IXGap[] = [];

  for (
    let index =
      0;
    index <
      xValues.length -
      1;
    index +=
      1
  ) {
    const left =
      xValues[
        index
      ] ??
      0;

    const right =
      xValues[
        index +
        1
      ] ??
      left;

    const width =
      right -
      left;

    const center =
      (
        left +
        right
      ) /
      2;

    if (
      width <
        pageWidth *
        0.055
    ) {
      continue;
    }

    if (
      center <
        pageWidth *
        0.16 ||
      center >
        pageWidth *
        0.86
    ) {
      continue;
    }

    const leftCount =
      xValues.filter(
        (
          value
        ) =>
          value <
          center
      ).length;

    const rightCount =
      xValues.length -
      leftCount;

    const leftRatio =
      leftCount /
      xValues.length;

    const rightRatio =
      rightCount /
      xValues.length;

    if (
      leftRatio <
        0.16 ||
      rightRatio <
        0.16
    ) {
      continue;
    }

    /*
     * Favor wide gaps with meaningful content on both sides.
     */
    const balance =
      Math.min(
        leftRatio,
        rightRatio
      );

    const score =
      width *
      (
        0.65 +
        balance
      );

    gaps.push({
      left,

      right,

      center,

      width,

      leftCount,

      rightCount,

      score,
    });
  }

  if (
    gaps.length ===
    0
  ) {
    return [];
  }

  gaps.sort(
    (
      a,
      b
    ) =>
      b.score -
      a.score
  );

  const selected:
    number[] = [];

  for (
    const gap
    of gaps
  ) {
    if (
      selected.length >=
      MAX_SUPPORTED_COLUMNS -
      1
    ) {
      break;
    }

    const tooClose =
      selected.some(
        (
          boundary
        ) =>
          Math.abs(
            boundary -
            gap.center
          ) <
          pageWidth *
          0.12
      );

    if (
      tooClose
    ) {
      continue;
    }

    selected.push(
      gap.center
    );
  }

  return selected.sort(
    (
      a,
      b
    ) =>
      a -
      b
  );
};

const selectColumnBoundaries = (
  items:
    IPdfTextItem[],
  pageWidth: number
): number[] => {
  const gaps =
    findColumnGaps(
      items,
      pageWidth
    );

  const totalItems =
    Math.max(
      items.length,
      1
    );

  const occupancySelected:
    number[] = [];

  for (
    const gap
    of gaps
  ) {
    if (
      occupancySelected.length >=
      MAX_SUPPORTED_COLUMNS -
      1
    ) {
      break;
    }

    const candidate =
      gap.center;

    const proposed =
      [
        ...occupancySelected,
        candidate,
      ].sort(
        (
          a,
          b
        ) =>
          a -
          b
      );

    const bounds = [
      0,
      ...proposed,
      pageWidth,
    ];

    const valid =
      bounds
        .slice(
          0,
          -1
        )
        .every(
          (
            start,
            index
          ) => {
            const end =
              bounds[
                index +
                1
              ] ??
              pageWidth;

            const count =
              countItemsOnSide(
                items,
                start,
                end
              );

            return (
              count /
              totalItems >=
              MIN_COLUMN_CONTENT_RATIO
            );
          }
        );

    if (
      valid
    ) {
      occupancySelected.push(
        candidate
      );

      occupancySelected.sort(
        (
          a,
          b
        ) =>
          a -
          b
      );
    }
  }

  const clusterSelected =
    detectColumnBoundariesByXClusters(
      items,
      pageWidth
    );

  /*
   * Prefer the occupancy result when it found a plausible split.
   * Otherwise use the X-cluster fallback.
   *
   * If both found a single boundary but disagree heavily, prefer
   * X-clustering for sidebar/Canva layouts because it is based on
   * actual text-column start positions and is less affected by long
   * lines spanning across a page.
   */
  if (
    occupancySelected.length ===
      0
  ) {
    return clusterSelected;
  }

  if (
    occupancySelected.length ===
      1 &&
    clusterSelected.length ===
      1
  ) {
    const difference =
      Math.abs(
        occupancySelected[0]! -
        clusterSelected[0]!
      );

    if (
      difference >
      pageWidth *
        0.10
    ) {
      return clusterSelected;
    }
  }

  return occupancySelected;
};

/* =========================================================
   LINE / COLUMN ASSIGNMENT
========================================================= */

const getColumnIndexForLine = (
  line:
    IPdfTextLine,
  boundaries:
    number[],
  pageWidth: number
): {
  columnIndex: number | null;
  crossesBoundary: boolean;
} => {
  if (
    boundaries.length ===
    0
  ) {
    return {
      columnIndex:
        0,

      crossesBoundary:
        false,
    };
  }

  const lineStart =
    line.x;

  const lineEnd =
    line.x +
    line.width;

  const crosses =
    boundaries.some(
      (
        boundary
      ) =>
        lineStart <
          boundary -
          COLUMN_BOUNDARY_TOLERANCE &&
        lineEnd >
          boundary +
          COLUMN_BOUNDARY_TOLERANCE
    );

  if (
    crosses ||
    line.width /
      pageWidth >=
      FULL_WIDTH_LINE_RATIO
  ) {
    return {
      columnIndex:
        null,

      crossesBoundary:
        true,
    };
  }

  const center =
    lineStart +
    line.width /
    2;

  let columnIndex =
    0;

  for (
    const boundary
    of boundaries
  ) {
    if (
      center >
      boundary
    ) {
      columnIndex +=
        1;
    }
  }

  return {
    columnIndex,

    crossesBoundary:
      false,
  };
};

const assignLinesToColumns = (
  lines:
    IPdfTextLine[],
  boundaries:
    number[],
  pageWidth: number
): IPdfTextLine[] => {
  return lines.map(
    (
      line
    ) => {
      const assignment =
        getColumnIndexForLine(
          line,
          boundaries,
          pageWidth
        );

      return {
        ...line,

        columnIndex:
          assignment.columnIndex,

        crossesColumnBoundary:
          assignment.crossesBoundary,
      };
    }
  );
};

/* =========================================================
   COLUMN-AWARE LINE CONSTRUCTION

   IMPORTANT:
   We must detect columns BEFORE grouping text items into lines.

   If we group by Y first, text from a left sidebar and right main
   column that happens to share the same vertical position becomes
   one fake line, for example:

     "LOGISTIC AND SOFTWARE ENGINEER" + "WORK EXPERIENCE"

   That was the remaining Canva bug.
========================================================= */

const itemCrossesColumnBoundary = (
  item:
    IPdfTextItem,
  boundaries:
    number[]
): boolean => {
  const start =
    item.x;

  const end =
    item.x +
    item.width;

  return boundaries.some(
    (
      boundary
    ) =>
      start <
        boundary -
        COLUMN_BOUNDARY_TOLERANCE &&
      end >
        boundary +
        COLUMN_BOUNDARY_TOLERANCE
  );
};

const getColumnIndexForItem = (
  item:
    IPdfTextItem,
  boundaries:
    number[]
): number => {
  const center =
    item.x +
    item.width /
    2;

  let columnIndex =
    0;

  for (
    const boundary
    of boundaries
  ) {
    if (
      center >
      boundary
    ) {
      columnIndex +=
        1;
    }
  }

  return columnIndex;
};

const buildColumnAwareLines = (
  items:
    IPdfTextItem[],
  boundaries:
    number[],
  pageWidth: number
): IPdfTextLine[] => {
  if (
    boundaries.length ===
    0
  ) {
    return convertWorkingLines(
      groupItemsIntoLines(
        items
      )
    ).map(
      (
        line
      ) => ({
        ...line,

        columnIndex:
          0,

        crossesColumnBoundary:
          false,
      })
    );
  }

  const columnCount =
    boundaries.length +
    1;

  const columnItems:
    IPdfTextItem[][] =
      Array.from(
        {
          length:
            columnCount,
        },
        () =>
          []
      );

  const fullWidthItems:
    IPdfTextItem[] = [];

  for (
    const item
    of items
  ) {
    const crosses =
      itemCrossesColumnBoundary(
        item,
        boundaries
      );

    const wide =
      item.width /
      pageWidth >=
        0.72;

    /*
     * A genuinely wide/cross-boundary item is kept separate.
     * Everything else is assigned to exactly one column BEFORE
     * line grouping, so unrelated columns can never merge.
     */
    if (
      crosses ||
      wide
    ) {
      fullWidthItems.push(
        item
      );

      continue;
    }

    const columnIndex =
      clamp(
        getColumnIndexForItem(
          item,
          boundaries
        ),
        0,
        columnCount -
        1
      );

    columnItems[
      columnIndex
    ]?.push(
      item
    );
  }

  const lines:
    IPdfTextLine[] = [];

  for (
    let columnIndex =
      0;
    columnIndex <
      columnCount;
    columnIndex +=
      1
  ) {
    const itemsForColumn =
      columnItems[
        columnIndex
      ] ||
      [];

    if (
      itemsForColumn.length ===
      0
    ) {
      continue;
    }

    const columnLines =
      convertWorkingLines(
        groupItemsIntoLines(
          itemsForColumn
        )
      ).map(
        (
          line
        ) => ({
          ...line,

          columnIndex,

          crossesColumnBoundary:
            false,
        })
      );

    lines.push(
      ...columnLines
    );
  }

  if (
    fullWidthItems.length >
    0
  ) {
    const fullWidthLines =
      convertWorkingLines(
        groupItemsIntoLines(
          fullWidthItems
        )
      ).map(
        (
          line
        ) => ({
          ...line,

          columnIndex:
            null,

          crossesColumnBoundary:
            true,
        })
      );

    lines.push(
      ...fullWidthLines
    );
  }

  return lines.sort(
    (
      a,
      b
    ) => {
      const yDiff =
        a.y -
        b.y;

      if (
        Math.abs(
          yDiff
        ) >
        1.5
      ) {
        return yDiff;
      }

      return (
        a.x -
        b.x
      );
    }
  );
};


/* =========================================================
   READING ORDER RECONSTRUCTION
========================================================= */

const joinLines = (
  lines:
    IPdfTextLine[]
): string => {
  return lines
    .map(
      (
        line
      ) =>
        line.text
    )
    .filter(
      Boolean
    )
    .join(
      "\n"
    );
};

const reconstructColumnBand = (
  lines:
    IPdfTextLine[],
  columnCount: number
): string[] => {
  const output:
    string[] = [];

  for (
    let columnIndex =
      0;
    columnIndex <
      columnCount;
    columnIndex +=
      1
  ) {
    const columnLines =
      lines
        .filter(
          (
            line
          ) =>
            line.columnIndex ===
            columnIndex
        )
        .sort(
          (
            a,
            b
          ) => {
            const yDiff =
              a.y -
              b.y;

            if (
              Math.abs(
                yDiff
              ) >
              1.5
            ) {
              return yDiff;
            }

            return (
              a.x -
              b.x
            );
          }
        );

    if (
      columnLines.length >
      0
    ) {
      output.push(
        joinLines(
          columnLines
        )
      );
    }
  }

  /*
   * Any line not confidently assigned to a column is preserved
   * rather than discarded.
   */
  const unassigned =
    lines
      .filter(
        (
          line
        ) =>
          line.columnIndex ===
          null
      )
      .sort(
        (
          a,
          b
        ) =>
          a.y -
          b.y
      );

  if (
    unassigned.length >
    0
  ) {
    output.push(
      joinLines(
        unassigned
      )
    );
  }

  return output;
};

const reconstructPageText = (
  lines:
    IPdfTextLine[],
  columnCount: number,
  pageWidth: number
): string => {
  const sorted =
    [...lines].sort(
      (
        a,
        b
      ) => {
        const yDiff =
          a.y -
          b.y;

        if (
          Math.abs(
            yDiff
          ) >
          1.5
        ) {
          return yDiff;
        }

        return (
          a.x -
          b.x
        );
      }
    );

  if (
    columnCount <=
    1
  ) {
    return joinLines(
      sorted
    );
  }

  /*
   * IMPORTANT:
   *
   * Multi-column resumes must NOT be reconstructed row-by-row.
   *
   * Canva and similar resume templates often contain:
   *
   *   LEFT COLUMN              RIGHT COLUMN
   *   CONTACT                  ABOUT ME
   *   SKILLS                   WORK EXPERIENCE
   *   LANGUAGES                EDUCATION
   *
   * Reading by Y position mixes unrelated sections:
   *
   *   CONTACT ABOUT ME
   *   LANGUAGE EDUCATION
   *
   * which later makes deterministic resume parsing impossible.
   *
   * We therefore read each detected column independently from
   * top to bottom. Full-width header/footer lines are preserved
   * separately.
   */

  const assigned =
    sorted.filter(
      (
        line
      ) =>
        line.columnIndex !==
        null &&
        !line.crossesColumnBoundary
    );

  if (
    assigned.length ===
    0
  ) {
    return joinLines(
      sorted
    );
  }

  const minAssignedY =
    Math.min(
      ...assigned.map(
        (
          line
        ) =>
          line.y
      )
    );

  const maxAssignedY =
    Math.max(
      ...assigned.map(
        (
          line
        ) =>
          line.y +
          line.height
      )
    );

  const unassigned =
    sorted.filter(
      (
        line
      ) =>
        line.columnIndex ===
          null ||
        line.crossesColumnBoundary
    );

  const topFullWidth =
    unassigned.filter(
      (
        line
      ) =>
        line.y <
        minAssignedY -
        3
    );

  const bottomFullWidth =
    unassigned.filter(
      (
        line
      ) =>
        line.y >
        maxAssignedY +
        3
    );

  const middleUnassigned =
    unassigned.filter(
      (
        line
      ) =>
        !topFullWidth.includes(
          line
        ) &&
        !bottomFullWidth.includes(
          line
        )
    );

  /*
   * Some PDF generators mark a long line as crossing a boundary even
   * though visually it belongs to one column. Recover those lines by
   * assigning them to the column containing their starting X position.
   *
   * Only genuinely page-wide lines stay unassigned.
   */
  const recoveredColumnLines:
    IPdfTextLine[] = [
      ...assigned,
    ];

  const trueMiddleFullWidth:
    IPdfTextLine[] = [];

  for (
    const line
    of middleUnassigned
  ) {
    const isTrulyPageWide =
      line.width /
      pageWidth >=
        0.78 &&
      line.x <=
        pageWidth *
        0.12;

    if (
      isTrulyPageWide
    ) {
      trueMiddleFullWidth.push(
        line
      );

      continue;
    }

    const center =
      line.x +
      Math.min(
        line.width,
        pageWidth *
        0.35
      ) /
      2;

    const detectedBoundaries =
      sorted
        .filter(
          (
            candidate
          ) =>
            candidate.columnIndex !==
            null
        )
        .reduce<number[]>(
          (
            boundaries,
            candidate
          ) => {
            if (
              candidate.columnIndex ===
                null ||
              candidate.columnIndex <=
                0
            ) {
              return boundaries;
            }

            /*
             * Approximate a boundary from the first X coordinate of a
             * higher-index column. Exact boundaries are not required
             * here; this is only a recovery path for ambiguous lines.
             */
            boundaries.push(
              candidate.x
            );

            return boundaries;
          },
          []
        )
        .sort(
          (
            a,
            b
          ) =>
            a -
            b
        );

    let recoveredColumnIndex =
      0;

    for (
      const boundary
      of detectedBoundaries
    ) {
      if (
        center >=
        boundary
      ) {
        recoveredColumnIndex +=
          1;
      }
    }

    recoveredColumnIndex =
      clamp(
        recoveredColumnIndex,
        0,
        columnCount -
        1
      );

    recoveredColumnLines.push({
      ...line,

      columnIndex:
        recoveredColumnIndex,

      crossesColumnBoundary:
        false,
    });
  }

  const output:
    string[] = [];

  if (
    topFullWidth.length >
    0
  ) {
    output.push(
      joinLines(
        topFullWidth
      )
    );
  }

  for (
    let columnIndex =
      0;
    columnIndex <
      columnCount;
    columnIndex +=
      1
  ) {
    const columnLines =
      recoveredColumnLines
        .filter(
          (
            line
          ) =>
            line.columnIndex ===
            columnIndex
        )
        .sort(
          (
            a,
            b
          ) => {
            const yDiff =
              a.y -
              b.y;

            if (
              Math.abs(
                yDiff
              ) >
              1.5
            ) {
              return yDiff;
            }

            return (
              a.x -
              b.x
            );
          }
        );

    if (
      columnLines.length >
      0
    ) {
      output.push(
        joinLines(
          columnLines
        )
      );
    }
  }

  /*
   * Preserve genuinely full-width middle content rather than deleting
   * it. It is appended after the column bodies so it cannot splice two
   * unrelated columns together.
   */
  if (
    trueMiddleFullWidth.length >
    0
  ) {
    output.push(
      joinLines(
        trueMiddleFullWidth
      )
    );
  }

  if (
    bottomFullWidth.length >
    0
  ) {
    output.push(
      joinLines(
        bottomFullWidth
      )
    );
  }

  return normalizeExtractedText(
    output
      .filter(
        Boolean
      )
      .join(
        "\n"
      )
  );
};

/* =========================================================
   LAYOUT CLASSIFICATION
========================================================= */

const classifyLayout = (
  pageColumnCounts:
    number[]
): PdfLayoutType => {
  const counts =
    pageColumnCounts.filter(
      (
        value
      ) =>
        value >
        0
    );

  if (
    counts.length ===
    0
  ) {
    return "single-column";
  }

  const unique =
    [...new Set(
      counts
    )];

  if (
    unique.length >
    1
  ) {
    return "mixed";
  }

  switch (
    unique[0]
  ) {
    case 2:
      return "two-column";

    case 3:
      return "three-column";

    default:
      return "single-column";
  }
};

/* =========================================================
   RAW TEXT FALLBACK
========================================================= */

const extractRawTextWithPdfParse =
  async (
    buffer:
      Buffer
  ): Promise<string> => {
    const parser =
      new PDFParse({
        data:
          buffer,
      });

    try {
      const pdfData =
        await parser.getText();

      return normalizeExtractedText(
        pdfData.text ??
        ""
      );
    } finally {
      await parser
        .destroy()
        .catch(
          () => {
            /* cleanup failure is non-fatal */
          }
        );
    }
  };

/* =========================================================
   LAYOUT-AWARE EXTRACTION
========================================================= */

const extractLayoutAwareText =
  async (
    buffer:
      Buffer
  ): Promise<{
    text: string;
    pages: IPdfPageLayout[];
    layout: PdfLayoutType;
  }> => {
    const loadingTask =
      getDocument({
        data:
          new Uint8Array(
            buffer
          ),

        useSystemFonts:
          true,

        isEvalSupported:
          false,
      });

    const pdf =
      await loadingTask.promise;

    try {
      const pages:
        IPdfPageLayout[] = [];

      for (
        let pageNumber =
          1;
        pageNumber <=
          pdf.numPages;
        pageNumber +=
          1
      ) {
        const {
          width,
          height,
          items,
        } =
          await extractPageItems(
            pdf,
            pageNumber
          );

        /*
         * Detect columns from RAW text items first.
         *
         * Do not group items into lines before this step. Grouping by Y
         * across the whole page is exactly what merged Canva's sidebar
         * headings with the main-column headings.
         */
        const boundaries =
          selectColumnBoundaries(
            items,
            width
          );

        const columnCount =
          boundaries.length +
          1;

        const lines =
          buildColumnAwareLines(
            items,
            boundaries,
            width
          );

        const pageText =
          normalizeExtractedText(
            reconstructPageText(
              lines,
              columnCount,
              width
            )
          );

        console.log(
          "[PDF Text] Page layout",
          {
            pageNumber,

            detectedColumns:
              columnCount,

            boundaries:
              boundaries.map(
                roundCoordinate
              ),

            itemCount:
              items.length,

            lineCount:
              lines.length,
          }
        );

        pages.push({
          pageNumber,

          width:
            roundCoordinate(
              width
            ),

          height:
            roundCoordinate(
              height
            ),

          layout:
            classifyLayout([
              columnCount,
            ]),

          columnCount,

          columnBoundaries:
            boundaries.map(
              roundCoordinate
            ),

          items,

          lines,

          text:
            pageText,
        });
      }

      const text =
        normalizeExtractedText(
          pages
            .map(
              (
                page
              ) =>
                page.text
            )
            .filter(
              Boolean
            )
            .join(
              "\n\n"
            )
        );

      return {
        text,

        pages,

        layout:
          classifyLayout(
            pages.map(
              (
                page
              ) =>
                page.columnCount
            )
          ),
      };
    } finally {
      await pdf
        .destroy()
        .catch(
          () => {
            /* cleanup failure is non-fatal */
          }
        );

      await loadingTask
        .destroy()
        .catch(
          () => {
            /* cleanup failure is non-fatal */
          }
        );
    }
  };

/* =========================================================
   EXTRACT PDF TEXT
========================================================= */

export const extractPdfText =
  async (
    buffer:
      Buffer
  ): Promise<IExtractPdfTextResult> => {
    if (
      !Buffer.isBuffer(
        buffer
      ) ||
      buffer.length ===
        0
    ) {
      throw new Error(
        "A valid PDF buffer is required."
      );
    }

    const warnings:
      string[] = [];

    let rawText =
      "";

    try {
      rawText =
        await extractRawTextWithPdfParse(
          buffer
        );
    } catch (
      error
    ) {
      warnings.push(
        `Raw pdf-parse extraction failed: ${
          error instanceof Error
            ? error.message
            : String(
                error
              )
        }`
      );
    }

    try {
      const layoutResult =
        await extractLayoutAwareText(
          buffer
        );

      const text =
        normalizeExtractedText(
          layoutResult.text
        );

      if (
        text.length <
        MIN_EXTRACTED_TEXT_LENGTH
      ) {
        throw new Error(
          "Layout-aware PDF extraction did not produce enough readable text."
        );
      }

      console.log(
        "[PDF Text] Layout-aware extraction COMPLETE",
        {
          layout:
            layoutResult
              .layout,

          pages:
            layoutResult
              .pages
              .length,

          columns:
            layoutResult
              .pages
              .map(
                (
                  page
                ) =>
                  page
                    .columnCount
              ),

          boundaries:
            layoutResult
              .pages
              .map(
                (
                  page
                ) =>
                  page
                    .columnBoundaries
              ),

          characterCount:
            text.length,

          rawCharacterCount:
            rawText.length,

          warningCount:
            warnings.length,
        }
      );

      return {
        text,

        characterCount:
          text.length,

        rawText,

        rawCharacterCount:
          rawText.length,

        layout:
          layoutResult
            .layout,

        pages:
          layoutResult
            .pages,

        warnings,
      };
    } catch (
      layoutError
    ) {
      warnings.push(
        `Layout-aware extraction failed: ${
          layoutError instanceof Error
            ? layoutError.message
            : String(
                layoutError
              )
        }`
      );

      /*
       * Backward-compatible fallback.
       *
       * If PDF.js layout analysis fails on a malformed PDF,
       * InterviewIQ can still continue with pdf-parse raw text.
       */
      if (
        rawText.length >=
        MIN_EXTRACTED_TEXT_LENGTH
      ) {
        console.warn(
          "[PDF Text] Falling back to raw pdf-parse text",
          {
            characterCount:
              rawText.length,

            warnings,
          }
        );

        return {
          text:
            rawText,

          characterCount:
            rawText.length,

          rawText,

          rawCharacterCount:
            rawText.length,

          layout:
            "single-column",

          pages:
            [],

          warnings,
        };
      }

      throw new Error(
        [
          "The PDF does not contain enough readable text for resume analysis.",
          ...warnings,
        ].join(
          " "
        )
      );
    }
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  extractPdfText,
};
