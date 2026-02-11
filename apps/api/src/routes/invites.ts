import { Hono } from "hono";
import { db, servers, members, roles, memberRoles, bans, invites } from "@quarrel/db";
import { eq, and, sql } from "drizzle-orm";
import { PERMISSIONS, createInviteSchema } from "@quarrel/shared";
import { authMiddleware, type AuthEnv } from "../middleware/auth";
import { analytics } from "../lib/analytics";

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function hasPermission(userId: string, serverId: string, permission: number): Promise<boolean> {
  const [server] = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);
  if (server?.ownerId === userId) return true;

  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.serverId, serverId)))
    .limit(1);
  if (!member) return false;

  const memberRolesList = await db
    .select({ permissions: roles.permissions })
    .from(memberRoles)
    .innerJoin(roles, eq(memberRoles.roleId, roles.id))
    .where(eq(memberRoles.memberId, member.id));

  const combined = memberRolesList.reduce((acc, r) => acc | r.permissions, 0);
  return (combined & PERMISSIONS.ADMINISTRATOR) !== 0 || (combined & permission) !== 0;
}

export const inviteRoutes = new Hono<AuthEnv>();

inviteRoutes.use(authMiddleware);

// Create invite
inviteRoutes.post("/servers/:serverId/invites", async (c) => {
  const serverId = c.req.param("serverId");
  const userId = c.get("userId");

  const [server] = await db
    .select({ id: servers.id })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  if (!(await hasPermission(userId, serverId, PERMISSIONS.MANAGE_SERVER))) {
    return c.json({ error: "Missing permissions" }, 403);
  }

  let body: { maxAge?: number; maxUses?: number } = {};
  try {
    const raw = await c.req.json();
    const parsed = createInviteSchema.parse(raw);
    body = parsed;
  } catch {
    // defaults are fine
  }

  const code = generateCode();
  const expiresAt = body.maxAge && body.maxAge > 0
    ? new Date(Date.now() + body.maxAge * 1000)
    : null;
  const maxUses = body.maxUses && body.maxUses > 0 ? body.maxUses : null;

  const [invite] = await db
    .insert(invites)
    .values({
      serverId,
      code,
      createdBy: userId,
      expiresAt,
      maxUses,
    })
    .returning();

  analytics.capture(userId, "invite:created", { serverId, code });

  return c.json({ invite }, 201);
});

// List invites for a server
inviteRoutes.get("/servers/:serverId/invites", async (c) => {
  const serverId = c.req.param("serverId");
  const userId = c.get("userId");

  const [server] = await db
    .select({ id: servers.id })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  if (!(await hasPermission(userId, serverId, PERMISSIONS.MANAGE_SERVER))) {
    return c.json({ error: "Missing permissions" }, 403);
  }

  const serverInvites = await db
    .select()
    .from(invites)
    .where(eq(invites.serverId, serverId));

  return c.json({ invites: serverInvites });
});

// Get invite info (public-ish, still requires auth)
inviteRoutes.get("/invites/:code", async (c) => {
  const code = c.req.param("code");

  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.code, code))
    .limit(1);

  if (!invite) {
    return c.json({ error: "Invite not found" }, 404);
  }

  const [server] = await db
    .select({ id: servers.id, name: servers.name, iconUrl: servers.iconUrl })
    .from(servers)
    .where(eq(servers.id, invite.serverId))
    .limit(1);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const [memberCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(members)
    .where(eq(members.serverId, invite.serverId));

  return c.json({
    code: invite.code,
    server: {
      id: server.id,
      name: server.name,
      iconUrl: server.iconUrl,
      memberCount: memberCount.count,
    },
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
  });
});

// Join via invite code
inviteRoutes.post("/invites/:code/join", async (c) => {
  const code = c.req.param("code");
  const userId = c.get("userId");

  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.code, code))
    .limit(1);

  if (!invite) {
    return c.json({ error: "Invite not found" }, 404);
  }

  // Check expired
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return c.json({ error: "Invite has expired" }, 410);
  }

  // Check max uses
  if (invite.maxUses && invite.maxUses > 0 && invite.uses >= invite.maxUses) {
    return c.json({ error: "Invite has reached maximum uses" }, 410);
  }

  // Check banned
  const [ban] = await db
    .select({ id: bans.id })
    .from(bans)
    .where(and(eq(bans.userId, userId), eq(bans.serverId, invite.serverId)))
    .limit(1);

  if (ban) {
    return c.json({ error: "You are banned from this server" }, 403);
  }

  // Check already a member
  const [existing] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.serverId, invite.serverId)))
    .limit(1);

  if (existing) {
    return c.json({ error: "Already a member of this server" }, 409);
  }

  // Join
  await db.insert(members).values({
    userId,
    serverId: invite.serverId,
  });

  // Increment uses
  await db
    .update(invites)
    .set({ uses: invite.uses + 1 })
    .where(eq(invites.id, invite.id));

  const [server] = await db
    .select()
    .from(servers)
    .where(eq(servers.id, invite.serverId))
    .limit(1);

  analytics.capture(userId, "invite:used", { serverId: invite.serverId, code });

  return c.json({ server }, 201);
});

// Revoke/delete invite
inviteRoutes.delete("/invites/:code", async (c) => {
  const code = c.req.param("code");
  const userId = c.get("userId");

  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.code, code))
    .limit(1);

  if (!invite) {
    return c.json({ error: "Invite not found" }, 404);
  }

  if (!(await hasPermission(userId, invite.serverId, PERMISSIONS.MANAGE_SERVER))) {
    return c.json({ error: "Missing permissions" }, 403);
  }

  await db.delete(invites).where(eq(invites.code, code));

  analytics.capture(userId, "invite:revoked", { serverId: invite.serverId, code });

  return c.json({ success: true });
});
