import { getOrCreateConversation } from "../services/csMemoryService";
import { CareerChatAccessError, withCareerChatLock } from "../services/careerChatAccess";
import { withCareerChatMetrics } from '../services/careerChatMetrics';
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
      } = (req.body || {}) as {
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

const runSendCustomerMessage =
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
      } = (req.body || {}) as {
        sessionId?: unknown;
        message?: unknown;
        customerId?: unknown;
        customerName?: unknown;
        email?: unknown;
      };

      if (
        typeof sessionId !==
          "string" ||
        (!sessionId.trim() || sessionId.trim().length > 200)
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

      await getOrCreateConversation(sessionId.trim(), { userId: String(req.user!._id) });

      const result =
        await withCareerChatLock(sessionId.trim(), () => processCustomerMessage({
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

          userId: String(req.user!._id),
        }));

      const conversation = await getOrCreateConversation(sessionId.trim(), { userId: String(req.user!._id) });
      res.status(200).json({
        success: true,
        data: {
          ...result,
          conversation: {
            conversationId: String(conversation._id), sessionId: conversation.sessionId,
            userId: String(conversation.userId), title: conversation.title || "New conversation",
            createdAt: conversation.createdAt, updatedAt: conversation.updatedAt
          }
        },
      });
    } catch (
      error
    ) {
      if (error instanceof CareerChatAccessError) {
        res.status(error.status).json({ success: false, message: error.message });
        return;
      }
      if (error instanceof Error && ["VersionError", "DocumentNotFoundError"].includes(error.name)) {
        res.status(409).json({ success: false, message: "Conversation changed. Please reload it." });
        return;
      }
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

export const sendCustomerMessage = (req: Request, res: Response): Promise<void> =>
  withCareerChatMetrics(() => runSendCustomerMessage(req, res), undefined, () => res.statusCode < 400);

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
