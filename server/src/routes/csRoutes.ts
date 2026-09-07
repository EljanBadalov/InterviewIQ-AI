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