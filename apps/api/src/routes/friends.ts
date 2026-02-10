import { Hono } from "hono";
import { db, friends, users } from "@quarrel/db";
import { eq, and, or } from "drizzle-orm";
import { authMiddleware, type AuthEnv } from "../middleware/auth";

export const friendRoutes = new Hono<AuthEnv>();

friendRoutes.use(authMiddleware);

friendRoutes.post("/:username", async (c) => {
  const targetUsername = c.req.param("username");
  const userId = c.get("userId");

  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.username, targetUsername))
    .limit(1);

  if (!targetUser) {
    return c.json({ error: "User not found" }, 404);
  }

  if (targetUser.id === userId) {
    return c.json({ error: "Cannot friend yourself" }, 400);
  }

  const [existing] = await db
    .select()
    .from(friends)
    .where(
      or(
        and(eq(friends.userId, userId), eq(friends.friendId, targetUser.id)),
        and(eq(friends.userId, targetUser.id), eq(friends.friendId, userId))
      )
    )
    .limit(1);

  if (existing) {
    return c.json({ error: "Friend request already exists" }, 409);
  }

  const [request] = await db
    .insert(friends)
    .values({
      userId,
      friendId: targetUser.id,
      status: "pending",
    })
    .returning();

  return c.json({ friend: request }, 201);
});

friendRoutes.patch("/:id/accept", async (c) => {
  const friendId = c.req.param("id");
  const userId = c.get("userId");

  const [request] = await db
    .select()
    .from(friends)
    .where(eq(friends.id, friendId))
    .limit(1);

  if (!request) {
    return c.json({ error: "Friend request not found" }, 404);
  }

  if (request.friendId !== userId) {
    return c.json({ error: "Can only accept requests sent to you" }, 403);
  }

  if (request.status !== "pending") {
    return c.json({ error: "Request is not pending" }, 400);
  }

  const [updated] = await db
    .update(friends)
    .set({ status: "accepted" })
    .where(eq(friends.id, friendId))
    .returning();

  return c.json({ friend: updated });
});

friendRoutes.delete("/:id", async (c) => {
  const friendId = c.req.param("id");
  const userId = c.get("userId");

  const [request] = await db
    .select()
    .from(friends)
    .where(eq(friends.id, friendId))
    .limit(1);

  if (!request) {
    return c.json({ error: "Friend request not found" }, 404);
  }

  if (request.userId !== userId && request.friendId !== userId) {
    return c.json({ error: "Not your friend request" }, 403);
  }

  await db.delete(friends).where(eq(friends.id, friendId));
  return c.json({ success: true });
});

friendRoutes.get("/", async (c) => {
  const userId = c.get("userId");

  const allFriends = await db
    .select()
    .from(friends)
    .where(or(eq(friends.userId, userId), eq(friends.friendId, userId)));

  return c.json({ friends: allFriends });
});
