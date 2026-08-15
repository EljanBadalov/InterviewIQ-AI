import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FiBookmark,
  FiBriefcase,
  FiCode,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
} from "react-icons/fi";

import axios from "axios";

import apiClient from "../../../api/apiClient";
import "./bookmarksPage.scss";

interface BookmarkQuestion {
  _id: string;
  text: string;
  category: string;
  difficulty:
    | "beginner"
    | "intermediate"
    | "advanced"
    | "senior";
  interviewType:
    | "technical"
    | "behavioral";
  tags?: string[];
  isActive?: boolean;
  createdAt?: string;
}

interface BookmarksResponse {
  success: boolean;
  data: {
    bookmarks: BookmarkQuestion[];
    totalBookmarks: number;
  };
}

const categoryNames: Record<
  string,
  string
> = {
  frontend: "Frontend Developer",
  backend: "Backend Developer",
  "software-engineer":
    "Software Engineer",
  devops: "DevOps Engineer",
  "ui-ux": "UI/UX Designer",
  "machine-learning":
    "Machine Learning Engineer",
};

const formatCategory = (
  category: string
): string => {
  return (
    categoryNames[category] ||
    category
      .split("-")
      .map(
        (word) =>
          word.charAt(0).toUpperCase() +
          word.slice(1)
      )
      .join(" ")
  );
};

const formatDifficulty = (
  difficulty: string
): string => {
  return (
    difficulty.charAt(0).toUpperCase() +
    difficulty.slice(1)
  );
};

const formatInterviewType = (
  interviewType: string
): string => {
  return (
    interviewType
      .charAt(0)
      .toUpperCase() +
    interviewType.slice(1)
  );
};

