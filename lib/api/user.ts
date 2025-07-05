import express from "express";
import path from "path";
import { getSessionContext } from "../utils/utils";
import { db } from "../db/db";
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

export { router as userRouter };
