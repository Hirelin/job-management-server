import express from "express";
import type { Request, Response } from "express";
import recruiterMiddleware from "../middleware/recruiter";
import { getSessionContext } from "../utils/utils";
import { db } from "../db/db";
const router = express.Router();

// REST API Routes
router
  .use(recruiterMiddleware)
  .post("/requirements", async (req: Request, res: Response) => {
    const session = getSessionContext(req);

    if (session?.status == "unauthenticated") {
      return res.status(401).json({
        message: "Unauthorized access. Please log in.",
      });
    }

    const processedData = req.body.result.processed_result;
    const jobId = req.body.session.job_id;

    try {
      await db.$queryRawUnsafe<any>(
        `
                UPDATE "JobOpening"
                SET "parsed_requirements" = $1
                WHERE id = $2::uuid
                `,
        JSON.stringify(processedData),
        jobId
      );

      res.status(200).json({
        message: "Requirements received successfully",
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to update job opening",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

export { router as pipelineRouter };
