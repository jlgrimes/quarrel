import { Hono } from "hono";
import { db, users } from "@quarrel/db";
import { updateProfileSchema } from "@quarrel/shared";
import { eq } from "drizzle-orm";
import { authMiddleware, type AuthEnv } from "../middleware/auth";

export const userRoutes = new Hono<AuthEnv>();

userRoutes.use(authMiddleware);

userRoutes.patch("/me", async (c) => {
  const userId = c.get("userId");

  const body = await c.req.json();
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [updated] = await db
    .update(users)
    .set(parsed.data)
    .where(eq(users.id, userId))
    .returning();

  const { hashedPassword: _, ...safeUser } = updated;
  return c.json({ user: safeUser });
});

userRoutes.get("/:id", async (c) => {
  const targetId = c.req.param("id");

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      status: users.status,
      customStatus: users.customStatus,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ user });
});
