import { Hono } from "hono";
import { db, members, servers, users, roles, memberRoles } from "@quarrel/db";
import { updateNicknameSchema } from "@quarrel/shared";
import { eq, and, lt, desc } from "drizzle-orm";
import { authMiddleware, type AuthEnv } from "../middleware/auth";

const MEMBERS_PAGE_SIZE = 50;

export const memberRoutes = new Hono<AuthEnv>();

memberRoutes.use(authMiddleware);

memberRoutes.get("/servers/:serverId/members", async (c) => {
  const serverId = c.req.param("serverId");
  const userId = c.get("userId");
  const cursor = c.req.query("cursor");
  const limit = Math.min(
    parseInt(c.req.query("limit") || String(MEMBERS_PAGE_SIZE)),
    MEMBERS_PAGE_SIZE
  );

  // Select only id for membership check
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.serverId, serverId)))
    .limit(1);

  if (!member) {
    return c.json({ error: "Not a member of this server" }, 403);
  }

  const serverMembers = await db
    .select({
      id: members.id,
      userId: members.userId,
      serverId: members.serverId,
      nickname: members.nickname,
      joinedAt: members.joinedAt,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      status: users.status,
      isBot: users.isBot,
    })
    .from(members)
    .innerJoin(users, eq(members.userId, users.id))
    .where(
      cursor
        ? and(
            eq(members.serverId, serverId),
            lt(members.joinedAt, new Date(cursor))
          )
        : eq(members.serverId, serverId)
    )
    .orderBy(desc(members.joinedAt))
    .limit(limit);

  // Fetch role assignments for all members in this page
  const memberIds = serverMembers.map((m) => m.id);
  const roleAssignments = memberIds.length > 0
    ? await db
        .select({
          memberId: memberRoles.memberId,
          roleId: roles.id,
          roleName: roles.name,
          roleColor: roles.color,
          rolePosition: roles.position,
          rolePermissions: roles.permissions,
        })
        .from(memberRoles)
        .innerJoin(roles, eq(memberRoles.roleId, roles.id))
        .where(eq(roles.serverId, serverId))
    : [];

  const rolesByMemberId = new Map<string, { id: string; name: string; color: string | null; position: number; permissions: number }[]>();
  for (const ra of roleAssignments) {
    const arr = rolesByMemberId.get(ra.memberId) || [];
    arr.push({ id: ra.roleId, name: ra.roleName, color: ra.roleColor, position: ra.rolePosition, permissions: ra.rolePermissions });
    rolesByMemberId.set(ra.memberId, arr);
  }

  const result = serverMembers.map((m) => {
    const memberRolesList = (rolesByMemberId.get(m.id) || []).sort((a, b) => a.position - b.position);
    return {
      id: m.id,
      userId: m.userId,
      serverId: m.serverId,
      nickname: m.nickname,
      joinedAt: m.joinedAt,
      user: {
        id: m.userId,
        username: m.username,
        displayName: m.displayName,
        avatarUrl: m.avatarUrl,
        status: m.status,
        isBot: m.isBot,
      },
      roles: memberRolesList,
    };
  });

  const nextCursor =
    serverMembers.length === limit
      ? serverMembers[serverMembers.length - 1].joinedAt?.toISOString()
      : null;

  return c.json({ members: result, nextCursor });
});

memberRoutes.delete("/servers/:serverId/members/:userId", async (c) => {
  const serverId = c.req.param("serverId");
  const targetUserId = c.req.param("userId");
  const userId = c.get("userId");

  // Select only ownerId - that's all we need for the permission check
  const [server] = await db
    .select({ id: servers.id, ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  if (server.ownerId !== userId) {
    return c.json({ error: "Only the server owner can kick members" }, 403);
  }

  if (targetUserId === userId) {
    return c.json({ error: "Cannot kick yourself" }, 400);
  }

  await db
    .delete(members)
    .where(
      and(eq(members.userId, targetUserId), eq(members.serverId, serverId))
    );

  return c.json({ success: true });
});

memberRoutes.patch("/servers/:serverId/members/me/nickname", async (c) => {
  const serverId = c.req.param("serverId");
  const userId = c.get("userId");

  // Check membership
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.serverId, serverId)))
    .limit(1);

  if (!member) {
    return c.json({ error: "Not a member of this server" }, 403);
  }

  const body = await c.req.json();
  const parsed = updateNicknameSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [updated] = await db
    .update(members)
    .set({ nickname: parsed.data.nickname })
    .where(eq(members.id, member.id))
    .returning();

  return c.json({ member: updated });
});
