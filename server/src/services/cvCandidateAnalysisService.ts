import {
  type IResumeAnalysis,
} from "../models/resumeAnalysis";

import {
  analyzeResume,
  type IResumeServiceResult,
} from "./resumeService";

import {
  extractPdfText,
} from "./pdfTextService";

import {
  evaluateCVQuality,
  extractCVQualityScores,
  type ICVQualityGateResult,
} from "./cvQualityGateService";

/* =========================================================
   TYPES
========================================================= */

export interface IEvaluateGeneratedCVCandidateParams {
  baseline:
    IResumeAnalysis;

  pdfBuffer:
    Buffer;
}

export interface IGeneratedCVCandidateEvaluation {
  resumeResult:
    IResumeServiceResult;

  qualityGate:
    ICVQualityGateResult;

  extractedTextLength:
    number;
}

/* =========================================================
   EVALUATE GENERATED CV CANDIDATE
========================================================= */

/*
 * This service intentionally has no persistence side effects.
 *
 * It is used by the CV Quality Gate orchestration layer to:
 *
 * 1. extract text from a generated PDF
 * 2. analyze that generated CV with the same resume analyzer
 * 3. compare its scores against the original analyzed resume
 *
 * A rejected candidate can therefore be discarded safely
 * without creating ResumeAnalysis / ResumeProfile / GridFS
 * records.
 */
export const evaluateGeneratedCVCandidate =
  async ({
    baseline,
    pdfBuffer,
  }: IEvaluateGeneratedCVCandidateParams): Promise<IGeneratedCVCandidateEvaluation> => {
    if (
      !pdfBuffer ||
      !Buffer.isBuffer(
        pdfBuffer
      ) ||
      pdfBuffer.length ===
        0
    ) {
      throw new Error(
        "A valid generated CV PDF buffer is required."
      );
    }

    const {
      text:
        resumeText,

      characterCount:
        extractedTextLength,
    } =
      await extractPdfText(
        pdfBuffer
      );

    const resumeResult =
      await analyzeResume({
        resumeText,
      });

    const qualityGate =
      evaluateCVQuality({
        baseline,

        candidate:
          extractCVQualityScores(
            resumeResult
              .analysis
          ),
      });

    return {
      resumeResult,

      qualityGate,

      extractedTextLength,
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  evaluateGeneratedCVCandidate,
};
