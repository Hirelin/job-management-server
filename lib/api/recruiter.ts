import express from "express";
import { multipleFileUpload } from "../middleware/upload";
import { env } from "../env";
import { JobType, UploadType, JobStatus } from "../../generated/prisma";
import { db } from "../db/db";
import { createJobSchema } from "../utils/zod";
import { z } from "zod";
import { getCookies, getSessionContext } from "../utils/utils";
import { pushEvent } from "../db/redis";
import { Event } from "../utils/types";
import { EventType, SESSION_TOKEN_NAME } from "../utils/constants";
import { uploadFile } from "../utils/upload";

const router = express.Router();

// REST API Routes

router.post(
  "/create",
  multipleFileUpload([
    { name: "requirementsFile", required: false },
    { name: "layoutReferenceFile", required: true },
  ]),
  async (req, res) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const requirementsFile = files?.requirementsFile?.[0];
    const layoutReferenceFile = files?.layoutReferenceFile?.[0];

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
    let requirementsUploadId: string | null = null;
    let layoutReferenceUploadId: string | null = null;

    // Handle file uploads in parallel
    const uploadPromises: Promise<any>[] = [];

    if (requirementsFile) {
      uploadPromises.push(
        uploadFile(
          requirementsFile,
          UploadType.requirements,
          session.data.id
        ).then((fileUpload) => ({ type: "requirements", result: fileUpload }))
      );
    }

    if (layoutReferenceFile) {
      uploadPromises.push(
        uploadFile(
          layoutReferenceFile,
          UploadType.layoutTemplate,
          session.data.id
        ).then((fileUpload) => ({ type: "layoutTemplate", result: fileUpload }))
      );
    }

    // Wait for all uploads to complete
    if (uploadPromises.length > 0) {
      try {
        const uploadResults = await Promise.all(uploadPromises);

        for (const upload of uploadResults) {
          if (upload.result === null) {
            return res.status(500).json({
              success: false,
              error: "File Upload Error",
              message: `Failed to upload the ${upload.type} file.`,
            });
          }

          if (upload.type === "requirements") {
            // Use the URL or extract ID from URL if uploadId is undefined
            requirementsUploadId = upload.result.uploadId || upload.result.url;
          } else if (upload.type === "layoutTemplate") {
            // Use the URL or extract ID from URL if uploadId is undefined
            layoutReferenceUploadId =
              upload.result.uploadId || upload.result.url;
          }
        }
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: "File Upload Error",
          message: "Failed to upload files.",
        });
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

      // console.log(layoutReferenceUploadId, requirementsUploadId);
      console.log(data.deadline);

      // create jobopening with both files
      if (requirementsUploadId && layoutReferenceUploadId) {
        result = await db.$queryRawUnsafe<any>(
          `
          INSERT INTO "JobOpening"
            (title, company, location, type, description, contact, address, "recruiter_id", "requirements_file_id", "layout_template_id", "deadline")
          VALUES
            ($1, $2, $3, $4::"JobType", $5, $6, $7, $8::uuid, $9::uuid, $10::uuid, $11::date)
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
          requirementsUploadId,
          layoutReferenceUploadId,
          data.deadline
        );
      } else if (layoutReferenceUploadId) {
        // Only layout reference file
        result = await db.$queryRawUnsafe<any>(
          `
          INSERT INTO "JobOpening"
            (title, company, location, type, description, contact, address, "recruiter_id", "layout_template_id", "deadline")
          VALUES
            ($1, $2, $3, $4::"JobType", $5, $6, $7, $8::uuid, $9::uuid, $10::date)
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
          layoutReferenceUploadId,
          data.deadline
        );
      } else {
        // No files case - this shouldn't happen since layoutReferenceFile is required
        return res.status(400).json({
          success: false,
          error: "Missing Required File",
          message: "Layout reference file is required.",
        });
      }

      // Check if result is empty
      if (!result || result.length === 0) {
        return res.status(500).json({
          success: false,
          error: "Database Error",
          message: "Failed to create job - no data returned.",
        });
      }

      // Push to redis - you might want to include both files
      const cookies = getCookies(req);
      const sessionId = cookies?.[SESSION_TOKEN_NAME] || "";

      const requirementsBase64 = requirementsFile?.buffer
        ? Buffer.from(requirementsFile.buffer).toString("base64")
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
        file: requirementsBase64,
      };

      try {
        await pushEvent(eventData);
      } catch (error) {
        console.error("Failed to push event to Redis:", error);
      }

      res.status(200).json({
        message: "Job created successfully",
        data: {
          requirementsFile: requirementsFile
            ? requirementsFile.originalname
            : null,
          layoutReferenceFile: layoutReferenceFile
            ? layoutReferenceFile.originalname
            : null,
          ...data,
        },
        job: result,
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
  }
);

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

    console.log(jobList);

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
        applicantsCount: job._count.applications, // Add the applicant count
        requirements: job.parsedRequirements || null, // Added to match interface
        deadline: job.deadline,
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

router.put("/update-job-status", async (req, res) => {
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
    success: true,
    message: "status updated successfully",
  });
});

