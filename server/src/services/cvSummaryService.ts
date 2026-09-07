import qwenService from "./qwenService";

/* =========================================================
   TYPES
========================================================= */

export interface ICVSummaryInput {
  targetTitle?: string | null;

  existingSummary?: string | null;

  skills: string[];

  experience: Array<{
    title?: string;
    company?: string;
    description?: string;
  }>;

  projects?: Array<{
    name?: string;
    description?: string;
    technologies?: string[];
  }>;
}

export interface ICVSummaryResult {
  summary: string;

  source: "qwen" | "fallback";
}

/* =========================================================
   HELPERS
========================================================= */

const normalizeStrings = (values: string[]): string[] => {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
};

const cleanSummary = (value: string): string => {
  return value
    .replace(/^```(?:text)?/i, "")
    .replace(/```$/i, "")
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

/* =========================================================
   FALLBACK SUMMARY
========================================================= */

const buildFallbackSummary = (input: ICVSummaryInput): string => {
  const skills = normalizeStrings(input.skills).slice(0, 5);

  const title =
    input.targetTitle?.trim() ||
    input.experience
      .find((item) => item.title?.trim())
      ?.title?.trim() ||
    "technology professional";

  if (input.existingSummary?.trim()) {
    return input.existingSummary.trim();
  }

  if (skills.length > 0) {
    return `${title} with practical experience and demonstrated knowledge of ${skills.join(
      ", "
    )}. Focused on building reliable, maintainable, and user-centered solutions while continuing to strengthen technical and professional capabilities.`;
  }

  return `${title} with practical experience contributing to technology projects and developing reliable, maintainable, and user-centered solutions.`;
};

/* =========================================================
   PROMPT
========================================================= */

const buildPrompt = (input: ICVSummaryInput): string => {
  const skills = normalizeStrings(input.skills).slice(0, 15);

  const experience = input.experience
    .slice(0, 4)
    .map((item) => ({
      title: item.title || "",
      company: item.company || "",
      description: item.description || "",
    }));

  const projects = (input.projects || [])
    .slice(0, 3)
    .map((item) => ({
      name: item.name || "",
      description: item.description || "",
      technologies: item.technologies || [],
    }));

  return `
Write a concise professional resume summary.

STRICT RULES:
- Use ONLY the facts provided below.
- Do not invent experience.
- Do not invent skills.
- Do not invent employers.
- Do not invent projects.
- Do not invent achievements.
- Do not invent metrics.
- Do not invent years of experience.
- Do not invent education or certifications.
- Do not exaggerate seniority.
- Write 2 to 4 concise sentences.
- Use professional resume language.
- Do not use first-person pronouns.
- Return ONLY the summary text.
- Do not return JSON.
- Do not return markdown.

TARGET TITLE:
${input.targetTitle || "General career improvement"}

VERIFIED SKILLS:
${JSON.stringify(skills)}

VERIFIED EXPERIENCE:
${JSON.stringify(experience)}

VERIFIED PROJECTS:
${JSON.stringify(projects)}

EXISTING SUMMARY:
${input.existingSummary || "None"}
`.trim();
};

/* =========================================================
   GENERATE SUMMARY
========================================================= */

export const generateCVSummary = async (
  input: ICVSummaryInput
): Promise<ICVSummaryResult> => {
  const fallbackSummary = buildFallbackSummary(input);

  try {
    console.log("[CV Summary] Qwen request START");

    /*
     * Only one attempt.
     *
     * CV generation must not become dependent on AI
     * availability. If Qwen fails, we immediately use
     * the deterministic fallback.
     */
    const response = await qwenService.generateQwenText({
      messages: [
        {
          role: "user",
          content: buildPrompt(input),
        },
      ],
      temperature: 0.5,
      retries: 0, // Setting retries to 0 for a single attempt
      maxCompletionTokens: 300, // Summaries are usually short
    });

    if (!response.success) {
      throw new Error(response.error || "Qwen text generation failed");
    }

    const generatedSummary = cleanSummary(response.text || "");

    if (generatedSummary.length < 30) {
      console.warn(
        "[CV Summary] Qwen returned insufficient summary. Using fallback."
      );

      return {
        summary: fallbackSummary,
        source: "fallback",
      };
    }

    console.log("[CV Summary] Qwen SUCCESS");

    return {
      summary: generatedSummary,
      source: "qwen",
    };
  } catch (error) {
    /*
     * IMPORTANT:
     * Qwen failure does NOT fail CV generation.
     */
    console.warn("[CV Summary] Qwen unavailable. Using fallback summary.");
    console.warn(error);

    return {
      summary: fallbackSummary,
      source: "fallback",
    };
  }
};

export default {
  generateCVSummary,
};