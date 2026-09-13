/* =========================================================
   AZERCELL JOB PROVIDER

   Why this exists:
   ---------------------------------------------------------
   Azercell careers is rendered as a browser-facing job search
   experience. Plain Node fetch requests are not reliable for
   discovering current vacancies and old/stale job URLs may
   redirect to a generic SAP recruiting page.

   This adapter therefore uses Playwright to behave like a real
   browser and discover the CURRENT vacancies visible on the
   Azercell careers site.

   Flow:
   1. Open careers.azercell.com in Chromium.
   2. Dismiss cookie banners when present.
   3. Trigger "Search Jobs" when the landing page requires it.
   4. Collect same-domain /job/ links from the rendered DOM.
   5. Scroll and follow/load pagination when available.
   6. Return unique current public job URLs to externalJobService.

   IMPORTANT ARCHITECTURE RULE:
   ---------------------------------------------------------
   This provider discovers vacancies only.
   It does NOT filter by InterviewIQ specialization.
   Career taxonomy / matching happens later in the pipeline.

   Generic SuccessFactors companies continue using
   successFactorsJobProvider.ts.
========================================================= */

import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";

/* =========================================================
   TYPES
========================================================= */

export interface IAzercellDiscoveryInput {
  careersUrl?: string;

  requestTimeoutMs?: number;

  maxPages?: number;

  /*
   * Kept for backwards compatibility with the previous
   * provider interface.
   *
   * The Playwright provider does NOT depend on bootstrap URLs.
   * If supplied, valid same-domain job URLs are merged into the
   * discovered URL set as a last-resort compatibility fallback.
   */
  bootstrapUrls?: string[];
}

export interface IAzercellDiscoveredJob {
  title: string;
  location: string;
  url: string;
}

export interface IAzercellDiscoveryResult {
  baseUrl: string;

  urls: string[];

  /*
   * Extra structured listing information.
   * Existing callers that only use `urls` continue to work.
   */
  jobs: IAzercellDiscoveredJob[];

  diagnostics: {
    bootstrapUrls: number;
    fetchedPages: number;
    discoveredFromPages: number;
    acceptedPages: number;
    rejectedPages: number;
    errors: string[];
  };
}

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_BASE_URL =
  "https://careers.azercell.com";

const DEFAULT_TIMEOUT_MS =
  30_000;

const DEFAULT_MAX_PAGES =
  20;

const MAX_SCROLL_ROUNDS =
  12;

const DOM_SETTLE_MS =
  1_000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/152.0.0.0 Safari/537.36";

/* =========================================================
   BASIC HELPERS
========================================================= */

const normalizeWhitespace = (
  value:
    | string
    | undefined
    | null
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

const decodeHtmlEntities = (
  value: string
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
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    )
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&#x2F;/gi,
      "/"
    )
    .replace(
      /&#47;/gi,
      "/"
    );
};

const normalizeBaseUrl = (
  value:
    | string
    | undefined
): string => {
  const raw =
    normalizeWhitespace(
      value
    ) ||
    DEFAULT_BASE_URL;

  const withProtocol =
    /^https?:\/\//i.test(
      raw
    )
      ? raw
      : `https://${raw}`;

  const parsed =
    new URL(
      withProtocol
    );

  return parsed.origin;
};

const canonicalizeJobUrl = (
  value: string,
  baseUrl: string
): string => {
  const cleaned =
    decodeHtmlEntities(
      value
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
    const parsed =
      new URL(
        cleaned,
        `${baseUrl}/`
      );

    const expected =
      new URL(
        `${baseUrl}/`
      );

    if (
      parsed.host !==
      expected.host
    ) {
      return "";
    }

    if (
      !/\/job\//i.test(
        parsed.pathname
      )
    ) {
      return "";
    }

    parsed.search =
      "";

    parsed.hash =
      "";

    if (
      !parsed.pathname.endsWith(
        "/"
      )
    ) {
      parsed.pathname +=
        "/";
    }

    return parsed.toString();
  } catch {
    return "";
  }
};

