import {
  Request,
  Response,
} from "express";

import {
  getCSIntentModelInfo,
  predictCSIntent,
} from "../services/csIntentService";

import {
  processCustomerMessage,
} from "../services/csChatService";

/* =========================================================
   PREDICT CUSTOMER SERVICE INTENT
========================================================= */

export const predictCustomerIntent =
  async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        message,
      } = req.body as {
        message?: unknown;
      };

      if (
        typeof message !==
          "string" ||
        !message.trim()
      ) {
        res.status(
          400
        ).json({
          success: false,
          message:
            "Customer message is required.",
        });

        return;
      }

      const prediction =
        await predictCSIntent(
          message
        );

      res.status(
        200
      ).json({
        success: true,
        data: prediction,
      });
    } catch (
      error
    ) {
      console.error(
        "[CS Controller] Intent prediction failed:",
        error
      );

      res.status(
        500
      ).json({
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Failed to predict customer intent.",
      });
    }
  };

/* =========================================================
   CUSTOMER SERVICE CHAT
========================================================= */

export const sendCustomerMessage =
  async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        sessionId,
        message,
        customerId,
        customerName,
        email,
        userId,
      } = req.body as {
        sessionId?: unknown;
        message?: unknown;
        customerId?: unknown;
        customerName?: unknown;
        email?: unknown;
        userId?: unknown;
      };

      if (
        typeof sessionId !==
          "string" ||
        !sessionId.trim()
      ) {
        res.status(
          400
        ).json({
          success: false,
          message:
            "Session ID is required.",
        });

        return;
      }

      if (
        typeof message !==
          "string" ||
        !message.trim()
      ) {
        res.status(
          400
        ).json({
          success: false,
          message:
            "Customer message is required.",
        });

        return;
      }

      const result =
        await processCustomerMessage({
          sessionId:
            sessionId.trim(),

          message:
            message.trim(),

          customerId:
            typeof customerId ===
            "string"
              ? customerId.trim() ||
                undefined
              : undefined,

          customerName:
            typeof customerName ===
            "string"
              ? customerName.trim() ||
                undefined
              : undefined,

          email:
            typeof email ===
            "string"
              ? email.trim() ||
                undefined
              : undefined,

          userId:
            typeof userId ===
            "string"
              ? userId.trim() ||
                undefined
              : undefined,
        });

      res.status(
        200
      ).json({
        success: true,
        data: result,
      });
    } catch (
      error
    ) {
      console.error(
        "[CS Controller] Chat processing failed:",
        error
      );

      res.status(
        500
      ).json({
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Failed to process customer message.",
      });
    }
  };

/* =========================================================
   MODEL INFO / HEALTH CHECK
========================================================= */

export const getCustomerServiceModelInfo =
  async (
    _req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const info =
        await getCSIntentModelInfo();

      res.status(
        200
      ).json({
        success: true,
        data: info,
      });
    } catch (
      error
    ) {
      console.error(
        "[CS Controller] Model info failed:",
        error
      );

      res.status(
        500
      ).json({
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Failed to load customer service model information.",
      });
    }
  };

export default {
  predictCustomerIntent,
  sendCustomerMessage,
  getCustomerServiceModelInfo,
};