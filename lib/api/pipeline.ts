import express from "express";
import type { Request, Response } from "express";
import recruiterMiddleware from "../middleware/recruiter";
import { getSessionContext } from "../utils/utils";
import { db } from "../db/db";
const router = express.Router();

// REST API Routes
router.post("/skill_gap", async (req: Request, res: Response) => {
  // const session = getSessionContext(req);
  const body = req.body;

  try {
    const updatedApplication = await db.$queryRawUnsafe<any>(
      `UPDATE "Application" 
      SET "parsed_resume" = $1, "layout_score" = $2, "content_score" = $3, "skill_gap" = $4
      WHERE id = $5::uuid 
      RETURNING *`,
      body.result.resume,
      body.result.layout_score,
      body.result.content_score,
      body.result.results,
      body.session.application_id
    );

    res.status(200).json({
      message: "Done",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to process request",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

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
