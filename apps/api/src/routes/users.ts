import { Hono } from "hono";
import { db, users } from "@quarrel/db";
import { updateProfileSchema, avatarPresignSchema } from "@quarrel/shared";
import { eq } from "drizzle-orm";
import { authMiddleware, type AuthEnv } from "../middleware/auth";
import { createPresignedUploadUrl, deleteR2Object, R2_PUBLIC_URL } from "../lib/r2";

export const userRoutes = new Hono<AuthEnv>();

userRoutes.use(authMiddleware);

userRoutes.patch("/me", async (c) => {
  const userId = c.get("userId");

  const body = await c.req.json();
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  // If avatarUrl is being changed, delete old avatar from R2
  if (parsed.data.avatarUrl !== undefined) {
    const [currentUser] = await db
      .select({ avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (currentUser?.avatarUrl) {
      try {
        const key = currentUser.avatarUrl.replace(`${R2_PUBLIC_URL}/`, "");
        await deleteR2Object(key);
      } catch {}
    }
  }

  const [updated] = await db
    .update(users)
    .set(parsed.data)
    .where(eq(users.id, userId))
    .returning();

  const { hashedPassword: _, ...safeUser } = updated;
  return c.json({ user: safeUser });
});

userRoutes.post("/me/avatar/presign", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = avatarPresignSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const ext = parsed.data.contentType.split("/")[1];
  const key = `avatars/${userId}/${crypto.randomUUID()}.${ext}`;
  const { presignedUrl, publicUrl } = await createPresignedUploadUrl(
    key,
    parsed.data.contentType,
    parsed.data.contentLength
  );
  return c.json({ presignedUrl, publicUrl });
});

userRoutes.delete("/me/avatar", async (c) => {
  const userId = c.get("userId");
  const [user] = await db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user?.avatarUrl) {
    try {
      const key = user.avatarUrl.replace(`${R2_PUBLIC_URL}/`, "");
      await deleteR2Object(key);
    } catch {}
  }
  await db
    .update(users)
    .set({ avatarUrl: null })
    .where(eq(users.id, userId));
  return c.json({ success: true });
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
