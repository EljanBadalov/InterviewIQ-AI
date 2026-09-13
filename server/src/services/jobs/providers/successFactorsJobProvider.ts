/* =========================================================
   SUCCESSFACTORS JOB PROVIDER

   Purpose:
   - Discover public job detail URLs from SAP SuccessFactors
     Recruiting / Career Site Builder career sites.
   - Keep SuccessFactors-specific discovery logic OUT of the
     large externalJobService.ts file.
   - Use multiple public/no-auth discovery strategies because
     different SuccessFactors tenants expose listings
     differently.

   This provider DOES NOT normalize jobs into InterviewIQ's
   IExternalJobRecord. It only discovers canonical public job
   URLs. externalJobService.ts can continue using its existing
   detail-page parser and normalization logic.
========================================================= */

/* =========================================================
   TYPES
========================================================= */

export interface ISuccessFactorsDiscoveryInput {
  careersUrl:
    string;

  companyName?:
    string;

  maxPages?:
    number;

  requestTimeoutMs?:
    number;
}

export interface ISuccessFactorsDiscoveryResult {
  baseUrl:
    string;

  companyName:
    string;

  urls:
    string[];

  discoveryMethod:
    | "tile-search-results"
    | "recruiting-json-api"
    | "search-page"
    | "home-page"
    | "none";

  diagnostics: {
    tileRequests:
      number;

    tileLinks:
      number;

    apiRequests:
      number;

    apiLinks:
      number;

    searchLinks:
      number;

    homeLinks:
      number;

    errors:
      string[];
  };
}

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_TIMEOUT_MS =
  15_000;

const DEFAULT_MAX_PAGES =
  30;

const TILE_PAGE_STEP =
  10;

const USER_AGENT =
  "Mozilla/5.0 (compatible; InterviewIQ/1.0)";

/* =========================================================
   BASIC HELPERS
========================================================= */

const normalizeWhitespace =
  (
    value:
      string |
      undefined |
      null
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

const uniqueStrings =
  (
    values:
      string[]
  ): string[] => {
    const seen =
      new Set<string>();

    const result:
      string[] =
      [];

    for (
      const value
      of values
    ) {
      const normalized =
        normalizeWhitespace(
          value
        );

      if (
        !normalized
      ) {
        continue;
      }

      const key =
        normalized
          .toLowerCase();

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
        normalized
      );
    }

    return result;
  };

const decodeHtmlEntities =
  (
    value:
      string
  ): string => {
    return value
      .replace(
        /&amp;/gi,
        "&"
      )
      .replace(
        /&quot;/gi,
        '"'
      )
      .replace(
        /&#39;/gi,
        "'"
      )
      .replace(
        /&apos;/gi,
        "'"
      )
      .replace(
        /&#x2F;/gi,
        "/"
      )
      .replace(
        /&#47;/gi,
        "/"
      )
      .replace(
        /&lt;/gi,
        "<"
      )
      .replace(
        /&gt;/gi,
        ">"
      );
  };

const getBaseUrl =
  (
    careersUrl:
      string
  ): string => {
    const normalized =
      normalizeWhitespace(
        careersUrl
      );

    if (
      !normalized
    ) {
      throw new Error(
        "SuccessFactors careersUrl is required."
      );
    }

    const withProtocol =
      /^https?:\/\//i.test(
        normalized
      )
        ? normalized
        : `https://${normalized}`;

    const parsed =
      new URL(
        withProtocol
      );

    /*
     * Preserve an optional brand path while stripping common
     * SuccessFactors page suffixes.
     *
     * Examples:
     *
     * https://careers.azercell.com
     *   -> https://careers.azercell.com
     *
     * https://careers.example.com/Brand/search/
     *   -> https://careers.example.com/Brand
     */
    let pathname =
      parsed.pathname
        .replace(
          /\/+$/,
          ""
        )
        .replace(
          /\/(?:search|jobs?|tile-search-results)\/?$/i,
          ""
        );

    if (
      pathname ===
      "/"
    ) {
      pathname =
        "";
    }

    return (
      `${parsed.origin}${pathname}`
        .replace(
          /\/+$/,
          ""
        )
    );
  };

