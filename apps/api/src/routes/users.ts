import { Hono } from "hono";
import { db, users, sessions, userSettings } from "@quarrel/db";
import {
  updateProfileSchema,
  avatarPresignSchema,
  updateUserSettingsSchema,
  changePasswordSchema,
  deleteAccountSchema,
} from "@quarrel/shared";
import { eq } from "drizzle-orm";
import { deleteCookie } from "hono/cookie";
import { authMiddleware, type AuthEnv } from "../middleware/auth";
import { createPresignedUploadUrl, deleteR2Object, R2_PUBLIC_URL } from "../lib/r2";
import { captureException } from "../middleware/errorHandler";

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
  try {
    const { presignedUrl, publicUrl } = await createPresignedUploadUrl(
      key,
      parsed.data.contentType,
      parsed.data.contentLength
    );
    return c.json({ presignedUrl, publicUrl });
  } catch (err) {
    console.error("Avatar presign failed:", err);
    captureException(err, c, { distinctId: userId });
    return c.json({ error: "Failed to generate upload URL" }, 500);
  }
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

// --- User Settings ---

userRoutes.get("/me/settings", async (c) => {
  const userId = c.get("userId");

  const [existing] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  if (existing) {
    return c.json({ settings: existing });
  }

  // Auto-create default settings
  const [created] = await db
    .insert(userSettings)
    .values({ userId })
    .returning();

  return c.json({ settings: created });
});

userRoutes.patch("/me/settings", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = updateUserSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  // Ensure settings row exists
  const [existing] = await db
    .select({ id: userSettings.id })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  if (!existing) {
    await db.insert(userSettings).values({ userId });
  }

  const [updated] = await db
    .update(userSettings)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(userSettings.userId, userId))
    .returning();

  return c.json({ settings: updated });
});

// --- Password Change ---

userRoutes.patch("/me/password", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [user] = await db
    .select({ hashedPassword: users.hashedPassword })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const valid = await Bun.password.verify(
    parsed.data.currentPassword,
    user.hashedPassword
  );
  if (!valid) {
    return c.json({ error: "Current password is incorrect" }, 403);
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return c.json(
      { error: "New password must be different from current password" },
      400
    );
  }

  const newHashed = await Bun.password.hash(parsed.data.newPassword);
  await db
    .update(users)
    .set({ hashedPassword: newHashed })
    .where(eq(users.id, userId));

  return c.json({ success: true });
});

// --- Account Deletion ---

userRoutes.delete("/me/account", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = deleteAccountSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [user] = await db
    .select({
      hashedPassword: users.hashedPassword,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const valid = await Bun.password.verify(
    parsed.data.password,
    user.hashedPassword
  );
  if (!valid) {
    return c.json({ error: "Password is incorrect" }, 403);
  }

  // Clean up avatar from R2
  if (user.avatarUrl) {
    try {
      const key = user.avatarUrl.replace(`${R2_PUBLIC_URL}/`, "");
      await deleteR2Object(key);
    } catch {}
  }

  // Delete user settings
  await db.delete(userSettings).where(eq(userSettings.userId, userId));

  // Delete all sessions
  await db.delete(sessions).where(eq(sessions.userId, userId));

  // Delete the user
  await db.delete(users).where(eq(users.id, userId));

  deleteCookie(c, "session");
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
      bio: users.bio,
      bannerUrl: users.bannerUrl,
      pronouns: users.pronouns,
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
