import { Hono } from "hono";
import { db, friends, users } from "@quarrel/db";
import { eq, and, or, inArray, lt, desc } from "drizzle-orm";
import { authMiddleware, type AuthEnv } from "../middleware/auth";

const FRIENDS_PAGE_SIZE = 50;

export const friendRoutes = new Hono<AuthEnv>();

friendRoutes.use(authMiddleware);

friendRoutes.post("/:username", async (c) => {
  const targetUsername = c.req.param("username");
  const userId = c.get("userId");

  // Prevent matching block/accept routes
  if (targetUsername === "block") {
    return c.json({ error: "User not found" }, 404);
  }

  // Only select id - that's all we need for the friend request
  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, targetUsername))
    .limit(1);

  if (!targetUser) {
    return c.json({ error: "User not found" }, 404);
  }

  if (targetUser.id === userId) {
    return c.json({ error: "Cannot friend yourself" }, 400);
  }

  // Check for existing friend record (including blocks)
  const [existing] = await db
    .select({ id: friends.id, status: friends.status })
    .from(friends)
    .where(
      or(
        and(eq(friends.userId, userId), eq(friends.friendId, targetUser.id)),
        and(eq(friends.userId, targetUser.id), eq(friends.friendId, userId))
      )
    )
    .limit(1);

  if (existing) {
    if (existing.status === "blocked") {
      return c.json({ error: "Cannot send friend request to this user" }, 403);
    }
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

  // Only select fields needed for validation
  const [request] = await db
    .select({
      id: friends.id,
      friendId: friends.friendId,
      status: friends.status,
    })
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

  // Only select fields needed for ownership check
  const [request] = await db
    .select({
      id: friends.id,
      userId: friends.userId,
      friendId: friends.friendId,
      status: friends.status,
    })
    .from(friends)
    .where(eq(friends.id, friendId))
    .limit(1);

  if (!request) {
    return c.json({ error: "Friend request not found" }, 404);
  }

  if (request.userId !== userId && request.friendId !== userId) {
    return c.json({ error: "Not your friend request" }, 403);
  }

  // Don't allow deleting blocked records via this endpoint - use unblock instead
  if (request.status === "blocked") {
    return c.json({ error: "Cannot delete a block. Use unblock instead" }, 400);
  }

  await db.delete(friends).where(eq(friends.id, friendId));
  return c.json({ success: true });
});

// Block a user
friendRoutes.post("/:username/block", async (c) => {
  const targetUsername = c.req.param("username");
  const userId = c.get("userId");

  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, targetUsername))
    .limit(1);

  if (!targetUser) {
    return c.json({ error: "User not found" }, 404);
  }

  if (targetUser.id === userId) {
    return c.json({ error: "Cannot block yourself" }, 400);
  }

  // Check for existing record between the two users
  const [existing] = await db
    .select({ id: friends.id, status: friends.status, userId: friends.userId })
    .from(friends)
    .where(
      or(
        and(eq(friends.userId, userId), eq(friends.friendId, targetUser.id)),
        and(eq(friends.userId, targetUser.id), eq(friends.friendId, userId))
      )
    )
    .limit(1);

  if (existing) {
    if (existing.status === "blocked") {
      return c.json({ error: "User is already blocked" }, 409);
    }
    // Update existing record to blocked, ensuring the blocker is userId
    await db.delete(friends).where(eq(friends.id, existing.id));
  }

  // Create a new block record with the blocker as userId
  const [block] = await db
    .insert(friends)
    .values({
      userId,
      friendId: targetUser.id,
      status: "blocked",
    })
    .returning();

  return c.json({ block }, 201);
});

// Unblock a user
friendRoutes.delete("/:username/block", async (c) => {
  const targetUsername = c.req.param("username");
  const userId = c.get("userId");

  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, targetUsername))
    .limit(1);

  if (!targetUser) {
    return c.json({ error: "User not found" }, 404);
  }

  // Only the blocker can unblock - find a block record where userId is the blocker
  const [block] = await db
    .select({ id: friends.id })
    .from(friends)
    .where(
      and(
        eq(friends.userId, userId),
        eq(friends.friendId, targetUser.id),
        eq(friends.status, "blocked")
      )
    )
    .limit(1);

  if (!block) {
    return c.json({ error: "Block not found" }, 404);
  }

  await db.delete(friends).where(eq(friends.id, block.id));
  return c.json({ success: true });
});

friendRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const cursor = c.req.query("cursor");
  const limit = Math.min(
    parseInt(c.req.query("limit") || String(FRIENDS_PAGE_SIZE)),
    FRIENDS_PAGE_SIZE
  );

  const allFriends = await db
    .select()
    .from(friends)
    .where(
      cursor
        ? and(
            or(eq(friends.userId, userId), eq(friends.friendId, userId)),
            lt(friends.createdAt, new Date(cursor))
          )
        : or(eq(friends.userId, userId), eq(friends.friendId, userId))
    )
    .orderBy(desc(friends.createdAt))
    .limit(limit);

  const userIds = [
    ...new Set(allFriends.flatMap((f) => [f.userId, f.friendId])),
  ];

  const friendUsers =
    userIds.length > 0
      ? await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
            status: users.status,
          })
          .from(users)
          .where(
            userIds.length === 1
              ? eq(users.id, userIds[0])
              : inArray(users.id, userIds)
          )
      : [];

  const userMap = new Map(friendUsers.map((u) => [u.id, u]));

  const enrichedFriends = allFriends.map((f) => ({
    ...f,
    ...(f.userId === userId
      ? { friend: userMap.get(f.friendId) }
      : { user: userMap.get(f.userId) }),
  }));

  const nextCursor =
    allFriends.length === limit
      ? allFriends[allFriends.length - 1].createdAt?.toISOString()
      : null;

  return c.json({ friends: enrichedFriends, nextCursor });
});
