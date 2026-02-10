import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { db, sessions, users } from "@quarrel/db";
import { eq, gt } from "drizzle-orm";

export type AuthEnv = {
  Variables: {
    userId: string;
    user: typeof users.$inferSelect;
    sessionToken: string;
  };
};

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const token =
    c.req.header("Authorization")?.replace("Bearer ", "") ??
    getCookie(c, "session");

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, token))
    .limit(1);

  if (!session || session.expiresAt < new Date()) {
    return c.json({ error: "Session expired" }, 401);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }

  c.set("userId", user.id);
  c.set("user", user);
  c.set("sessionToken", token);
  await next();
});
