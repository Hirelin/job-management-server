import express from "express";

import recruiterMiddleware from "../middleware/recruiter";
import { apiRouter } from "./api-routes";
import { recruiterRouter } from "./recruiter";
import authMiddleware from "../middleware/auth";
import { jobsRouter } from "./jobs";
import { pipelineRouter } from "./pipeline";
import { applicationRouter } from "./application";
import { userRouter } from "./user";

const router = express.Router();

router.use(apiRouter);
router.use(jobsRouter);
router.use(authMiddleware).use("/pipeline_result", pipelineRouter);
router.use(authMiddleware).use(applicationRouter);
router.use(authMiddleware).use("/user", userRouter);
router
  .use(authMiddleware)
  .use(recruiterMiddleware)
  .use("/recruiter", recruiterRouter);

export { router as rootRouter };
