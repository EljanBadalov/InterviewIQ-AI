import { protect } from "../middleware/authMiddleware";
import { careerChatIdentity } from "../services/careerChatAccess";
import { createConversation, listConversations, getConversation, getConversationMessages, deleteConversation, renameConversation } from "../controllers/careerChatHistoryController";
import {
  Router,
} from "express";

import {
  getCustomerServiceModelInfo,
  predictCustomerIntent,
  sendCustomerMessage,
} from "../controllers/csController";


const router =
  Router();

// Protect only this router's namespace, not unrelated API routes.
router.use("/cs", protect, (req, _res, next) => {
  careerChatIdentity.run(String(req.user!._id), next);
});
router.post("/cs/conversations", createConversation);
router.get("/cs/conversations", listConversations);
router.get("/cs/conversations/:conversationId/messages", getConversationMessages);
router.get("/cs/conversations/:conversationId", getConversation);
router.delete("/cs/conversations/:conversationId", deleteConversation);
router.patch("/cs/conversations/:conversationId", renameConversation);

router.post(
  "/cs/predict",
  predictCustomerIntent
);

router.post(
  "/cs/chat",
  sendCustomerMessage
);


router.get(
  "/cs/model-info",
  getCustomerServiceModelInfo
);

export default router;