router.get("/applications", async (req, res) => {
  const session = getSessionContext(req);
  const applicationStatuses = req.query.applicationStatus as
    | string[]
    | string
    | undefined;
  const jobStatuses = req.query.jobStatus as string[] | string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

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
    // Build where clause for filtering
    const whereClause: any = {
      jobOpening: {
        recruiterId: session?.data.recruiter?.id,
      },
    };

    // Handle application status filtering
    if (applicationStatuses) {
      const statusArray = Array.isArray(applicationStatuses)
        ? applicationStatuses
        : [applicationStatuses];
      whereClause.status = {
        in: statusArray,
      };
    }

    // Handle job status filtering
    if (jobStatuses) {
      const jobStatusArray = Array.isArray(jobStatuses)
        ? jobStatuses
        : [jobStatuses];
      whereClause.jobOpening.status = {
        in: jobStatusArray,
      };
    }

    // Get total count for pagination
    const totalCount = await db.application.count({
      where: whereClause,
    });

    // Get applications with pagination
    const applications = await db.application.findMany({
      where: whereClause,
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
            status: true,
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
      skip: (page - 1) * limit,
      take: limit,
    });

    const hasMore = totalCount > page * limit;

    res.status(200).json({
      message: "Applications fetched successfully",
      status: "success",
      data: applications,
      pagination: {
        total: totalCount,
        page,
        limit,
        hasMore,
      },
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

router.get("/application-by-id", async (req, res) => {
  const jobId = req.query.jobId as string | null;

  if (jobId === null) {
    return res.status(400).json({
      message: "Job ID required",
      success: false,
    });
  }

  try {
    const applications = await db.application.findMany({
      where: { jobOpeningId: jobId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        resume: {
          select: {
            id: true,
            url: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: "Successfully fetch job applications",
      data: applications,
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch applications",
      success: false,
    });
  }
});

router.get("/job-by-id", async (req, res) => {
  const jobId = req.query.jobId as string | null;

  if (jobId === null) {
    res.status(400).json({
      message: "Job ID required",
      success: false,
    });
    return;
  }

  const job = await db.jobOpening.findFirst({
    where: { id: jobId },
    include: {
      requirements: {
        select: {
          id: true,
          name: true,
          url: true,
          filetype: true,
        },
      },
      layoutTemplate: {
        select: {
          id: true,
          name: true,
          url: true,
          filetype: true,
        },
      },
      recruiter: {
        select: {
          id: true,
          name: true,
          organization: true,
          position: true,
          user: {
            select: {
              email: true,
              image: true,
            },
          },
        },
      },
      applications: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          contentScore: true,
          layoutScore: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          resume: {
            select: {
              id: true,
              url: true,
            },
          },
        },
      },
    },
  });

  return res.status(200).json({
    message: "Successfully fetched job",
    data: job,
    success: true,
  });
});

router.put("/update-job", async (req, res) => {
  const jobId = req.query.jobId as string | null;
  const body = req.body;

  if (jobId === null) {
    return res.status(400).json({
      message: "Job ID is required",
      success: false,
    });
  }

  try {
    const updatedJob = await db.jobOpening.update({
      where: { id: jobId },
      data: {
        title: body.title,
        company: body.company,
        location: body.location,
        type: body.type as JobType,
        description: body.description,
        contact: body.contact,
        address: body.address,
        deadline: body.deadline ? new Date(body.deadline) : null,
        status: body.status as JobStatus,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
      },
    });

    res.status(200).json({
      message: "Job updated successfully",
      data: updatedJob,
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update job",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/shortlist-candidates", async (req, res) => {
  const body = req.body as {
    shortlistCount: number | null;
    jobId: string | null;
  };

  if (body.jobId === null || body.shortlistCount === null) {
    return res.status(400).json({
      message: "Job ID and shortlist count are required",
      success: false,
    });
  }

  try {
    const isShortlisted = await db.application.findFirst({
      where: {
        jobOpeningId: body.jobId,
        status: {
          not: "pending",
        },
      },
    });

    if (isShortlisted) {
      return res.status(400).json({
        message: "Shortlisting is already done for this job",
        success: false,
      });
    }

    let applications = await db.application.findMany({
      where: {
        jobOpeningId: body.jobId,
      },
    });

    applications = applications.sort((a, b) => {
      return b.contentScore + b.layoutScore - (a.contentScore + a.layoutScore);
    });

    applications = applications.slice(0, body.shortlistCount);

    const updatedApplications = await db.application.updateMany({
      where: {
        id: {
          in: applications.map((app) => app.id),
        },
      },
      data: {
        status: "accepted",
      },
    });

    if (updatedApplications.count === 0) {
      return res.status(400).json({
        message: "No applications were shortlisted",
        success: false,
      });
    }

    res.status(200).json({
      message: `Shortlisted ${updatedApplications.count} candidates successfully`,
      data: {
        shortlistedCount: updatedApplications.count,
        jobId: body.jobId,
      },
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to shortlist candidates",
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    });
  }
});

export { router as recruiterRouter };