const toAbsoluteJobUrl =
  (
    candidate:
      string,
    baseUrl:
      string
  ): string => {
    const cleaned =
      decodeHtmlEntities(
        candidate
      )
        .replace(
          /\\u002F/gi,
          "/"
        )
        .replace(
          /\\\//g,
          "/"
        )
        .trim();

    if (
      !cleaned
    ) {
      return "";
    }

    try {
      const absolute =
        new URL(
          cleaned,
          `${baseUrl}/`
        );

      const expected =
        new URL(
          `${baseUrl}/`
        );

      /*
       * Do not accidentally ingest third-party links.
       */
      if (
        absolute.host !==
        expected.host
      ) {
        return "";
      }

      if (
        !/\/job\//i.test(
          absolute.pathname
        )
      ) {
        return "";
      }

      return absolute.toString();
    } catch {
      return "";
    }
  };

/* =========================================================
   HTTP
========================================================= */

const fetchResponse =
  async (
    url:
      string,
    timeoutMs:
      number,
    accept:
      string
  ): Promise<Response> => {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        timeoutMs
      );

    try {
      const response =
        await fetch(
          url,
          {
            method:
              "GET",

            headers: {
              Accept:
                accept,

              "User-Agent":
                USER_AGENT,
            },

            redirect:
              "follow",

            signal:
              controller.signal,
          }
        );

      if (
        !response.ok
      ) {
        throw new Error(
          `HTTP ${response.status} for ${url}`
        );
      }

      return response;
    } finally {
      clearTimeout(
        timeout
      );
    }
  };

const fetchText =
  async (
    url:
      string,
    timeoutMs:
      number
  ): Promise<string> => {
    const response =
      await fetchResponse(
        url,
        timeoutMs,
        "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8"
      );

    return await response.text();
  };

const fetchUnknownJson =
  async (
    url:
      string,
    timeoutMs:
      number
  ): Promise<unknown> => {
    const response =
      await fetchResponse(
        url,
        timeoutMs,
        "application/json,text/plain;q=0.9,*/*;q=0.8"
      );

    const text =
      await response.text();

    if (
      !text.trim()
    ) {
      return null;
    }

    try {
      return JSON.parse(
        text
      ) as unknown;
    } catch {
      /*
       * Some SuccessFactors configurations return JSON-ish
       * content with an HTML content type or wrapper. Return
       * the text so the generic URL extractor can still inspect
       * it.
       */
      return text;
    }
  };

/* =========================================================
   URL EXTRACTION FROM HTML / TEXT
========================================================= */

