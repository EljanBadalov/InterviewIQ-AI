import {
  type IResumeAnalysis,
} from "../models/resumeAnalysis";

import {
  type IGeneratedCVData,
} from "./cvBuilderService";

import {
  generateCVPdf,
} from "./cvPdfService";

import {
  validateGeneratedCV,
  type ICVValidationResult,
} from "./cvValidationService";

import {
  extractPdfText,
} from "./pdfTextService";

import {
  analyzeResumeLocally,
} from "./resumeFallbackAnalysisService";

import {
  type IResumeServiceResult,
} from "./resumeService";

/* =========================================================
   TYPES
========================================================= */

export interface ICVImprovementOrchestratorParams {
  baseline:
    IResumeAnalysis;

  initialCV:
    IGeneratedCVData;
}

export type CVSummarySource =
  "source-resume";

export interface IAcceptedCVImprovementResult {
  accepted:
    true;

  cv:
    IGeneratedCVData;

  pdfBuffer:
    Buffer;

  fileName:
    string;

  validation:
    ICVValidationResult;

  summarySource:
    CVSummarySource;

  extractedTextLength:
    number;

  baseline:
    IResumeAnalysis;

  candidateAnalysis:
    IResumeServiceResult;

  baselineScore:
    number;

  generatedScore:
    number;

  improvement:
    number;

  totalAttempts:
    1;
}

export interface IRejectedCVImprovementResult {
  accepted:
    false;

  cv:
    IGeneratedCVData;

  pdfBuffer:
    null;

  fileName:
    null;

  validation:
    ICVValidationResult;

  summarySource:
    CVSummarySource;

  extractedTextLength:
    0;

  baseline:
    IResumeAnalysis;

  candidateAnalysis:
    null;

  baselineScore:
    number;

  generatedScore:
    number;

  improvement:
    number;

  totalAttempts:
    1;

  failureReason:
    string;
}

export type ICVImprovementOrchestratorResult =
  | IAcceptedCVImprovementResult
  | IRejectedCVImprovementResult;

/* =========================================================
   HELPERS
========================================================= */

const clampScore = (
  value:
    unknown
): number => {
  const parsed =
    Number(
      value
    );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        parsed
      )
    )
  );
};

/* =========================================================
   MAIN ORCHESTRATOR
========================================================= */

export const runCVImprovementQualityGate =
  async ({
    baseline,
    initialCV,
  }: ICVImprovementOrchestratorParams): Promise<ICVImprovementOrchestratorResult> => {
    console.log(
      "[CV Improve] START"
    );

    const baselineScore =
      clampScore(
        baseline
          .overallScore
      );

    /*
     * CRITICAL LOSSLESS RULE
     * -------------------------------------------------------
     * This orchestrator MUST NOT author, polish, rewrite, or
     * regenerate factual CV content.
     *
     * In particular, Professional Summary is NOT sent to Qwen
     * or any other generative service here.
     *
     * The builder has already received a verified structured
     * source profile. We preserve that data exactly and only
     * refresh generation metadata.
     */
    const finalCV:
      IGeneratedCVData = {
        ...initialCV,

        metadata: {
          ...initialCV.metadata,

          generatedAt:
            new Date()
              .toISOString(),
        },

        professionalSummary:
          initialCV
            .professionalSummary,
      };

    const summarySource:
      CVSummarySource =
      "source-resume";

    console.log(
      "[CV Improve] Source content preserved; no generative summary rewrite"
    );

    /*
     * Deterministic validation prevents us from persisting a CV
     * whose required sections or factual structure are incomplete.
     */
    const validation =
      validateGeneratedCV(
        finalCV
      );

    if (
      !validation.valid
    ) {
      console.error(
        "[CV Improve] Validation FAILED",
        validation.errors
      );

      return {
        accepted:
          false,

        cv:
          finalCV,

        pdfBuffer:
          null,

        fileName:
          null,

        validation,

        summarySource,

        extractedTextLength:
          0,

        baseline,

        candidateAnalysis:
          null,

        baselineScore,

        generatedScore:
          baselineScore,

        improvement:
          0,

        totalAttempts:
          1,

        failureReason:
          validation.errors
            .map(
              (
                issue
              ) =>
                issue.message
            )
            .join(
              " "
            ) ||
          "Generated CV failed deterministic validation.",
      };
    }

    console.log(
      "[CV Improve] Validation PASS"
    );

    const {
      buffer:
        pdfBuffer,
      fileName,
    } =
      await generateCVPdf({
        cv:
          finalCV,
      });

    console.log(
      `[CV Improve] PDF generated (${pdfBuffer.length} bytes)`
    );

    /*
     * Extract the PDF text once. This verifies that the generated
     * file is readable and gives us the exact rendered content that
     * will be saved in Resume Analysis history.
     */
    const {
      text:
        extractedText,
      characterCount:
        extractedTextLength,
    } =
      await extractPdfText(
        pdfBuffer
      );

    console.log(
      `[CV Improve] PDF readability PASS (${extractedTextLength} chars)`
    );

    /*
     * Analyze the generated PDF locally.
     *
     * This scoring step does NOT modify the CV content.
     */
    const candidateAnalysis =
      analyzeResumeLocally({
        resumeText:
          extractedText,
      });

    const generatedScore =
      clampScore(
        candidateAnalysis
          .analysis
          .overallScore
      );

    const improvement =
      generatedScore -
      baselineScore;

    console.log(
      "[CV Improve] Local analysis completed",
      {
        baselineScore,
        generatedScore,
        improvement,
      }
    );

    console.log(
      "[CV Improve] COMPLETED"
    );

    return {
      accepted:
        true,

      cv:
        finalCV,

      pdfBuffer,

      fileName,

      validation,

      summarySource,

      extractedTextLength,

      baseline,

      candidateAnalysis,

      baselineScore,

      generatedScore,

      improvement,

      totalAttempts:
        1,
    };
  };

export default {
  runCVImprovementQualityGate,
};
