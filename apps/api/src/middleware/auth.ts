import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { db, sessions, users } from "@quarrel/db";
import { eq } from "drizzle-orm";

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

  // Single JOIN query instead of two sequential queries
  const [result] = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token))
    .limit(1);

  if (!result || result.session.expiresAt < new Date()) {
    return c.json({ error: "Session expired" }, 401);
  }

  c.set("userId", result.user.id);
  c.set("user", result.user);
  c.set("sessionToken", token);
  await next();
});