const uniqueJobUrls = (
  values: string[],
  baseUrl: string
): string[] => {
  const seen =
    new Set<string>();

  const result:
    string[] =
    [];

  for (
    const value of values
  ) {
    const normalized =
      canonicalizeJobUrl(
        value,
        baseUrl
      );

    if (
      !normalized ||
      seen.has(
        normalized
      )
    ) {
      continue;
    }

    seen.add(
      normalized
    );

    result.push(
      normalized
    );
  }

  return result;
};

const sleep = async (
  ms: number
): Promise<void> => {
  await new Promise<void>(
    (
      resolve
    ) => {
      setTimeout(
        resolve,
        ms
      );
    }
  );
};

/* =========================================================
   BROWSER HELPERS
========================================================= */

const createBrowserContext =
  async (
    timeoutMs: number
  ): Promise<{
    browser: Browser;
    context: BrowserContext;
  }> => {
    const browser =
      await chromium.launch({
        headless:
          true,

        args: [
          "--disable-dev-shm-usage",
          "--no-sandbox",
        ],
      });

    const context =
      await browser.newContext({
        userAgent:
          USER_AGENT,

        viewport: {
          width:
            1440,
          height:
            1200,
        },

        locale:
          "en-US",

        javaScriptEnabled:
          true,

        ignoreHTTPSErrors:
          true,
      });

    context.setDefaultTimeout(
      timeoutMs
    );

    context.setDefaultNavigationTimeout(
      timeoutMs
    );

    return {
      browser,
      context,
    };
  };

const dismissCookieBanner =
  async (
    page: Page
  ): Promise<void> => {
    const selectors = [
      'button:has-text("Accept")',
      'button:has-text("Accept All")',
      'button:has-text("I Accept")',
      'button:has-text("Agree")',
      '[id*="cookie"] button:has-text("Accept")',
      '[class*="cookie"] button:has-text("Accept")',
    ];

    for (
      const selector of selectors
    ) {
      try {
        const locator =
          page
            .locator(
              selector
            )
            .first();

        if (
          await locator.isVisible({
            timeout:
              500,
          })
        ) {
          await locator.click({
            timeout:
              1_500,
          });

          await sleep(
            300
          );

          return;
        }
      } catch {
        // Cookie banner is optional.
      }
    }
  };

const triggerSearchJobs =
  async (
    page: Page
  ): Promise<void> => {
    /*
     * SuccessFactors themes differ between tenants.
     * Try semantic text first, then submit controls.
     */
    const selectors = [
      'button:has-text("Search Jobs")',
      'a:has-text("Search Jobs")',
      'input[type="submit"][value*="Search"]',
      'button[type="submit"]:has-text("Search")',
      '[role="button"]:has-text("Search Jobs")',
      '[aria-label*="Search Jobs" i]',
    ];

    for (
      const selector of selectors
    ) {
      try {
        const locator =
          page
            .locator(
              selector
            )
            .first();

        if (
          await locator.isVisible({
            timeout:
              800,
          })
        ) {
          await Promise.allSettled([
            page.waitForLoadState(
              "domcontentloaded",
              {
                timeout:
                  5_000,
              }
            ),

            locator.click({
              timeout:
                3_000,
            }),
          ]);

          await sleep(
            DOM_SETTLE_MS
          );

          return;
        }
      } catch {
        // Try the next selector.
      }
    }

    /*
     * Some themes expose the job search form but no obvious text
     * button. Submit the most likely search form as a fallback.
     */
    try {
      const searchInputSelectors = [
        'input[type="search"]',
        'input[name*="keyword" i]',
        'input[id*="keyword" i]',
        'input[placeholder*="keyword" i]',
        'input[placeholder*="search" i]',
      ];

      for (
        const selector
        of searchInputSelectors
      ) {
        const input =
          page
            .locator(
              selector
            )
            .first();

        try {
          if (
            await input.isVisible({
              timeout: 1_000,
            })
          ) {
            await Promise.allSettled([
              page.waitForLoadState(
                "domcontentloaded",
                {
                  timeout: 5_000,
                }
              ),

              input.press(
                "Enter",
                {
                  timeout: 3_000,
                }
              ),
            ]);

            await sleep(
              DOM_SETTLE_MS
            );

            return;
          }
        } catch {
          // Try the next possible search input.
        }
      }
    } catch {
      // The landing page may already expose jobs.
    }
  };

