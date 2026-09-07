import {
  Request,
  Response,
} from "express";

import {
  approveLearningCandidate,
  disableLearningCandidate,
  getLearningCandidateById,
  listLearningCandidates,
  rejectLearningCandidate,
  resetLearningCandidate,
} from "../services/csLearningService";

import {
  exportApprovedLearningCandidates,
  getLearningExportStatus,
} from "../services/csLearningExportService";

/* =========================================================
   HELPERS
========================================================= */

const getParamString = (
  value: string | string[] | undefined
): string | undefined => {
  if (
    Array.isArray(
      value
    )
  ) {
    return value[0];
  }

  return value;
};

const getQueryString = (
  value:
    | string
    | string[]
    | undefined
): string | undefined => {
  if (
    Array.isArray(
      value
    )
  ) {
    return value[0];
  }

  return value;
};

const getQueryNumber = (
  value:
    | string
    | string[]
    | undefined
): number | undefined => {
  const normalized =
    getQueryString(
      value
    );

  if (
    normalized ===
    undefined
  ) {
    return undefined;
  }

  const parsed =
    Number(
      normalized
    );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return undefined;
  }

  return parsed;
};

/* =========================================================
   GET ALL LEARNING CANDIDATES
========================================================= */

export const getLearningCandidates =
  async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const status =
      getQueryString(
        req.query.status as
          | string
          | string[]
          | undefined
      );

    const intent =
      getQueryString(
        req.query.intent as
          | string
          | string[]
          | undefined
      );

    const limit =
      getQueryNumber(
        req.query.limit as
          | string
          | string[]
          | undefined
      );

    const skip =
      getQueryNumber(
        req.query.skip as
          | string
          | string[]
          | undefined
      );

    const validStatuses =
      new Set([
        "candidate",
        "approved",
        "rejected",
        "disabled",
      ]);

    if (
      status &&
      !validStatuses.has(
        status
      )
    ) {
      res
        .status(400)
        .json({
          success:
            false,

          message:
            "Invalid learning candidate status.",
        });

      return;
    }

    const candidates =
      await listLearningCandidates(
        {
          status:
            status as
              | "candidate"
              | "approved"
              | "rejected"
              | "disabled"
              | undefined,

          intent,

          limit,

          skip,
        }
      );

    res
      .status(200)
      .json({
        success:
          true,

        count:
          candidates.length,

        data:
          candidates,
      });
  };

/* =========================================================
   GET ONE LEARNING CANDIDATE
========================================================= */

export const getLearningCandidate =
  async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const candidateId =
      getParamString(
        req.params.id
      );

    if (
      !candidateId
    ) {
      res
        .status(400)
        .json({
          success:
            false,

          message:
            "Candidate ID is required.",
        });

      return;
    }

    const candidate =
      await getLearningCandidateById(
        candidateId
      );

    if (
      !candidate
    ) {
      res
        .status(404)
        .json({
          success:
            false,

          message:
            "Learning candidate not found.",
        });

      return;
    }

    res
      .status(200)
      .json({
        success:
          true,

        data:
          candidate,
      });
  };

/* =========================================================
   APPROVE LEARNING CANDIDATE
========================================================= */

export const approveCandidate =
  async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const candidateId =
      getParamString(
        req.params.id
      );

    if (
      !candidateId
    ) {
      res
        .status(400)
        .json({
          success:
            false,

          message:
            "Candidate ID is required.",
        });

      return;
    }

    const notes =
      typeof req.body?.notes ===
      "string"
        ? req.body.notes
        : undefined;

    const candidate =
      await approveLearningCandidate(
        candidateId,
        {
          notes,
        }
      );

    if (
      !candidate
    ) {
      res
        .status(404)
        .json({
          success:
            false,

          message:
            "Learning candidate not found.",
        });

      return;
    }

    res
      .status(200)
      .json({
        success:
          true,

        message:
          "Learning candidate approved successfully.",

        data:
          candidate,
      });
  };

