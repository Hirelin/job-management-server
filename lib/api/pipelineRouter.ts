// import express from "express";
// import type { Request, Response } from "express";
// import recruiterMiddleware from "../middleware/recruiter";
// import { getSessionContext } from "../utils/utils";
// import { db } from "../db/db";

// const router = express.Router();

// router.use(recruiterMiddleware);

// /**
//  *  Update parsed job requirements
//  */
// router.post("/requirements", async (req: Request, res: Response) => {
//   const session = getSessionContext(req);

//   if (session?.status === "unauthenticated") {
//     return res
//       .status(401)
//       .json({ message: "Unauthorized access. Please log in." });
//   }

//   const processedData = req.body.result.processed_result;
//   const jobId = req.body.session.job_id;

//   try {
//     await db.$queryRawUnsafe(
//       `
//       UPDATE "JobOpening"
//       SET "parsed_requirements" = $1
//       WHERE id = $2::uuid
//       `,
//       JSON.stringify(processedData),
//       jobId
//     );

//     res.status(200).json({ message: "Requirements received successfully" });
//   } catch (error) {
//     res.status(500).json({
//       message: "Failed to update job opening",
//       error: error instanceof Error ? error.message : "Unknown error",
//     });
//   }
// });

// /**
//  *  Update skill gap for resume
//  */
// router.post("/skill-gap", async (req: Request, res: Response) => {
//   const session = getSessionContext(req);

//   console.log(session, req.body);

//   res.status(200).json({
//     message: "Done",
//   });

//   // if (session?.status === "unauthenticated") {
//   //   return res.status(401).json({ message: "Unauthorized access. Please log in." });
//   // }

//   // const skillGap = req.body.result.skill_gap;
//   // const applicationId = req.body.session.application_id;

//   // try {
//   //   await db.$queryRawUnsafe(
//   //     `
//   //     UPDATE "Application"
//   //     SET "skill_gap" = $1
//   //     WHERE id = $2::uuid
//   //     `,
//   //     JSON.stringify(skillGap),
//   //     applicationId
//   //   );

//   //   res.status(200).json({ message: "Skill gap updated successfully" });
//   // } catch (error) {
//   //   res.status(500).json({
//   //     message: "Failed to update skill gap",
//   //     error: error instanceof Error ? error.message : "Unknown error",
//   //   });
//   // }
// });

// /**
//  *  Create new learning plan
//  */
// router.post("/learning-plan", async (req: Request, res: Response) => {
//   const { plan_details, application_id, training_id } = req.body;

//   try {
//     const result = await db.$queryRawUnsafe(
//       `
//       INSERT INTO "LearningPlan" (plan_details, application_id, training_id)
//       VALUES ($1, $2::uuid, $3::uuid)
//       RETURNING *;
//       `,
//       JSON.stringify(plan_details),
//       application_id,
//       training_id
//     );

//     res.status(201).json({
//       message: "Learning plan created successfully",
//       data: result[0],
//     });
//   } catch (error) {
//     res.status(500).json({
//       message: "Failed to create learning plan",
//       error: error instanceof Error ? error.message : "Unknown error",
//     });
//   }
// });

// /**
//  *  Update learning plan
//  */
// router.post("/learning-plan/update", async (req: Request, res: Response) => {
//   const { plan_details, application_id } = req.body;

//   try {
//     const result = await db.$queryRawUnsafe(
//       `
//       UPDATE "LearningPlan"
//       SET plan_details = $1
//       WHERE application_id = $2::uuid
//       RETURNING *;
//       `,
//       JSON.stringify(plan_details),
//       application_id
//     );

//     res.status(200).json({
//       message: "Learning plan updated successfully",
//       data: result[0],
//     });
//   } catch (error) {
//     res.status(500).json({
//       message: "Failed to update learning plan",
//       error: error instanceof Error ? error.message : "Unknown error",
//     });
//   }
// });

// /**
//  * Create assessment
//  */
// router.post("/assessment", async (req: Request, res: Response) => {
//   const { title, description, questions, learning_plan_id } = req.body;

//   try {
//     const result = await db.$queryRawUnsafe(
//       `
//       INSERT INTO "Assessment" (title, description, questions, learning_plan_id)
//       VALUES ($1, $2, $3, $4::uuid)
//       RETURNING *;
//       `,
//       title,
//       description,
//       JSON.stringify(questions),
//       learning_plan_id
//     );

//     res.status(201).json({
//       message: "Assessment created successfully",
//       data: result[0],
//     });
//   } catch (error) {
//     res.status(500).json({
//       message: "Failed to create assessment",
//       error: error instanceof Error ? error.message : "Unknown error",
//     });
//   }
// });

// export { router as pipelineRouter };
