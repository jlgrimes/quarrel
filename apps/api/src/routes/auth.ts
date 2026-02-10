import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { db, users, sessions } from "@quarrel/db";
import { loginSchema, registerSchema } from "@quarrel/shared";
import { eq } from "drizzle-orm";
import { authMiddleware, type AuthEnv } from "../middleware/auth";
import { authRateLimit } from "../middleware/rateLimit";

const isProduction = process.env.NODE_ENV === "production";

export const authRoutes = new Hono<AuthEnv>();

authRoutes.post("/register", authRateLimit, async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { username, email, password } = parsed.data;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return c.json({ error: "Email already in use" }, 409);
  }

  const [existingUsername] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existingUsername) {
    return c.json({ error: "Username already taken" }, 409);
  }

  const hashedPassword = await Bun.password.hash(password);

  const [user] = await db
    .insert(users)
    .values({
      username,
      email,
      hashedPassword,
      displayName: username,
    })
    .returning();

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt,
  });

  setCookie(c, "session", sessionId, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  const { hashedPassword: _, ...safeUser } = user;
  // Token returned for WebSocket auth only — REST API uses httpOnly cookie
  return c.json({ user: safeUser, token: sessionId }, 201);
});

authRoutes.post("/login", authRateLimit, async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const valid = await Bun.password.verify(password, user.hashedPassword);
  if (!valid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt,
  });

  setCookie(c, "session", sessionId, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  const { hashedPassword: _, ...safeUser } = user;
  // Token returned for WebSocket auth only — REST API uses httpOnly cookie
  return c.json({ user: safeUser, token: sessionId });
});

authRoutes.post("/logout", authMiddleware, async (c) => {
  const token =
    c.req.header("Authorization")?.replace("Bearer ", "") ??
    (await import("hono/cookie")).getCookie(c, "session");

  if (token) {
    await db.delete(sessions).where(eq(sessions.id, token));
  }

  deleteCookie(c, "session");
  return c.json({ success: true });
});

authRoutes.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  const { hashedPassword: _, ...safeUser } = user;
  return c.json({ user: safeUser });
});
