import { Router } from "express";
import {
  addBookmarkController,
  getBookmarksController,
  getBookmarkStatusController,
  removeBookmarkController,
} from "../controllers/bookmarkController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.get(
  "/bookmarks",
  protect,
  getBookmarksController
);

router.get(
  "/bookmarks/:questionId/status",
  protect,
  getBookmarkStatusController
);

router.post(
  "/bookmarks/:questionId",
  protect,
  addBookmarkController
);

router.delete(
  "/bookmarks/:questionId",
  protect,
  removeBookmarkController
);

export default router;