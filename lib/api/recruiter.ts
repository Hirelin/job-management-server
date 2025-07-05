import express from "express";
import { fileUpload } from "../middleware/upload";
import { env } from "../env";
import { JobType, UploadType, JobStatus } from "../../generated/prisma";
import { db } from "../db/db";
import { createJobSchema } from "../utils/zod";
import { z } from "zod";
import { getCookies, getSessionContext } from "../utils/utils";
import { pushEvent } from "../db/redis";
import { Event } from "../utils/types";
import { EventType, SESSION_TOKEN_NAME } from "../utils/constants";

const router = express.Router();

// REST API Routes
router.post("/create", fileUpload("requiremetsFile"), async (req, res) => {
  const file = req.file;
  const session = getSessionContext(req);

  // check session
  if (
    session?.data?.recruiter?.id === null ||
    session?.data?.recruiter === undefined
  ) {
    return res.status(403).json({
      success: false,
      error: "Forbidden",
      message: "You do not have permission to create a job.",
    });
  }

  let data: z.infer<typeof createJobSchema>;
  let uploadId: string | null = null;

  if (file) {
    const formData = new FormData();
    // parser file
    if (file && file.buffer) {
      const blob = new Blob([file.buffer], { type: file.mimetype });
      formData.append("file", blob, file.originalname);
    }
    formData.append("bucket", UploadType.requirements);

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
        uploadId = newFile.id;
      } catch (error) {
        return res.status(fileUpload.status).json({
          success: false,
          error: "File Upload Error",
          message: "Failed to upload file",
          details: await fileUpload.text(),
        });
      }
    }
  }

  // parse form
  try {
    data = createJobSchema.parse(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: "Failed to parse request body",
      message: "Invalid request data",
    });
  }

  try {
    let result: any;

    // create jobopening
    if (uploadId) {
      result = await db.$queryRawUnsafe<any>(
        `
        INSERT INTO "JobOpening" 
          (title, company, location, type, description, contact, address, "recruiter_id", "requirements_file_id" ) 
        VALUES 
          ($1, $2, $3, $4::\"JobType\", $5, $6, $7, $8::uuid, $9::uuid)
        RETURNING *;
        `,
        data.title,
        data.company,
        data.location,
        data.type,
        data.description,
        data.contact,
        data.address,
        session.data.recruiter?.id,
        uploadId
      );

      // TODO: queue file for parsing
    } else {
      result = await db.$queryRawUnsafe<any>(
        `
        INSERT INTO "JobOpening" 
          (title, company, location, type, description, contact, address, "recruiter_id") 
        VALUES 
          ($1, $2, $3, $4::\"JobType\", $5, $6, $7, $8::uuid)
        RETURNING *;
        `,
        data.title,
        data.company,
        data.location,
        data.type,
        data.description,
        data.contact,
        data.address,
        session.data.recruiter?.id ?? "0"
      );
    }

    // Push to redis
    const cookies = getCookies(req);
    const sessionId = cookies?.[SESSION_TOKEN_NAME] || "";

    const base64File = file?.buffer
      ? Buffer.from(file.buffer).toString("base64")
      : null;

    const eventData: Event = {
      type: EventType.REQUIREMENTS,
      timestamp: new Date().toISOString(),
      session: {
        session_id: sessionId,
        job_id: result[0].id,
      },
      data: {
        title: data.title,
        description: data.description,
      },
      file: base64File ? base64File : null,
    };

    try {
      // Make sure we're passing the stringified event data
      await pushEvent(eventData);
    } catch (error) {
      console.error("Failed to push event to Redis:", error);
    }

    res.status(200).json({
      message: "Job created successfully",
      data: {
        file: file ? file.originalname : null,
        ...data,
      },
      job: result,
      // file: await fileUpload.json(),
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({
      success: false,
      error: "Database Error",
      message: "Failed to create job in database",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get("/recruiter-jobs", async (req, res) => {
  const session = getSessionContext(req);

  // check session
  if (
    session?.data?.recruiter?.id === null ||
    session?.data?.recruiter === undefined
  ) {
    return res.status(403).json({
      success: false,
      error: "Forbidden",
      message: "You do not have permission to list jobs.",
    });
  }

  try {
    // Get jobs with applicant count
    const jobList = await db.jobOpening.findMany({
      where: {
        recruiterId: session.data.recruiter?.id,
      },
      include: {
        _count: {
          select: {
            applications: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Recruiter jobs fetched successfully",
      jobs: jobList.map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        status: job.status,
        location: job.location || "",
        type: job.type,
        postedDate: job.createdAt.toISOString(),
        description: job.description,
        applicantCount: job._count.applications, // Add the applicant count
        requirements: job.parsedRequirements || null, // Added to match interface
      })),
    });
  } catch (error) {
    console.error("Error fetching recruiter jobs:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "An error occurred while fetching recruiter jobs",
      details:
        process.env.NODE_ENV === "development" ? String(error) : undefined,
    });
  }
});

router.post("/update-job-status", async (req, res) => {
  const body = req.body as { jobId: string | null; status: string | null };

  if (body.jobId === null || body.status === null) {
    res.status(400).json({
      success: false,
      error: "Bad Request",
      message: "Job ID and status are required.",
    });
  }

  const updatedJob = await db.jobOpening.update({
    where: { id: body.jobId as string },
    data: { status: body.status as JobStatus },
  });
  res.status(200).json({
    message: "status updated successfully",
  });
});

router.get("/applications", async (req, res) => {
  const session = getSessionContext(req);

  if (
    session?.status == "unauthenticated" ||
    session?.data.id === null ||
    session?.data.recruiter?.id === null
  ) {
    return res.status(401).json({
      message: "Unauthorized access. Please log in.",
    });
  }

  try {
    const applications = await db.application.findMany({
      where: {
        jobOpening: {
          recruiterId: session?.data.recruiter?.id,
        },
      },
      include: {
        resume: {
          select: {
            id: true,
            url: true,
          },
        },
        jobOpening: {
          select: {
            id: true,
            title: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      message: "Applications fetched successfully",
      status: "success",
      data: applications,
    });
    return;
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch applications",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return;
  }
});

export { router as recruiterRouter };