/* =========================================================
   JOB EXTRACTION
========================================================= */

const collectVisibleJobs =
  async (
    page: Page,
    baseUrl: string
  ): Promise<IAzercellDiscoveredJob[]> => {
    const anchors =
      page.locator(
        'a[href*="/job/"]'
      );

    const count =
      await anchors.count();

    const byUrl =
      new Map<
        string,
        IAzercellDiscoveredJob
      >();

    for (
      let index = 0;
      index < count;
      index += 1
    ) {
      const anchor =
        anchors.nth(
          index
        );

      const href =
        normalizeWhitespace(
          await anchor.getAttribute(
            "href"
          )
        );

      const url =
        canonicalizeJobUrl(
          href,
          baseUrl
        );

      if (
        !url
      ) {
        continue;
      }

      const anchorText =
        normalizeWhitespace(
          await anchor.textContent()
        );

      const ariaLabel =
        normalizeWhitespace(
          await anchor.getAttribute(
            "aria-label"
          )
        );

      const titleAttribute =
        normalizeWhitespace(
          await anchor.getAttribute(
            "title"
          )
        );

      /*
       * Stay entirely in Playwright's Locator API.
       * Do not use page.evaluate()/evaluateAll() here: when this
       * TypeScript file is executed through tsx/esbuild, helper
       * symbols such as __name can otherwise leak into the browser
       * execution context and throw ReferenceError.
       */
      const container =
        anchor.locator(
          [
            "xpath=ancestor::li[1]",
            "xpath=ancestor::tr[1]",
            "xpath=ancestor::article[1]",
            "xpath=ancestor::*[@role='listitem'][1]",
            "xpath=ancestor::*[contains(translate(@class,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'job')][1]",
            "xpath=ancestor::*[contains(translate(@class,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'result')][1]",
            "xpath=ancestor::*[contains(translate(@class,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'posting')][1]",
          ].join(
            " | "
          )
        )
        .first();

      let containerText =
        "";

      let containerTitle =
        "";

      let location =
        "";

      try {
        if (
          await container.count()
        ) {
          containerText =
            normalizeWhitespace(
              await container.textContent()
            );

          const titleLocator =
            container
              .locator(
                "h1,h2,h3,h4,h5,[class*=title],[class*=jobTitle],[class*=job-title]"
              )
              .first();

          if (
            await titleLocator.count()
          ) {
            containerTitle =
              normalizeWhitespace(
                await titleLocator.textContent()
              );
          }

          const locationLocator =
            container
              .locator(
                [
                  '[class*="location"]',
                  '[data-field="location"]',
                  '[data-testid*="location"]',
                  '[aria-label*="location" i]',
                ].join(
                  ","
                )
              )
              .first();

          if (
            await locationLocator.count()
          ) {
            location =
              normalizeWhitespace(
                await locationLocator.textContent()
              );
          }
        }
      } catch {
        // Metadata is optional; URL discovery still succeeds.
      }

      const titleCandidates = [
        anchorText,
        ariaLabel,
        titleAttribute,
        containerTitle,
      ].filter(
        Boolean
      );

      let title =
        titleCandidates[0] ||
        "";

      if (
        /^(view|apply|details?|learn more|read more)/i.test(
          title
        ) &&
        titleCandidates.length >
          1
      ) {
        title =
          titleCandidates[1] ||
          title;
      }

      if (
        !location &&
        containerText
      ) {
        const locationMatch =
          containerText.match(
            /\b(Baku|Bakı)(?:\s*,\s*(?:AZ|Azerbaijan|Azərbaycan))?/i
          );

        location =
          normalizeWhitespace(
            locationMatch?.[0]
          );
      }

      const next: IAzercellDiscoveredJob = {
        title:
          normalizeWhitespace(
            title
          ),

        location:
          normalizeWhitespace(
            location
          ),

        url,
      };

      const existing =
        byUrl.get(
          url
        );

      if (
        !existing ||
        (!existing.title &&
          next.title) ||
        (!existing.location &&
          next.location)
      ) {
        byUrl.set(
          url,
          next
        );
      }
    }

    return [
      ...byUrl.values(),
    ];
  };

