import express from "express";
import { getSessionContext } from "../utils/utils";
import { UploadType } from "../../generated/prisma";
import { db } from "../db/db";
import { EventType } from "../utils/constants";
import { Event } from "../utils/types";
import { pushEvent } from "../db/redis";
const router = express.Router();

// REST API Routes
router.post("/apply", async (req, res) => {
  const session = getSessionContext(req);
  const data = req.body;

  if (session?.data?.id === undefined || session?.data?.id === null) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "You must be logged in to apply for a job.",
    });
  }

  if (data.jobId === undefined || data.jobId === null) {
    return res.status(400).json({
      success: false,
      error: "Bad Request",
      message: "Job ID is required",
    });
  }

  const file = await db.uploads.findFirst({
    where: {
      id: data.resumeId,
      userId: session.data.id,
      uploadType: UploadType.resume,
    },
  });

  if (data.resumeId === undefined || data.resumeId === null || file === null) {
    return res.status(400).json({
      success: false,
      error: "Bad Request",
      message: "Resume ID is required",
    });
  }

  const isApplied = await db.application.findFirst({
    where: {
      jobOpeningId: data.jobId,
      userId: session.data.id,
    },
  });

  if (isApplied) {
    return res.status(400).json({
      success: false,
      error: "Already Applied",
      message: "You have already applied for this job.",
    });
  }

  const application = await db.$queryRawUnsafe<any>(
    `
      INSERT INTO "Application" 
        (job_opening_id, user_id, resume_id, status, layout_score, content_score) 
      VALUES 
        ($1::uuid, $2::uuid, $3::uuid, $4::"ApplicationStatus", $5::float, $6::float)
      RETURNING *;
      `,
    data.jobId,
    session.data.id,
    data.resumeId,
    "pending", // default status
    0.0, // default layout_score
    0.0 // default content_score
  );

  // Fetch file from URL and convert to base64
  let base64File: string | null = null;
  try {
    const response = await fetch(file.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    base64File = Buffer.from(arrayBuffer).toString("base64");

    const eventData: Event = {
      type: EventType.REQUIREMENTS,
      timestamp: new Date().toISOString(),
      session: {
        session_id: session?.data?.id,
        application_id: application[0].id,
      },
      // TODO: add necessary fields
      data: {
        application_id: application[0].id,
      },
      file: base64File ? base64File : null,
    };

    // TODO: push event to redis
    // await pushEvent(eventData);
  } catch (error) {
    console.error("Error fetching or converting file to base64:", error);
    base64File = null;
  }

  res.status(200).json({
    success: true,
    message: "Application submitted successfully",
    data: {
      applicationId: application[0].id, // This should be replaced with actual application ID logic
    },
  });
});

export { router as applicationRouter };
