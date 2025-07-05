import { Request, Response, NextFunction } from "express";
import { ServerSessionReturn } from "../utils/types";
import { getSessionContext } from "../utils/utils";

const recruiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = getSessionContext(req);

  if (!session || session.status === "unauthenticated") {
    res.status(401).json({
      error: "Unauthorized",
      message:
        session?.error || "You must be logged in to access this resource.",
    });
    return;
  }

  if (session.status === "authenticated" && session.data.recruiter === null) {
    res.status(403).json({
      error: "Forbidden",
      message: "You do not have permission to access this resource.",
    });
    return;
  }

  next();
};

export default recruiterMiddleware;