const mergeJobs = (
  target:
    Map<
      string,
      IAzercellDiscoveredJob
    >,
  jobs:
    IAzercellDiscoveredJob[]
): number => {
  let added =
    0;

  for (
    const job of jobs
  ) {
    const existing =
      target.get(
        job.url
      );

    if (
      !existing
    ) {
      target.set(
        job.url,
        job
      );

      added +=
        1;

      continue;
    }

    target.set(
      job.url,
      {
        title:
          existing.title ||
          job.title,

        location:
          existing.location ||
          job.location,

        url:
          job.url,
      }
    );
  }

  return added;
};

/* =========================================================
   PAGINATION / DYNAMIC LOADING
========================================================= */

const clickLoadMoreIfAvailable =
  async (
    page: Page
  ): Promise<boolean> => {
    const selectors = [
      'button:has-text("Load More")',
      'button:has-text("Show More")',
      'button:has-text("More Jobs")',
      'a:has-text("Load More")',
      'a:has-text("Show More")',
      '[role="button"]:has-text("Load More")',
      '[role="button"]:has-text("Show More")',
    ];

    for (
      const selector of selectors
    ) {
      try {
        const button =
          page
            .locator(
              selector
            )
            .first();

        if (
          await button.isVisible({
            timeout:
              300,
          }) &&
          await button.isEnabled({
            timeout:
              300,
          })
        ) {
          await button.click({
            timeout:
              2_000,
          });

          await sleep(
            DOM_SETTLE_MS
          );

          return true;
        }
      } catch {
        // Try the next selector.
      }
    }

    return false;
  };

const clickNextPageIfAvailable =
  async (
    page: Page
  ): Promise<boolean> => {
    const selectors = [
      'a[rel="next"]',
      'button[aria-label*="next" i]',
      'a[aria-label*="next" i]',
      'button:has-text("Next")',
      'a:has-text("Next")',
      '[class*="pagination"] a:has-text(">")',
    ];

    for (
      const selector of selectors
    ) {
      try {
        const next =
          page
            .locator(
              selector
            )
            .first();

        if (
          !await next.isVisible({
            timeout:
              300,
          }) ||
          !await next.isEnabled({
            timeout:
              300,
          })
        ) {
          continue;
        }

        const disabled =
          await next.getAttribute(
            "aria-disabled"
          );

        const className =
          await next.getAttribute(
            "class"
          );

        if (
          disabled ===
            "true" ||
          /disabled/i.test(
            className ||
            ""
          )
        ) {
          continue;
        }

        const previousUrl =
          page.url();

        await Promise.allSettled([
          page.waitForLoadState(
            "domcontentloaded",
            {
              timeout:
                5_000,
            }
          ),

          next.click({
            timeout:
              2_000,
          }),
        ]);

        await sleep(
          DOM_SETTLE_MS
        );

        const currentUrl =
          page.url();

        /*
         * URL may or may not change in an SPA; successful click is
         * enough to continue. Keeping the variables helps debugging.
         */
        void previousUrl;
        void currentUrl;

        return true;
      } catch {
        // Try the next selector.
      }
    }

    return false;
  };

