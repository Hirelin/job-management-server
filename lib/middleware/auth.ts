import { Request, Response, NextFunction } from "express";
import { getServerSession } from "../utils/utils";

const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await getServerSession(req);

  if (session.status === "unauthenticated") {
    res.status(401).json({
      error: "Unauthorized",
      message:
        session.error || "You must be logged in to access this resource.",
    });
    return;
  }

  (req as any).session = session;

  next();
};

export default authMiddleware;
