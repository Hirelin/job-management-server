import express from "express";
import path from "path";
import { fileUpload } from "../middleware/upload";
import { getCookies, getSessionContext } from "../utils/utils";
import { UploadType } from "../../generated/prisma";
import { env } from "../env";
import { db } from "../db/db";
import { EventType } from "../utils/constants";
import { Event } from "../utils/types";
import { pushEvent } from "../db/redis";
const router = express.Router();

// REST API Routes
router.post("/apply", fileUpload("resumeFile"), async (req, res) => {
  const session = getSessionContext(req);
  const cookies = getCookies(req);
  const file = req.file;
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

  const isApplied = await db.application.findFirst({
    where: {
      jobOpeningId: data.jobId,
      userId: session?.data?.id,
    },
  });

  if (isApplied) {
    return res.status(400).json({
      success: false,
      error: "Already Applied",
      message: "You have already applied for this job.",
    });
  }

  let uploadId: string | null = null;

  if (file) {
    const formData = new FormData();
    // parser file
    if (file && file.buffer) {
      const blob = new Blob([file.buffer], { type: file.mimetype });
      formData.append("file", blob, file.originalname);
    }
    formData.append("bucket", UploadType.resume);

    // TODO: secure requests
    // upload file
    const fileUpload = await fetch(`${env.SERVER_URL}/api/files/upload`, {
      method: "POST",
      body: formData,
    });

    // create file
    if (fileUpload.status !== 201) {
      return res.status(fileUpload.status).json({
        success: false,
        error: "File Upload Error",
        message: "Failed to upload file",
        details: await fileUpload.text(),
      });
    } else {
      const filedata = await fileUpload.json();

      try {
        const newFile = await db.$queryRawUnsafe<any>(
          `
            INSERT INTO "Uploads" (name, file_type, "uploadType", url)
            VALUES ($1, $2, $3::\"UploadType\", $4)
            RETURNING *;
            `,
          file.originalname,
          file.mimetype,
          UploadType.requirements,
          filedata.file.url
        );
        uploadId = newFile[0].id;
      } catch (error) {
        return res.status(fileUpload.status).json({
          success: false,
          error: "File Upload Error",
          message: "Failed to upload file",
          details: await fileUpload.text(),
        });
      }
    }
  } else {
    return res.status(400).json({
      success: false,
      error: "File Upload Error",
      message: "No file uploaded",
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
    session?.data?.id,
    uploadId,
    "pending", // default status
    0.0, // default layout_score
    0.0 // default content_score
  );

  // Start ML pipeline
  const base64File = file?.buffer
    ? Buffer.from(file.buffer).toString("base64")
    : null;

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

  try {
    // Make sure we're passing the stringified event data
    // TODO: push event to redis
    // await pushEvent(eventData);
  } catch (error) {
    console.error("Failed to push event to Redis:", error);
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