const scrapeCurrentAzercellJobs =
  async (
    page: Page,
    baseUrl: string,
    maxPages: number
  ): Promise<{
    jobs:
      IAzercellDiscoveredJob[];
    browserPages:
      number;
  }> => {
    const discovered =
      new Map<
        string,
        IAzercellDiscoveredJob
      >();

    let browserPages =
      1;

    await dismissCookieBanner(
      page
    );

    /*
     * First collect any jobs already rendered on the landing page.
     */
    mergeJobs(
      discovered,
      await collectVisibleJobs(
        page,
        baseUrl
      )
    );

    if (
      discovered.size ===
      0
    ) {
      await triggerSearchJobs(
        page
      );

      await dismissCookieBanner(
        page
      );

      mergeJobs(
        discovered,
        await collectVisibleJobs(
          page,
          baseUrl
        )
      );
    }

    /*
     * Many SuccessFactors themes lazy-load result cards while the
     * page scrolls. Iterate until the DOM stops producing new jobs.
     */
    let stableRounds =
      0;

    for (
      let round = 0;
      round < MAX_SCROLL_ROUNDS;
      round += 1
    ) {
      const before =
        discovered.size;

      await page.mouse.wheel(
        0,
        10_000
      );

      await page.keyboard.press(
        "End"
      );

      await sleep(
        DOM_SETTLE_MS
      );

      const clickedMore =
        await clickLoadMoreIfAvailable(
          page
        );

      const added =
        mergeJobs(
          discovered,
          await collectVisibleJobs(
            page,
            baseUrl
          )
        );

      if (
        discovered.size ===
          before &&
        added ===
          0 &&
        !clickedMore
      ) {
        stableRounds +=
          1;
      } else {
        stableRounds =
          0;
      }

      if (
        stableRounds >=
        2
      ) {
        break;
      }
    }

    /*
     * Handle classic pagination when the tenant uses separate pages.
     */
    const visitedPageKeys =
      new Set<string>();

    visitedPageKeys.add(
      page.url()
    );

    while (
      browserPages <
      maxPages
    ) {
      const clickedNext =
        await clickNextPageIfAvailable(
          page
        );

      if (
        !clickedNext
      ) {
        break;
      }

      browserPages +=
        1;

      await dismissCookieBanner(
        page
      );

      mergeJobs(
        discovered,
        await collectVisibleJobs(
          page,
          baseUrl
        )
      );

      for (
        let round = 0;
        round < 4;
        round += 1
      ) {
        await page.mouse.wheel(
          0,
          10_000
        );

        await page.keyboard.press(
          "End"
        );

        await sleep(
          DOM_SETTLE_MS
        );

        const clickedMore =
          await clickLoadMoreIfAvailable(
            page
          );

        const before =
          discovered.size;

        mergeJobs(
          discovered,
          await collectVisibleJobs(
            page,
            baseUrl
          )
        );

        if (
          !clickedMore &&
          discovered.size ===
            before
        ) {
          break;
        }
      }

      const pageKey =
        `${page.url()}::${discovered.size}`;

      if (
        visitedPageKeys.has(
          pageKey
        )
      ) {
        break;
      }

      visitedPageKeys.add(
        pageKey
      );
    }

    return {
      jobs:
        [
          ...discovered.values(),
        ],

      browserPages,
    };
  };

/* =========================================================
   DISCOVERY
========================================================= */

