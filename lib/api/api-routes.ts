import express from "express";
import path from "path";
const router = express.Router();

// REST API Routes
router.get("/ping", (req: any, res: any) => {
  res.status(200).send({ message: "pong" });
});

router.get("/", (req: any, res: any) => {
  res.sendFile(path.join(__dirname, "..", "..", "public", "index.html"));
});

export { router as apiRouter };