const extractJobUrlsFromText =
  (
    input:
      string,
    baseUrl:
      string
  ): string[] => {
    const decoded =
      decodeHtmlEntities(
        input
      )
        .replace(
          /\\u002F/gi,
          "/"
        )
        .replace(
          /\\\//g,
          "/"
        );

    const candidates:
      string[] =
      [];

    /*
     * Attribute-based URLs.
     */
    const attributeRegex =
      /(?:href|data-url|data-href|url)=["']([^"']+)["']/gi;

    let match:
      RegExpExecArray |
      null;

    while (
      (
        match =
          attributeRegex.exec(
            decoded
          )
      ) !==
      null
    ) {
      candidates.push(
        match[
          1
        ] ||
        ""
      );
    }

    /*
     * Loose absolute or relative /job/... URLs.
     *
     * We intentionally do NOT require the URL to end with a
     * numeric ID here because some tenants use another slug
     * structure.
     */
    const looseJobRegex =
      /(?:https?:\/\/[^"'<>\\\s]+)?\/job\/[^"'<>\\\s]+/gi;

    candidates.push(
      ...(
        decoded.match(
          looseJobRegex
        ) ||
        []
      )
    );

    const result:
      string[] =
      [];

    for (
      const candidate
      of candidates
    ) {
      const absolute =
        toAbsoluteJobUrl(
          candidate,
          baseUrl
        );

      if (
        absolute
      ) {
        result.push(
          absolute
        );
      }
    }

    return uniqueStrings(
      result
    );
  };

/* =========================================================
   GENERIC JSON URL EXTRACTION

   SuccessFactors Career Site Builder versions do not all
   return the same JSON shape. Instead of hardcoding one shape,
   recursively inspect public response values and collect:
   - URL strings containing /job/
   - likely URL/path fields
========================================================= */

const extractJobUrlsFromJson =
  (
    value:
      unknown,
    baseUrl:
      string
  ): string[] => {
    const discovered:
      string[] =
      [];

    const visit =
      (
        current:
          unknown,
        depth:
          number
      ): void => {
        if (
          depth >
          12 ||
          current ===
          null ||
          current ===
          undefined
        ) {
          return;
        }

        if (
          typeof current ===
          "string"
        ) {
          /*
           * Direct URL-like value.
           */
          if (
            /\/job\//i.test(
              current
            )
          ) {
            const absolute =
              toAbsoluteJobUrl(
                current,
                baseUrl
              );

            if (
              absolute
            ) {
              discovered.push(
                absolute
              );
            }
          }

          /*
           * A string can itself contain embedded JSON/HTML.
           */
          discovered.push(
            ...extractJobUrlsFromText(
              current,
              baseUrl
            )
          );

          return;
        }

        if (
          Array.isArray(
            current
          )
        ) {
          for (
            const item
            of current
          ) {
            visit(
              item,
              depth +
                1
            );
          }

          return;
        }

        if (
          typeof current ===
          "object"
        ) {
          const record =
            current as
              Record<
                string,
                unknown
              >;

          for (
            const [
              key,
              child,
            ]
            of Object.entries(
              record
            )
          ) {
            /*
             * Prioritize likely URL fields but still recursively
             * inspect all fields below.
             */
            if (
              typeof child ===
                "string" &&
              /(url|link|path|uri|job)/i.test(
                key
              )
            ) {
              const absolute =
                toAbsoluteJobUrl(
                  child,
                  baseUrl
                );

              if (
                absolute
              ) {
                discovered.push(
                  absolute
                );
              }
            }

            visit(
              child,
              depth +
                1
            );
          }
        }
      };

    visit(
      value,
      0
    );

    return uniqueStrings(
      discovered
    );
  };

/* =========================================================
   STRATEGY 1 — RMK TILE SEARCH RESULTS
========================================================= */

const discoverFromTileSearch =
  async (
    baseUrl:
      string,
    maxPages:
      number,
    timeoutMs:
      number,
    diagnostics:
      ISuccessFactorsDiscoveryResult[
        "diagnostics"
      ]
  ): Promise<string[]> => {
    const discovered =
      new Set<string>();

    for (
      let pageIndex =
        0;
      pageIndex <
        maxPages;
      pageIndex +=
        1
    ) {
      const startRow =
        pageIndex *
        TILE_PAGE_STEP;

      /*
       * Try both variants because tenant routing differs.
       */
      const urlsToTry = [
        `${baseUrl}/tile-search-results/?startrow=${startRow}`,
        `${baseUrl}/tile-search-results/?q=&startrow=${startRow}`,
      ];

      let pageProducedResponse =
        false;

      let pageNewLinks =
        0;

      for (
        const url
        of urlsToTry
      ) {
        try {
          const html =
            await fetchText(
              url,
              timeoutMs
            );

          diagnostics.tileRequests +=
            1;

          pageProducedResponse =
            true;

          const urls =
            extractJobUrlsFromText(
              html,
              baseUrl
            );

          for (
            const jobUrl
            of urls
          ) {
            if (
              discovered.has(
                jobUrl
              )
            ) {
              continue;
            }

            discovered.add(
              jobUrl
            );

            pageNewLinks +=
              1;
          }

          /*
           * No need to call the alternate variant if this one
           * already produced jobs.
           */
          if (
            urls.length >
              0
          ) {
            break;
          }
        } catch (
          error
        ) {
          diagnostics.errors.push(
            `Tile ${url}: ${
              error instanceof
                Error
                ? error.message
                : String(
                    error
                  )
            }`
          );
        }
      }

      if (
        pageNewLinks ===
          0
      ) {
        /*
         * If page 0 answered but contains no links, this tenant
         * likely does not expose the RMK tile feed. Let the next
         * strategy handle it immediately.
         */
        if (
          pageIndex ===
            0 &&
          pageProducedResponse
        ) {
          break;
        }

        /*
         * Later zero-new-link pages mean pagination is done.
         */
        if (
          pageIndex >
            0
        ) {
          break;
        }
      }
    }

    diagnostics.tileLinks =
      discovered.size;

    return [
      ...discovered,
    ];
  };

/* =========================================================
   STRATEGY 2 — CAREER SITE BUILDER PUBLIC RECRUITING API

   Some SuccessFactors tenants expose a public endpoint at:

   /services/recruiting/v1/jobs

   The exact response can differ by deployment/version, so the
   recursive extractor above intentionally does not depend on a
   single JSON schema.
========================================================= */

const discoverFromRecruitingApi =
  async (
    baseUrl:
      string,
    maxPages:
      number,
    timeoutMs:
      number,
    diagnostics:
      ISuccessFactorsDiscoveryResult[
        "diagnostics"
      ]
  ): Promise<string[]> => {
    const discovered =
      new Set<string>();

    /*
     * Different deployments accept different pagination names.
     * We try conservative public GET variations.
     */
    for (
      let pageIndex =
        0;
      pageIndex <
        Math.min(
          maxPages,
          20
        );
      pageIndex +=
        1
    ) {
      const offset =
        pageIndex *
        20;

      const candidates = [
        `${baseUrl}/services/recruiting/v1/jobs?offset=${offset}&limit=20`,
        `${baseUrl}/services/recruiting/v1/jobs?startrow=${offset}`,
        pageIndex ===
          0
          ? `${baseUrl}/services/recruiting/v1/jobs`
          : "",
      ]
        .filter(
          Boolean
        );

      let newLinksThisPage =
        0;

      let anyRequestWorked =
        false;

      for (
        const url
        of candidates
      ) {
        try {
          const payload =
            await fetchUnknownJson(
              url,
              timeoutMs
            );

          diagnostics.apiRequests +=
            1;

          anyRequestWorked =
            true;

          const urls =
            typeof payload ===
              "string"
              ? extractJobUrlsFromText(
                  payload,
                  baseUrl
                )
              : extractJobUrlsFromJson(
                  payload,
                  baseUrl
                );

          for (
            const jobUrl
            of urls
          ) {
            if (
              discovered.has(
                jobUrl
              )
            ) {
              continue;
            }

            discovered.add(
              jobUrl
            );

            newLinksThisPage +=
              1;
          }

          if (
            urls.length >
              0
          ) {
            break;
          }
        } catch (
          error
        ) {
          diagnostics.errors.push(
            `Recruiting API ${url}: ${
              error instanceof
                Error
                ? error.message
                : String(
                    error
                  )
            }`
          );
        }
      }

      if (
        !anyRequestWorked
      ) {
        break;
      }

      if (
        newLinksThisPage ===
          0
      ) {
        break;
      }
    }

    diagnostics.apiLinks =
      discovered.size;

    return [
      ...discovered,
    ];
  };

/* =========================================================
   STRATEGY 3 — SEARCH PAGE
========================================================= */

const discoverFromSearchPage =
  async (
    baseUrl:
      string,
    timeoutMs:
      number,
    diagnostics:
      ISuccessFactorsDiscoveryResult[
        "diagnostics"
      ]
  ): Promise<string[]> => {
    const candidates = [
      `${baseUrl}/search/?q=`,
      `${baseUrl}/search/?q=&sortColumn=referencedate&sortDirection=desc`,
    ];

    for (
      const url
      of candidates
    ) {
      try {
        const html =
          await fetchText(
            url,
            timeoutMs
          );

        const urls =
          extractJobUrlsFromText(
            html,
            baseUrl
          );

        diagnostics.searchLinks =
          urls.length;

        if (
          urls.length >
            0
        ) {
          return urls;
        }
      } catch (
        error
      ) {
        diagnostics.errors.push(
          `Search page ${url}: ${
            error instanceof
              Error
              ? error.message
              : String(
                  error
                )
          }`
        );
      }
    }

    return [];
  };

/* =========================================================
   STRATEGY 4 — HOME PAGE
========================================================= */

const discoverFromHomePage =
  async (
    baseUrl:
      string,
    timeoutMs:
      number,
    diagnostics:
      ISuccessFactorsDiscoveryResult[
        "diagnostics"
      ]
  ): Promise<string[]> => {
    try {
      const html =
        await fetchText(
          baseUrl,
          timeoutMs
        );

      const urls =
        extractJobUrlsFromText(
          html,
          baseUrl
        );

      diagnostics.homeLinks =
        urls.length;

      return urls;
    } catch (
      error
    ) {
      diagnostics.errors.push(
        `Home page ${baseUrl}: ${
          error instanceof
            Error
              ? error.message
              : String(
                  error
                )
        }`
      );

      return [];
    }
  };

/* =========================================================
   PUBLIC DISCOVERY
========================================================= */

export const discoverSuccessFactorsJobUrls =
  async (
    input:
      ISuccessFactorsDiscoveryInput
  ): Promise<ISuccessFactorsDiscoveryResult> => {
    const baseUrl =
      getBaseUrl(
        input.careersUrl
      );

    const companyName =
      normalizeWhitespace(
        input.companyName
      ) ||
      new URL(
        `${baseUrl}/`
      ).hostname;

    const maxPages =
      Math.max(
        1,
        Math.min(
          50,
          Math.floor(
            input.maxPages ??
            DEFAULT_MAX_PAGES
          )
        )
      );

    const timeoutMs =
      Math.max(
        3_000,
        input.requestTimeoutMs ??
        DEFAULT_TIMEOUT_MS
      );

    const diagnostics:
      ISuccessFactorsDiscoveryResult[
        "diagnostics"
      ] = {
        tileRequests:
          0,

        tileLinks:
          0,

        apiRequests:
          0,

        apiLinks:
          0,

        searchLinks:
          0,

        homeLinks:
          0,

        errors:
          [],
      };

    /*
     * 1. Classic RMK tile feed.
     */
    const tileUrls =
      await discoverFromTileSearch(
        baseUrl,
        maxPages,
        timeoutMs,
        diagnostics
      );

    if (
      tileUrls.length >
        0
    ) {
      return {
        baseUrl,

        companyName,

        urls:
          tileUrls,

        discoveryMethod:
          "tile-search-results",

        diagnostics,
      };
    }

    /*
     * 2. Career Site Builder public recruiting endpoint.
     */
    const apiUrls =
      await discoverFromRecruitingApi(
        baseUrl,
        maxPages,
        timeoutMs,
        diagnostics
      );

    if (
      apiUrls.length >
        0
    ) {
      return {
        baseUrl,

        companyName,

        urls:
          apiUrls,

        discoveryMethod:
          "recruiting-json-api",

        diagnostics,
      };
    }

    /*
     * 3. Server-rendered search page.
     */
    const searchUrls =
      await discoverFromSearchPage(
        baseUrl,
        timeoutMs,
        diagnostics
      );

    if (
      searchUrls.length >
        0
    ) {
      return {
        baseUrl,

        companyName,

        urls:
          searchUrls,

        discoveryMethod:
          "search-page",

        diagnostics,
      };
    }

    /*
     * 4. Homepage as last HTML fallback.
     */
    const homeUrls =
      await discoverFromHomePage(
        baseUrl,
        timeoutMs,
        diagnostics
      );

    if (
      homeUrls.length >
        0
    ) {
      return {
        baseUrl,

        companyName,

        urls:
          homeUrls,

        discoveryMethod:
          "home-page",

        diagnostics,
      };
    }

    return {
      baseUrl,

      companyName,

      urls:
        [],

      discoveryMethod:
        "none",

      diagnostics,
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  discoverSuccessFactorsJobUrls,
};
