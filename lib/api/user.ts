import express from "express";
import path from "path";
import { getSessionContext } from "../utils/utils";
import { db } from "../db/db";
import { fileUpload } from "../middleware/upload";
import { uploadFile } from "../utils/upload";
import { UploadType } from "../../generated/prisma";
const router = express.Router();

// REST API Routes
router.get("/get-profile-info", async (req, res) => {
  const session = getSessionContext(req);

  if (session?.status === "unauthenticated" || session?.data.id === null) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "You must be logged in to access this resource.",
    });
  }

  const user = await db.user.findUnique({
    where: {
      id: session?.data.id,
    },
    // select: {
    //   id: true,
    //   name: true,
    //   email: true,
    //   image: true,
    //   emailVerified: true,
    // },
    include: {
      recruiter: {
        select: {
          id: true,
        },
      },
      applications: {
        select: {
          id: true,
          jobOpening: {
            select: {
              id: true,
              title: true,
              company: true,
              status: true,
            },
          },
          layoutScore: true,
          contentScore: true,
        },
      },
    },
  });
});

router.get("/resume-list", async (req, res) => {
  const session = getSessionContext(req);

  try {
    const resumeList = await db.uploads.findMany({
      where: {
        userId: session?.data?.id,
        uploadType: "resume",
      },
    });

    res.status(200).json({
      message: "Resume list fetched successfully",
      data: resumeList,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch resume list",
      error: error,
    });
  }
});

router.post("/upload-resume", fileUpload("resumeFile"), async (req, res) => {
  const file = req.file;
  const session = getSessionContext(req);

  if (file === undefined || file === null) {
    return res.status(400).json({
      message: "No file uploaded",
      error: "File is required",
    });
  }

  if (session?.data?.id === undefined || session?.data?.id === null) {
    return res.status(401).json({
      message: "Unauthorized",
      error: "You must be logged in to upload a resume.",
    });
  }

  try {
    const newResume = await uploadFile(
      file,
      UploadType.resume,
      session.data.id
    );

    res.status(201).json({
      message: "Resume uploaded successfully",
      data: newResume,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to upload resume",
      error: error,
    });
  }
});

router.get("/profile", async (req, res) => {
  const session = getSessionContext(req);

  if (
    session?.status === "unauthenticated" ||
    !session ||
    session?.data.id === null
  ) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "You must be logged in to access this resource.",
    });
  }

  try {
    const userProfile = await db.user.findFirst({
      where: { id: session.data.id },
      include: {
        uploads: {
          where: { uploadType: "resume" },
          select: {
            id: true,
            filetype: true,
            name: true,
            url: true,
            _count: true,
          },
          orderBy: { createdAt: "desc" },
        },
        applications: {
          select: {
            jobOpening: {
              select: {
                id: true,
                title: true,
                company: true,
              },
            },
            id: true,
            createdAt: true,
            status: true,
            layoutScore: true,
            contentScore: true,
            learningPlan: {
              select: {
                id: true,
                planDetails: true,
                createdAt: true,
                _count: true,
                assessments: {
                  select: {
                    id: true,
                    title: true,
                    description: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "User profile fetched successfully.",
      data: userProfile,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "Failed to fetch user profile.",
    });
  }
});
export { router as userRouter };
