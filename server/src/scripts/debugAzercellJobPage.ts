/**
 * Azercell SuccessFactors job page debug utility.
 *
 * PURPOSE:
 * - inspect redirect behavior
 * - inspect the first HTTP response without auto-following redirects
 * - optionally follow redirect manually for comparison
 * - inspect title/meta/H1
 * - inspect JSON-LD / JobPosting
 * - inspect SuccessFactors/job markers
 * - inspect visible page text
 *
 * IMPORTANT:
 * This is a DEBUG script only.
 * It is NOT the production job parser.
 *
 * Run:
 * npx tsx src/scripts/debugAzercellJobPage.ts
 */

const JOB_URL =
  "https://careers.azercell.com/job/Baku-Backend-Developer-%28ITHybrid%29/1369567757/";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/152.0.0.0 Safari/537.36";

/* =========================================================
   HELPERS
========================================================= */

const decodeHtmlEntities = (
  value: string
): string => {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const parsed =
        Number.parseInt(code, 10);

      if (
        Number.isNaN(parsed)
      ) {
        return _;
      }

      return String.fromCharCode(
        parsed
      );
    })
    .trim();
};

const stripHtml = (
  html: string
): string => {
  return decodeHtmlEntities(
    html
      .replace(
        /<script[\s\S]*?<\/script>/gi,
        " "
      )
      .replace(
        /<style[\s\S]*?<\/style>/gi,
        " "
      )
      .replace(
        /<noscript[\s\S]*?<\/noscript>/gi,
        " "
      )
      .replace(
        /<[^>]+>/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
  );
};

const cleanExtractedText = (
  value: string
): string => {
  return decodeHtmlEntities(
    value
      .replace(
        /<[^>]+>/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim()
  );
};

const extractFirstMatch = (
  html: string,
  regex: RegExp
): string | null => {
  const match =
    html.match(regex);

  const value =
    match?.[1];

  if (!value) {
    return null;
  }

  return cleanExtractedText(
    value
  );
};

const extractMetaContent = (
  html: string,
  attributeName:
    | "name"
    | "property",
  attributeValue: string
): string | null => {
  const patterns = [
    new RegExp(
      `<meta[^>]*${attributeName}=["']${attributeValue}["'][^>]*content=["']([^"']*)["'][^>]*>`,
      "i"
    ),

    new RegExp(
      `<meta[^>]*content=["']([^"']*)["'][^>]*${attributeName}=["']${attributeValue}["'][^>]*>`,
      "i"
    ),
  ];

  for (
    const pattern of patterns
  ) {
    const result =
      extractFirstMatch(
        html,
        pattern
      );

    if (result) {
      return result;
    }
  }

  return null;
};

const extractJsonLdBlocks = (
  html: string
): string[] => {
  const blocks: string[] =
    [];

  const regex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match:
    | RegExpExecArray
    | null;

  while (
    (match =
      regex.exec(html)) !== null
  ) {
    const block =
      match[1]?.trim();

    if (block) {
      blocks.push(
        block
      );
    }
  }

  return blocks;
};

const findJobPostingObjects = (
  value: unknown
): Record<
  string,
  unknown
>[] => {
  const results: Record<
    string,
    unknown
  >[] = [];

  const visited =
    new Set<unknown>();

  const visit = (
    current: unknown
  ): void => {
    if (
      !current ||
      visited.has(current)
    ) {
      return;
    }

    if (
      Array.isArray(current)
    ) {
      visited.add(current);

      for (
        const item of current
      ) {
        visit(item);
      }

      return;
    }

    if (
      typeof current !==
      "object"
    ) {
      return;
    }

    visited.add(current);

    const object =
      current as Record<
        string,
        unknown
      >;

    const type =
      object["@type"];

    const isJobPosting =
      type === "JobPosting" ||
      (
        Array.isArray(type) &&
        type.some(
          (item) =>
            item ===
            "JobPosting"
        )
      );

    if (isJobPosting) {
      results.push(
        object
      );
    }

    for (
      const child of Object.values(
        object
      )
    ) {
      visit(child);
    }
  };

  visit(value);

  return results;
};

const getResponseSummary = (
  response: Response
): Record<
  string,
  unknown
> => {
  return {
    status:
      response.status,

    statusText:
      response.statusText,

    ok:
      response.ok,

    responseUrl:
      response.url,

    redirected:
      response.redirected,

    location:
      response.headers.get(
        "location"
      ),

    contentType:
      response.headers.get(
        "content-type"
      ),

    contentLength:
      response.headers.get(
        "content-length"
      ),

    server:
      response.headers.get(
        "server"
      ),

    cacheControl:
      response.headers.get(
        "cache-control"
      ),
  };
};

const printDivider = (
  title: string
): void => {
  console.log(
    `\n--- ${title} ---`
  );
};

const inspectHtml = (
  html: string,
  label: string
): void => {
  printDivider(
    `${label} BASIC TITLE SIGNALS`
  );

  const htmlTitle =
    extractFirstMatch(
      html,
      /<title[^>]*>([\s\S]*?)<\/title>/i
    );

  const ogTitle =
    extractMetaContent(
      html,
      "property",
      "og:title"
    );

  const twitterTitle =
    extractMetaContent(
      html,
      "name",
      "twitter:title"
    );

  const metaDescription =
    extractMetaContent(
      html,
      "name",
      "description"
    );

  const ogDescription =
    extractMetaContent(
      html,
      "property",
      "og:description"
    );

  const h1 =
    extractFirstMatch(
      html,
      /<h1[^>]*>([\s\S]*?)<\/h1>/i
    );

  console.log({
    htmlTitle,
    ogTitle,
    twitterTitle,
    metaDescription,
    ogDescription,
    h1,
  });

  printDivider(
    `${label} JSON-LD`
  );

  const jsonLdBlocks =
    extractJsonLdBlocks(
      html
    );

  console.log(
    `JSON-LD blocks found: ${jsonLdBlocks.length}`
  );

  const jobPostings: Record<
    string,
    unknown
  >[] = [];

  jsonLdBlocks.forEach(
    (
      block,
      index
    ) => {
      console.log(
        `\nJSON-LD BLOCK #${index + 1}`
      );

      console.log(
        block.slice(
          0,
          5000
        )
      );

      try {
        const parsed =
          JSON.parse(
            block
          );

        const found =
          findJobPostingObjects(
            parsed
          );

        jobPostings.push(
          ...found
        );
      } catch (
        error
      ) {
        console.log(
          "JSON parse failed:",
          error instanceof Error
            ? error.message
            : error
        );
      }
    }
  );

  printDivider(
    `${label} JOBPOSTING OBJECTS`
  );

  console.log(
    `JobPosting objects found: ${jobPostings.length}`
  );

  jobPostings.forEach(
    (
      job,
      index
    ) => {
      console.log(
        `\nJOBPOSTING #${index + 1}`
      );

      console.dir(
        {
          title:
            job.title,

          description:
            typeof job.description ===
            "string"
              ? stripHtml(
                  job.description
                ).slice(
                  0,
                  2000
                )
              : job.description,

          datePosted:
            job.datePosted,

          validThrough:
            job.validThrough,

          employmentType:
            job.employmentType,

          hiringOrganization:
            job.hiringOrganization,

          jobLocation:
            job.jobLocation,

          identifier:
            job.identifier,

          url:
            job.url,
        },
        {
          depth: 10,
        }
      );
    }
  );

  printDivider(
    `${label} POSSIBLE JOB MARKERS`
  );

  const markers = [
    "jobdescription",
    "job-description",
    "jobDescription",
    "jobTitle",
    "job-title",
    "jobLocation",
    "job-location",
    "jobDetails",
    "job-details",
    "JobPosting",
    "1369567757",
    "Backend Developer",
    "Azercell",
    "career",
    "SuccessFactors",
  ];

  for (
    const marker of markers
  ) {
    const index =
      html
        .toLowerCase()
        .indexOf(
          marker.toLowerCase()
        );

    console.log({
      marker,
      found:
        index !== -1,
      index,
    });

    if (
      index !== -1
    ) {
      const start =
        Math.max(
          0,
          index - 500
        );

      const end =
        Math.min(
          html.length,
          index + 1500
        );

      console.log(
        html.slice(
          start,
          end
        )
      );
    }
  }

  printDivider(
    `${label} PAGE TEXT PREVIEW`
  );

  const pageText =
    stripHtml(
      html
    );

  console.log(
    pageText.slice(
      0,
      5000
    )
  );
};

/* =========================================================
   MAIN
========================================================= */

const main =
  async (): Promise<void> => {
    console.log(
      "=".repeat(80)
    );

    console.log(
      "AZERCELL JOB PAGE DEBUG"
    );

    console.log(
      "=".repeat(80)
    );

    console.log(
      "\nRequested URL:"
    );

    console.log(
      JOB_URL
    );

    /* =====================================================
       STEP 1
       DO NOT FOLLOW REDIRECT
    ===================================================== */

    printDivider(
      "STEP 1 - MANUAL REDIRECT RESPONSE"
    );

    const initialResponse =
      await fetch(
        JOB_URL,
        {
          method:
            "GET",

          redirect:
            "manual",

          headers: {
            "User-Agent":
              USER_AGENT,

            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

            "Accept-Language":
              "en-US,en;q=0.9",

            "Cache-Control":
              "no-cache",

            Pragma:
              "no-cache",
          },
        }
      );

    console.log(
      getResponseSummary(
        initialResponse
      )
    );

    const initialHtml =
      await initialResponse.text();

    console.log(
      "\nInitial body:"
    );

    console.log({
      bodyLength:
        initialHtml.length,

      preview:
        initialHtml.slice(
          0,
          2000
        ),
    });

    const redirectLocation =
      initialResponse.headers.get(
        "location"
      );

    if (
      initialHtml.length > 0
    ) {
      inspectHtml(
        initialHtml,
        "INITIAL RESPONSE"
      );
    }

    /* =====================================================
       STEP 2
       FOLLOW REDIRECT AUTOMATICALLY
       ONLY FOR COMPARISON
    ===================================================== */

    printDivider(
      "STEP 2 - AUTO FOLLOW RESPONSE"
    );

    const followedResponse =
      await fetch(
        JOB_URL,
        {
          method:
            "GET",

          redirect:
            "follow",

          headers: {
            "User-Agent":
              USER_AGENT,

            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

            "Accept-Language":
              "en-US,en;q=0.9",

            "Cache-Control":
              "no-cache",

            Pragma:
              "no-cache",
          },
        }
      );

    console.log(
      getResponseSummary(
        followedResponse
      )
    );

    const followedHtml =
      await followedResponse.text();

    console.log({
      htmlLength:
        followedHtml.length,
    });

    inspectHtml(
      followedHtml,
      "FOLLOWED RESPONSE"
    );

    /* =====================================================
       STEP 3
       FINAL DIAGNOSIS
    ===================================================== */

    printDivider(
      "FINAL DIAGNOSIS"
    );

    const redirectedAwayFromAzercell =
      followedResponse.url !==
      JOB_URL;

    const redirectsToSap =
      followedResponse.url
        .toLowerCase()
        .includes(
          "sap.com"
        );

    const originalJobIdFound =
      followedHtml.includes(
        "1369567757"
      );

    const backendDeveloperFound =
      followedHtml
        .toLowerCase()
        .includes(
          "backend developer"
        );

    console.log({
      requestedUrl:
        JOB_URL,

      firstStatus:
        initialResponse.status,

      firstLocation:
        redirectLocation,

      finalUrl:
        followedResponse.url,

      redirectedAwayFromAzercell,

      redirectsToSap,

      originalJobIdFound,

      backendDeveloperFound,
    });

    if (
      redirectLocation
    ) {
      console.log(
        "\n⚠️ Redirect detected."
      );

      console.log(
        `Azercell server returned Location: ${redirectLocation}`
      );
    }

    if (
      redirectsToSap &&
      !originalJobIdFound &&
      !backendDeveloperFound
    ) {
      console.log(
        "\n❌ REAL JOB PAGE WAS NOT RETURNED."
      );

      console.log(
        "The requested Azercell vacancy URL redirected to a generic SAP page."
      );

      console.log(
        "Do NOT build the production parser around this returned HTML."
      );

      console.log(
        "Next step should be finding the current Azercell vacancy source/listing/detail endpoint."
      );
    } else {
      console.log(
        "\n✅ The response may still contain vacancy data."
      );

      console.log(
        "Inspect the structured fields above before changing production parsing."
      );
    }

    console.log(
      "\n" +
        "=".repeat(
          80
        )
    );

    console.log(
      "DEBUG COMPLETE"
    );

    console.log(
      "=".repeat(80)
    );
  };

main().catch(
  (
    error
  ) => {
    console.error(
      "\n[AZERCELL DEBUG] Fatal error:"
    );

    console.error(
      error
    );

    process.exit(
      1
    );
  }
);