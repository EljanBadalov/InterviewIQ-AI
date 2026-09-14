import {
  chromium,
} from "playwright";

const URL =
  "https://careers.abb-bank.az/vakansiyalar/v2/5187";

const main =
  async (): Promise<void> => {
    const browser =
      await chromium.launch({
        headless:
          true,
      });

    const context =
      await browser.newContext({
        viewport: {
          width:
            1440,

          height:
            1000,
        },

        locale:
          "az-AZ",

        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/152.0.0.0 Safari/537.36",
      });

    const page =
      await context.newPage();

    try {
      console.log(
        "\n[ABB DETAIL TEST] Opening:",
        URL
      );

      await page.goto(
        URL,
        {
          waitUntil:
            "domcontentloaded",

          timeout:
            60_000,
        }
      );

      console.log(
        "[ABB DETAIL TEST] page.goto completed"
      );

      console.log(
        "[ABB DETAIL TEST] Final URL:",
        page.url()
      );

      try {
        await page.waitForLoadState(
          "networkidle",
          {
            timeout:
              10_000,
          }
        );

        console.log(
          "[ABB DETAIL TEST] networkidle completed"
        );
      } catch (
        error
      ) {
        console.log(
          "[ABB DETAIL TEST] networkidle timeout:",
          error instanceof Error
            ? error.message
            : error
        );
      }

      await page.waitForTimeout(
        2_000
      );

      /* =====================================================
         TITLE
      ===================================================== */

      const title =
        await page
          .locator(
            "h1, h2"
          )
          .first()
          .textContent()
          .catch(
            () =>
              null
          );

      console.log(
        "\n[ABB DETAIL TEST] TITLE:\n"
      );

      console.log(
        title
      );

      /* =====================================================
         BODY
      ===================================================== */

      const body =
        await page
          .locator(
            "body"
          )
          .innerText();

      console.log(
        "\n[ABB DETAIL TEST] BODY LENGTH:",
        body.length
      );

      console.log(
        "\n[ABB DETAIL TEST] BODY SAMPLE:\n"
      );

      console.log(
        body.slice(
          0,
          8000
        )
      );

      /* =====================================================
         HEADINGS
      ===================================================== */

      const headings =
        await page
          .locator(
            "h1, h2, h3, h4, h5, h6, strong, b"
          )
          .allTextContents();

      console.log(
        "\n[ABB DETAIL TEST] HEADINGS:\n"
      );

      console.log(
        headings
      );

      /* =====================================================
         SECTION DOM DEBUG
      ===================================================== */

      const sectionDebug =
        await page.evaluate(
          () => {
            const headings =
              Array.from(
                document.querySelectorAll<HTMLElement>(
                  "h1, h2, h3, h4, h5, h6, strong, b"
                )
              );

            return headings
              .map(
                (
                  heading
                ) => {
                  const text =
                    (
                      heading.innerText ||
                      heading.textContent ||
                      ""
                    )
                      .replace(
                        /\s+/g,
                        " "
                      )
                      .trim();

                  if (
                    !/görəcəyiniz işlər|bizim üçün uyğun namizəd/i.test(
                      text
                    )
                  ) {
                    return null;
                  }

                  const parent =
                    heading.parentElement;

                  const grandParent =
                    parent?.parentElement;

                  const nextSibling =
                    heading.nextElementSibling as
                      HTMLElement |
                      null;

                  const parentLis =
                    parent
                      ? Array.from(
                          parent.querySelectorAll<HTMLElement>(
                            "li"
                          )
                        ).map(
                          (
                            li
                          ) =>
                            (
                              li.innerText ||
                              li.textContent ||
                              ""
                            )
                              .replace(
                                /\s+/g,
                                " "
                              )
                              .trim()
                        )
                      : [];

                  const grandParentLis =
                    grandParent
                      ? Array.from(
                          grandParent.querySelectorAll<HTMLElement>(
                            "li"
                          )
                        ).map(
                          (
                            li
                          ) =>
                            (
                              li.innerText ||
                              li.textContent ||
                              ""
                            )
                              .replace(
                                /\s+/g,
                                " "
                              )
                              .trim()
                        )
                      : [];

                  const nextSiblingLis =
                    nextSibling
                      ? Array.from(
                          nextSibling.querySelectorAll<HTMLElement>(
                            "li"
                          )
                        ).map(
                          (
                            li
                          ) =>
                            (
                              li.innerText ||
                              li.textContent ||
                              ""
                            )
                              .replace(
                                /\s+/g,
                                " "
                              )
                              .trim()
                        )
                      : [];

                  return {
                    heading:
                      text,

                    tag:
                      heading.tagName,

                    className:
                      heading.className,

                    parentTag:
                      parent?.tagName ||
                      null,

                    parentClass:
                      parent?.className ||
                      null,

                    parentText:
                      (
                        parent?.innerText ||
                        parent?.textContent ||
                        ""
                      )
                        .replace(
                          /\s+/g,
                          " "
                        )
                        .trim()
                        .slice(
                          0,
                          1500
                        ),

                    parentLiCount:
                      parentLis.length,

                    parentLis:
                      parentLis.slice(
                        0,
                        30
                      ),

                    grandParentTag:
                      grandParent?.tagName ||
                      null,

                    grandParentClass:
                      grandParent?.className ||
                      null,

                    grandParentLiCount:
                      grandParentLis.length,

                    grandParentLis:
                      grandParentLis.slice(
                        0,
                        30
                      ),

                    nextSiblingTag:
                      nextSibling?.tagName ||
                      null,

                    nextSiblingClass:
                      nextSibling?.className ||
                      null,

                    nextSiblingText:
                      (
                        nextSibling?.innerText ||
                        nextSibling?.textContent ||
                        ""
                      )
                        .replace(
                          /\s+/g,
                          " "
                        )
                        .trim()
                        .slice(
                          0,
                          1500
                        ),

                    nextSiblingLiCount:
                      nextSiblingLis.length,

                    nextSiblingLis:
                      nextSiblingLis.slice(
                        0,
                        30
                      ),

                    outerHtmlSample:
                      heading
                        .parentElement
                        ?.outerHTML
                        .slice(
                          0,
                          5000
                        ) ||
                      "",
                  };
                }
              )
              .filter(
                Boolean
              );
          }
        );

      console.log(
        "\n[ABB DETAIL TEST] SECTION DOM DEBUG:\n"
      );

      console.dir(
        sectionDebug,
        {
          depth:
            10,
        }
      );

      /* =====================================================
         ALL LIST ITEMS
      ===================================================== */

      const listItems =
        await page
          .locator(
            "li"
          )
          .allTextContents();

      console.log(
        "\n[ABB DETAIL TEST] LIST ITEMS COUNT:",
        listItems.length
      );

      console.log(
        "\n[ABB DETAIL TEST] FIRST LIST ITEMS:\n"
      );

      console.log(
        listItems.slice(
          0,
          50
        )
      );

      /* =====================================================
         UL / OL STRUCTURE
      ===================================================== */

      const listStructure =
        await page.evaluate(
          () => {
            return Array.from(
              document.querySelectorAll<HTMLElement>(
                "ul, ol"
              )
            ).map(
              (
                list,
                index
              ) => {
                const items =
                  Array.from(
                    list.querySelectorAll<HTMLElement>(
                      ":scope > li"
                    )
                  ).map(
                    (
                      li
                    ) =>
                      (
                        li.innerText ||
                        li.textContent ||
                        ""
                      )
                        .replace(
                          /\s+/g,
                          " "
                        )
                        .trim()
                  );

                return {
                  index,

                  tag:
                    list.tagName,

                  className:
                    list.className,

                  itemCount:
                    items.length,

                  items:
                    items.slice(
                      0,
                      30
                    ),

                  parentTag:
                    list.parentElement?.tagName ||
                    null,

                  parentClass:
                    list.parentElement?.className ||
                    null,

                  parentText:
                    (
                      list.parentElement?.innerText ||
                      list.parentElement?.textContent ||
                      ""
                    )
                      .replace(
                        /\s+/g,
                        " "
                      )
                      .trim()
                      .slice(
                        0,
                        2000
                      ),
                };
              }
            );
          }
        );

      console.log(
        "\n[ABB DETAIL TEST] LIST STRUCTURE:\n"
      );

      console.dir(
        listStructure,
        {
          depth:
            10,
        }
      );

      /* =====================================================
         FRAMES
      ===================================================== */

      const frames =
        page.frames();

      console.log(
        "\n[ABB DETAIL TEST] FRAMES:"
      );

      for (
        const frame of
        frames
      ) {
        console.log(
          frame.url()
        );
      }

      console.log(
        "\n[ABB DETAIL TEST] SUCCESS"
      );
    } catch (
      error
    ) {
      console.error(
        "\n[ABB DETAIL TEST] ERROR:"
      );

      console.error(
        error
      );
    } finally {
      await browser.close();
    }
  };

main().catch(
  (
    error
  ) => {
    console.error(
      "[ABB DETAIL TEST] Fatal:",
      error
    );

    process.exit(
      1
    );
  }
);