/* =========================================================
   REJECT LEARNING CANDIDATE
========================================================= */

export const rejectCandidate =
  async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const candidateId =
      getParamString(
        req.params.id
      );

    if (
      !candidateId
    ) {
      res
        .status(400)
        .json({
          success:
            false,

          message:
            "Candidate ID is required.",
        });

      return;
    }

    const reason =
      typeof req.body?.reason ===
      "string"
        ? req.body.reason
        : undefined;

    const notes =
      typeof req.body?.notes ===
      "string"
        ? req.body.notes
        : undefined;

    const candidate =
      await rejectLearningCandidate(
        candidateId,
        {
          reason,

          notes,
        }
      );

    if (
      !candidate
    ) {
      res
        .status(404)
        .json({
          success:
            false,

          message:
            "Learning candidate not found.",
        });

      return;
    }

    res
      .status(200)
      .json({
        success:
          true,

        message:
          "Learning candidate rejected successfully.",

        data:
          candidate,
      });
  };

/* =========================================================
   DISABLE LEARNING CANDIDATE
========================================================= */

export const disableCandidate =
  async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const candidateId =
      getParamString(
        req.params.id
      );

    if (
      !candidateId
    ) {
      res
        .status(400)
        .json({
          success:
            false,

          message:
            "Candidate ID is required.",
        });

      return;
    }

    const candidate =
      await disableLearningCandidate(
        candidateId
      );

    if (
      !candidate
    ) {
      res
        .status(404)
        .json({
          success:
            false,

          message:
            "Learning candidate not found.",
        });

      return;
    }

    res
      .status(200)
      .json({
        success:
          true,

        message:
          "Learning candidate disabled successfully.",

        data:
          candidate,
      });
  };

/* =========================================================
   RESET LEARNING CANDIDATE
========================================================= */

export const resetCandidate =
  async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const candidateId =
      getParamString(
        req.params.id
      );

    if (
      !candidateId
    ) {
      res
        .status(400)
        .json({
          success:
            false,

          message:
            "Candidate ID is required.",
        });

      return;
    }

    const candidate =
      await resetLearningCandidate(
        candidateId
      );

    if (
      !candidate
    ) {
      res
        .status(404)
        .json({
          success:
            false,

          message:
            "Learning candidate not found.",
        });

      return;
    }

    res
      .status(200)
      .json({
        success:
          true,

        message:
          "Learning candidate reset to candidate status.",

        data:
          candidate,
      });
  };
  

  /* =========================================================
   EXPORT APPROVED LEARNING CANDIDATES
========================================================= */

export const exportLearningCandidates =
  async (
    _req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result =
        await exportApprovedLearningCandidates();

      res
        .status(200)
        .json({
          success: true,

          message:
            "Approved learning candidates exported successfully.",

          data:
            result,
        });
    } catch (
      error
    ) {
      console.error(
        "[CS Learning Controller] Export failed:",
        error
      );

      res
        .status(500)
        .json({
          success: false,

          message:
            error instanceof Error
              ? error.message
              : "Failed to export learning candidates.",
        });
    }
  };

/* =========================================================
   GET LEARNING EXPORT STATUS
========================================================= */

export const getLearningExportInfo =
  async (
    _req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result =
        await getLearningExportStatus();

      res
        .status(200)
        .json({
          success: true,

          data:
            result,
        });
    } catch (
      error
    ) {
      console.error(
        "[CS Learning Controller] Export status failed:",
        error
      );

      res
        .status(500)
        .json({
          success: false,

          message:
            error instanceof Error
              ? error.message
              : "Failed to load learning export status.",
        });
    }
  };


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  getLearningCandidates,

  getLearningCandidate,

  approveCandidate,

  rejectCandidate,

  disableCandidate,

  resetCandidate,

  exportLearningCandidates,

  getLearningExportInfo,
};