const bookmarksPage = () => {
  const [
    bookmarks,
    setBookmarks,
  ] = useState<
    BookmarkQuestion[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    removingId,
    setRemovingId,
  ] = useState<
    string | null
  >(null);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    typeFilter,
    setTypeFilter,
  ] = useState<
    "all" |
    "technical" |
    "behavioral"
  >("all");

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState("all");

  const loadBookmarks =
    async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await apiClient.get<BookmarksResponse>(
            "/bookmarks"
          );

        setBookmarks(
          response.data.data
            .bookmarks || []
        );
      } catch (err) {
        if (
          axios.isAxiosError(err)
        ) {
          setError(
            err.response?.data
              ?.message ||
              "Bookmarks could not be loaded."
          );
        } else {
          setError(
            "Bookmarks could not be loaded."
          );
        }
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    void loadBookmarks();
  }, []);

  const removeBookmark =
    async (
      questionId: string
    ) => {
      if (removingId) {
        return;
      }

      setRemovingId(
        questionId
      );

      try {
        await apiClient.delete(
          `/bookmarks/${questionId}`
        );

        setBookmarks(
          (previous) =>
            previous.filter(
              (question) =>
                question._id !==
                questionId
            )
        );
      } catch (err) {
        if (
          axios.isAxiosError(err)
        ) {
          setError(
            err.response?.data
              ?.message ||
              "Bookmark could not be removed."
          );
        } else {
          setError(
            "Bookmark could not be removed."
          );
        }
      } finally {
        setRemovingId(null);
      }
    };

  const categories =
    useMemo(() => {
      const unique =
        new Set<string>();

      bookmarks.forEach(
        (question) => {
          unique.add(
            question.category
          );
        }
      );

      return Array.from(
        unique
      ).sort();
    }, [bookmarks]);

  const technicalCount =
    useMemo(
      () =>
        bookmarks.filter(
          (question) =>
            question.interviewType ===
            "technical"
        ).length,
      [bookmarks]
    );

  const behavioralCount =
    useMemo(
      () =>
        bookmarks.filter(
          (question) =>
            question.interviewType ===
            "behavioral"
        ).length,
      [bookmarks]
    );

  const filteredBookmarks =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return bookmarks.filter(
        (question) => {
          const matchesSearch =
            !normalizedSearch ||
            question.text
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            formatCategory(
              question.category
            )
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            question.tags?.some(
              (tag) =>
                tag
                  .toLowerCase()
                  .includes(
                    normalizedSearch
                  )
            );

          const matchesType =
            typeFilter ===
              "all" ||
            question.interviewType ===
              typeFilter;

          const matchesCategory =
            categoryFilter ===
              "all" ||
            question.category ===
              categoryFilter;

          return (
            matchesSearch &&
            matchesType &&
            matchesCategory
          );
        }
      );
    }, [
      bookmarks,
      search,
      typeFilter,
      categoryFilter,
    ]);

  return (
    <main className="bookmarks-page">
      <section className="bookmarks-header">
        <div>
          <span className="bookmarks-eyebrow">
            SAVED
          </span>

          <h1>Bookmarks</h1>

          <p>
            Keep useful interview
            questions in one place
            and revisit them anytime.
          </p>
        </div>
      </section>

      {error && (
        <div className="bookmarks-error">
          <div>
            <strong>
              Unable to complete
              the request
            </strong>

            <span>
              {error}
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadBookmarks()
            }
          >
            <FiRefreshCw />
            Retry
          </button>
        </div>
      )}

      <section className="bookmarks-summary">
        <article className="bookmark-summary-card">
          <div className="bookmark-summary-icon">
            <FiBookmark />
          </div>

          <div>
            <span>
              Total Saved
            </span>

            {loading ? (
              <span className="bookmark-skeleton bookmark-skeleton--value" />
            ) : (
              <strong>
                {bookmarks.length}
              </strong>
            )}
          </div>
        </article>

        <article className="bookmark-summary-card">
          <div className="bookmark-summary-icon">
            <FiCode />
          </div>

          <div>
            <span>
              Technical
            </span>

            {loading ? (
              <span className="bookmark-skeleton bookmark-skeleton--value" />
            ) : (
              <strong>
                {technicalCount}
              </strong>
            )}
          </div>
        </article>

        <article className="bookmark-summary-card">
          <div className="bookmark-summary-icon">
            <FiBriefcase />
          </div>

          <div>
            <span>
              Behavioral
            </span>

            {loading ? (
              <span className="bookmark-skeleton bookmark-skeleton--value" />
            ) : (
              <strong>
                {behavioralCount}
              </strong>
            )}
          </div>
        </article>

        <article className="bookmark-summary-card">
          <div className="bookmark-summary-icon">
            <FiFilter />
          </div>

          <div>
            <span>
              Categories
            </span>

            {loading ? (
              <span className="bookmark-skeleton bookmark-skeleton--value" />
            ) : (
              <strong>
                {categories.length}
              </strong>
            )}
          </div>
        </article>
      </section>

      <section className="bookmarks-library">
        <div className="bookmarks-library-header">
          <div>
            <span>
              QUESTION LIBRARY
            </span>

            <h2>
              Saved Questions
            </h2>

            <p>
              Review questions you
              bookmarked during mock
              interviews.
            </p>
          </div>

          {!loading && (
            <div className="bookmark-results-count">
              {
                filteredBookmarks.length
              }{" "}
              {filteredBookmarks.length ===
              1
                ? "question"
                : "questions"}
            </div>
          )}
        </div>

        <div className="bookmark-toolbar">
          <div className="bookmark-search">
            <FiSearch />

            <input
              type="text"
              value={search}
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search saved questions..."
            />
          </div>

          <select
            value={typeFilter}
            onChange={(
              event
            ) =>
              setTypeFilter(
                event.target
                  .value as
                  | "all"
                  | "technical"
                  | "behavioral"
              )
            }
          >
            <option value="all">
              All types
            </option>

            <option value="technical">
              Technical
            </option>

            <option value="behavioral">
              Behavioral
            </option>
          </select>

          <select
            value={
              categoryFilter
            }
            onChange={(
              event
            ) =>
              setCategoryFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All categories
            </option>

            {categories.map(
              (category) => (
                <option
                  key={category}
                  value={category}
                >
                  {formatCategory(
                    category
                  )}
                </option>
              )
            )}
          </select>
        </div>

        {loading ? (
          <div className="bookmark-list">
            {[1, 2, 3].map(
              (item) => (
                <article
                  className="bookmark-card bookmark-card--loading"
                  key={item}
                >
                  <div className="bookmark-card-main">
                    <span className="bookmark-skeleton bookmark-skeleton--badge" />

                    <span className="bookmark-skeleton bookmark-skeleton--title" />

                    <span className="bookmark-skeleton bookmark-skeleton--title bookmark-skeleton--title-short" />

                    <div className="bookmark-loading-tags">
                      <span className="bookmark-skeleton bookmark-skeleton--tag" />
                      <span className="bookmark-skeleton bookmark-skeleton--tag" />
                      <span className="bookmark-skeleton bookmark-skeleton--tag" />
                    </div>
                  </div>

                  <span className="bookmark-skeleton bookmark-skeleton--remove" />
                </article>
              )
            )}
          </div>
        ) : filteredBookmarks.length >
          0 ? (
          <div className="bookmark-list">
            {filteredBookmarks.map(
              (question) => (
                <article
                  className="bookmark-card"
                  key={question._id}
                >
                  <div className="bookmark-card-main">
                    <div className="bookmark-card-top">
                      <div className="bookmark-card-label">
                        <FiBookmark />

                        <span>
                          Saved question
                        </span>
                      </div>
                    </div>

                    <h3>
                      {question.text}
                    </h3>

                    <div className="bookmark-meta">
                      <span>
                        {formatCategory(
                          question.category
                        )}
                      </span>

                      <span className="bookmark-meta-dot" />

                      <span>
                        {formatInterviewType(
                          question.interviewType
                        )}
                      </span>

                      <span className="bookmark-meta-dot" />

                      <span>
                        {formatDifficulty(
                          question.difficulty
                        )}
                      </span>
                    </div>

                    {question.tags &&
                      question.tags
                        .length >
                        0 && (
                        <div className="bookmark-tags">
                          {question.tags.map(
                            (tag) => (
                              <span
                                key={tag}
                              >
                                {tag}
                              </span>
                            )
                          )}
                        </div>
                      )}
                  </div>

                  <button
                    type="button"
                    className="remove-bookmark-btn"
                    disabled={
                      removingId ===
                      question._id
                    }
                    onClick={() =>
                      void removeBookmark(
                        question._id
                      )
                    }
                    aria-label="Remove bookmark"
                  >
                    {removingId ===
                    question._id ? (
                      <span className="bookmark-remove-loader" />
                    ) : (
                      <FiTrash2 />
                    )}

                    <span>
                      {removingId ===
                      question._id
                        ? "Removing..."
                        : "Remove"}
                    </span>
                  </button>
                </article>
              )
            )}
          </div>
        ) : bookmarks.length ===
          0 ? (
          <div className="bookmarks-empty">
            <div className="bookmarks-empty-icon">
              <FiBookmark />
            </div>

            <h3>
              No saved questions yet
            </h3>

            <p>
              Save useful interview
              questions while
              practicing and they
              will appear here.
            </p>
          </div>
        ) : (
          <div className="bookmarks-empty">
            <div className="bookmarks-empty-icon">
              <FiSearch />
            </div>

            <h3>
              No matching questions
            </h3>

            <p>
              Try changing your
              search or filters.
            </p>
          </div>
        )}
      </section>
    </main>
  );
};

export default bookmarksPage;