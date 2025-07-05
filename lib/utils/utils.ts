import type { Request } from "express";
import type { ServerSessionReturn, User } from "../utils/types";
import { SESSION_TOKEN_NAME } from "./constants";
import { env } from "../env";

export function getCookies(req: Request): Record<string, string> {
  const cookies = req.headers.cookie
    ?.split(";")
    .map((cookie) => cookie.trim().split("="))
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

  return cookies || {};
}

export async function getServerSession(
  req: Request
): Promise<ServerSessionReturn> {
  const cookies = getCookies(req);
  const sessionId = cookies?.[SESSION_TOKEN_NAME] || "";

  const res = await fetch(`${env.AUTH_SERVER}/api/auth/session`, {
    method: "GET",
    headers: {
      Cookie: `session_id=${sessionId};`,
    },
  });

  if (res.status === 200) {
    const data = await res.json();
    return {
      data: data.session.user as User,
      status: "authenticated",
      error: null,
    };
  } else {
    return {
      data: null,
      status: "unauthenticated",
      error: await res.text(),
    };
  }
}

export function getSessionContext(req: Request): ServerSessionReturn | null {
  return (req as any).session || null;
}