export const discoverAzercellJobUrls =
  async (
    input:
      IAzercellDiscoveryInput = {}
  ): Promise<IAzercellDiscoveryResult> => {
    const baseUrl =
      normalizeBaseUrl(
        input.careersUrl
      );

    const timeoutMs =
      Math.max(
        5_000,
        input.requestTimeoutMs ??
        DEFAULT_TIMEOUT_MS
      );

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

    const diagnostics:
      IAzercellDiscoveryResult[
        "diagnostics"
      ] = {
        bootstrapUrls:
          0,

        fetchedPages:
          0,

        discoveredFromPages:
          0,

        acceptedPages:
          0,

        rejectedPages:
          0,

        errors:
          [],
      };

    let browser:
      Browser |
      null =
      null;

    let context:
      BrowserContext |
      null =
      null;

    try {
      const created =
        await createBrowserContext(
          timeoutMs
        );

      browser =
        created.browser;

      context =
        created.context;

      const page =
        await context.newPage();

      const rootUrl =
        `${baseUrl}/`;

      console.log(
        "[AZERCELL PROVIDER] Opening careers page:",
        rootUrl
      );

      const response =
        await page.goto(
          rootUrl,
          {
            waitUntil:
              "domcontentloaded",

            timeout:
              timeoutMs,
          }
        );

      diagnostics.fetchedPages +=
        1;

      if (
        response &&
        !response.ok()
      ) {
        throw new Error(
          `Azercell careers page returned HTTP ${response.status()}`
        );
      }

      await page.waitForLoadState(
        "networkidle",
        {
          timeout:
            Math.min(
              timeoutMs,
              8_000
            ),
        }
      ).catch(
        () => {
          /*
           * SuccessFactors may keep analytics/network connections
           * alive. DOMContentLoaded + settle delay is sufficient.
           */
        }
      );

      await sleep(
        DOM_SETTLE_MS
      );

      const scraped =
        await scrapeCurrentAzercellJobs(
          page,
          baseUrl,
          maxPages
        );

      diagnostics.fetchedPages =
        Math.max(
          diagnostics.fetchedPages,
          scraped.browserPages
        );

      let jobs =
        scraped.jobs;

      const browserDiscoveredCount =
        jobs.length;

      diagnostics.discoveredFromPages =
        browserDiscoveredCount;

      /*
       * Backwards-compatible optional bootstrap fallback.
       *
       * IMPORTANT:
       * Browser-discovered current jobs always take priority.
       * We only merge caller-supplied bootstrap URLs when the caller
       * explicitly provided them. There is NO built-in hardcoded list.
       */
      const bootstrapUrls =
        uniqueJobUrls(
          input.bootstrapUrls ||
          [],
          baseUrl
        );

      diagnostics.bootstrapUrls =
        bootstrapUrls.length;

      if (
        bootstrapUrls.length >
        0
      ) {
        const byUrl =
          new Map<
            string,
            IAzercellDiscoveredJob
          >(
            jobs.map(
              (
                job
              ) => [
                job.url,
                job,
              ]
            )
          );

        for (
          const url of bootstrapUrls
        ) {
          if (
            !byUrl.has(
              url
            )
          ) {
            byUrl.set(
              url,
              {
                title:
                  "",
                location:
                  "",
                url,
              }
            );
          }
        }

        jobs =
          [
            ...byUrl.values(),
          ];
      }

      const urls =
        uniqueJobUrls(
          jobs.map(
            (
              job
            ) =>
              job.url
          ),
          baseUrl
        );

      diagnostics.acceptedPages =
        urls.length;

      /*
       * A zero-job result is not silently treated as success.
       * Keep the provider non-fatal so global ATS sources continue,
       * but make the state obvious in logs.
       */
      if (
        urls.length ===
        0
      ) {
        diagnostics.errors.push(
          "No Azercell job links were discovered from the rendered careers page."
        );
      }

      const normalizedJobs =
        jobs.filter(
          (
            job
          ) =>
            urls.includes(
              job.url
            )
        );

      console.log(
        "[AZERCELL PROVIDER] Browser discovery complete:",
        {
          baseUrl,

          jobs:
            urls.length,

          sampleJobs:
            normalizedJobs
              .slice(
                0,
                10
              )
              .map(
                (
                  job
                ) => ({
                  title:
                    job.title,
                  location:
                    job.location,
                  url:
                    job.url,
                })
              ),

          diagnostics,
        }
      );

      return {
        baseUrl,
        urls,
        jobs:
          normalizedJobs,
        diagnostics,
      };
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : String(
              error
            );

      diagnostics.errors.push(
        message
      );

      console.error(
        "[AZERCELL PROVIDER] Browser discovery failed:",
        {
          baseUrl,
          error:
            message,
          diagnostics,
        }
      );

      return {
        baseUrl,
        urls:
          [],
        jobs:
          [],
        diagnostics,
      };
    } finally {
      if (
        context
      ) {
        await context.close().catch(
          () => {
            // Best-effort cleanup.
          }
        );
      }

      if (
        browser
      ) {
        await browser.close().catch(
          () => {
            // Best-effort cleanup.
          }
        );
      }
    }
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  discoverAzercellJobUrls,
};
