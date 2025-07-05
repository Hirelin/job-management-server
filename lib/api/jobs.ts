import express from "express";
import type { Request, Response } from "express";
import { JobStatus, JobType, Prisma } from "../../generated/prisma";
import { db } from "../db/db";
const router = express.Router();

router.get("/list-jobs", async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | null;
    const location = req.query.location as string | null;
    const page = parseInt((req.query.page as string) || "1");
    const jobTypes = req.query.jobTypes
      ? (req.query.jobTypes as string).split(",")
      : undefined;

    const pageSize = 28; // Number of jobs per page
    const skip = (page - 1) * pageSize;

    // Build the where clause based on filters
    let where: Prisma.JobOpeningWhereInput = {
      status: JobStatus.open,
    };

    if (search) {
      where = {
        AND: [
          { status: JobStatus.open },
          {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { company: { contains: search, mode: "insensitive" } }, // Fixed: company is a string field
            ],
          },
        ],
      };
    }

    if (location) {
      where.location = { contains: location, mode: "insensitive" };
    }

    if (jobTypes?.length) {
      // Convert string[] to JobType[]
      where.type = { in: jobTypes.map((jt) => jt as JobType) };
    }

    // Get total count for pagination
    const totalJobs = await db.jobOpening.count({ where });
    const totalPages = Math.ceil(totalJobs / pageSize);

    // Get filtered jobs
    const jobs = await db.jobOpening.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(jobs);

    // Transform to expected format
    const jobsData = jobs.map((job) => ({
      id: job.id,
      title: job.title,
      company: job.company, // This is already a string
      location: job.location || "",
      type: job.type,
      skills: [], // Added to match interface
      postedDate: job.createdAt.toISOString(),
      description: job.description,
    }));

    const response = {
      jobs: jobsData,
      totalJobs,
      totalPages,
      currentPage: page,
    };

    return res.json(response);
  } catch (error) {
    console.error("Error in list-jobs endpoint:", error);
    return res.status(500).json({
      error: "An error occurred while fetching jobs",
      details:
        process.env.NODE_ENV === "development" ? String(error) : undefined,
    });
  }
});

router.get("/job-details", async (req: Request, res: Response) => {
  const jobId = req.query.id as string | null;

  if (jobId === null) {
    res.status(400).json({
      error: "Job ID is required",
    });
    return;
  }

  const job = await db.jobOpening.findFirst({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      address: true,
      company: true,
      description: true,
      location: true,
      type: true,
      status: true,
    },
  });

  if (!job) {
    res.status(404).json({
      error: "Job not found",
    });
    return;
  }

  res.status(200).json({
    data: job,
  });
});

export { router as jobsRouter };
