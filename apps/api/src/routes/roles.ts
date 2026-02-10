import { Hono } from "hono";
import { db, roles, members, memberRoles, servers } from "@quarrel/db";
import { createRoleSchema, updateRoleSchema } from "@quarrel/shared";
import { eq, and, asc } from "drizzle-orm";
import { authMiddleware, type AuthEnv } from "../middleware/auth";

export const roleRoutes = new Hono<AuthEnv>();

roleRoutes.use(authMiddleware);

// Create role (owner only)
roleRoutes.post("/servers/:serverId/roles", async (c) => {
  const serverId = c.req.param("serverId");
  const userId = c.get("userId");

  const [server] = await db
    .select({ id: servers.id, ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  if (server.ownerId !== userId) {
    return c.json({ error: "Only the owner can create roles" }, 403);
  }

  const body = await c.req.json();
  const parsed = createRoleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  // Get next position
  const existing = await db
    .select({ position: roles.position })
    .from(roles)
    .where(eq(roles.serverId, serverId))
    .orderBy(asc(roles.position));

  const nextPosition = existing.length > 0 ? existing[existing.length - 1].position + 1 : 0;

  const [role] = await db
    .insert(roles)
    .values({
      serverId,
      name: parsed.data.name,
      color: parsed.data.color,
      permissions: parsed.data.permissions,
      position: nextPosition,
    })
    .returning();

  return c.json({ role }, 201);
});

// List roles for a server
roleRoutes.get("/servers/:serverId/roles", async (c) => {
  const serverId = c.req.param("serverId");
  const userId = c.get("userId");

  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.serverId, serverId)))
    .limit(1);

  if (!member) {
    return c.json({ error: "Not a member of this server" }, 403);
  }

  const serverRoles = await db
    .select()
    .from(roles)
    .where(eq(roles.serverId, serverId))
    .orderBy(asc(roles.position));

  return c.json({ roles: serverRoles });
});

// Update role
roleRoutes.patch("/roles/:id", async (c) => {
  const roleId = c.req.param("id");
  const userId = c.get("userId");

  const [role] = await db
    .select({ id: roles.id, serverId: roles.serverId })
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1);

  if (!role) {
    return c.json({ error: "Role not found" }, 404);
  }

  const [server] = await db
    .select({ id: servers.id, ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, role.serverId))
    .limit(1);

  if (!server || server.ownerId !== userId) {
    return c.json({ error: "Only the owner can update roles" }, 403);
  }

  const body = await c.req.json();
  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [updated] = await db
    .update(roles)
    .set(parsed.data)
    .where(eq(roles.id, roleId))
    .returning();

  return c.json({ role: updated });
});

// Delete role (owner only)
roleRoutes.delete("/roles/:id", async (c) => {
  const roleId = c.req.param("id");
  const userId = c.get("userId");

  const [role] = await db
    .select({ id: roles.id, serverId: roles.serverId })
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1);

  if (!role) {
    return c.json({ error: "Role not found" }, 404);
  }

  const [server] = await db
    .select({ id: servers.id, ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, role.serverId))
    .limit(1);

  if (!server || server.ownerId !== userId) {
    return c.json({ error: "Only the owner can delete roles" }, 403);
  }

  // Check if it's the only role
  const serverRoles = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.serverId, role.serverId));

  if (serverRoles.length <= 1) {
    return c.json({ error: "Cannot delete the only role" }, 400);
  }

  // Remove all member-role assignments first
  await db.delete(memberRoles).where(eq(memberRoles.roleId, roleId));
  await db.delete(roles).where(eq(roles.id, roleId));

  return c.json({ success: true });
});

// Assign role to member
roleRoutes.put("/servers/:serverId/members/:userId/roles/:roleId", async (c) => {
  const serverId = c.req.param("serverId");
  const targetUserId = c.req.param("userId");
  const roleId = c.req.param("roleId");
  const userId = c.get("userId");

  const [server] = await db
    .select({ id: servers.id, ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  if (server.ownerId !== userId) {
    return c.json({ error: "Only the owner can assign roles" }, 403);
  }

  // Verify role belongs to this server
  const [role] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.serverId, serverId)))
    .limit(1);

  if (!role) {
    return c.json({ error: "Role not found in this server" }, 404);
  }

  // Find the member
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.userId, targetUserId), eq(members.serverId, serverId)))
    .limit(1);

  if (!member) {
    return c.json({ error: "Member not found" }, 404);
  }

  // Check if already assigned
  const [existing] = await db
    .select({ memberId: memberRoles.memberId })
    .from(memberRoles)
    .where(and(eq(memberRoles.memberId, member.id), eq(memberRoles.roleId, roleId)))
    .limit(1);

  if (existing) {
    return c.json({ error: "Role already assigned" }, 409);
  }

  await db.insert(memberRoles).values({
    memberId: member.id,
    roleId,
  });

  return c.json({ success: true }, 201);
});

// Remove role from member
roleRoutes.delete("/servers/:serverId/members/:userId/roles/:roleId", async (c) => {
  const serverId = c.req.param("serverId");
  const targetUserId = c.req.param("userId");
  const roleId = c.req.param("roleId");
  const userId = c.get("userId");

  const [server] = await db
    .select({ id: servers.id, ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  if (server.ownerId !== userId) {
    return c.json({ error: "Only the owner can remove roles" }, 403);
  }

  // Find the member
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.userId, targetUserId), eq(members.serverId, serverId)))
    .limit(1);

  if (!member) {
    return c.json({ error: "Member not found" }, 404);
  }

  await db
    .delete(memberRoles)
    .where(and(eq(memberRoles.memberId, member.id), eq(memberRoles.roleId, roleId)));

  return c.json({ success: true });
});
