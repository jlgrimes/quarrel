import { Hono } from "hono";
import { db, servers, members, channels } from "@quarrel/db";
import { createServerSchema, updateServerSchema } from "@quarrel/shared";
import { eq, and, inArray } from "drizzle-orm";
import { authMiddleware, type AuthEnv } from "../middleware/auth";

export const serverRoutes = new Hono<AuthEnv>();

serverRoutes.use(authMiddleware);

serverRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createServerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const userId = c.get("userId");
  const inviteCode = crypto.randomUUID().slice(0, 8);

  const [server] = await db
    .insert(servers)
    .values({
      name: parsed.data.name,
      ownerId: userId,
      inviteCode,
    })
    .returning();

  await db.insert(members).values({
    userId,
    serverId: server.id,
  });

  await db.insert(channels).values({
    serverId: server.id,
    name: "general",
    type: "text",
    position: 0,
  });

  return c.json({ server }, 201);
});

serverRoutes.get("/", async (c) => {
  const userId = c.get("userId");

  const userMembers = await db
    .select()
    .from(members)
    .where(eq(members.userId, userId));

  if (userMembers.length === 0) {
    return c.json({ servers: [] });
  }

  const serverIds = userMembers.map((m) => m.serverId);
  const result = await db
    .select()
    .from(servers)
    .where(inArray(servers.id, serverIds));

  return c.json({ servers: result });
});

serverRoutes.get("/:id", async (c) => {
  const serverId = c.req.param("id");
  const userId = c.get("userId");

  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.serverId, serverId)))
    .limit(1);

  if (!member) {
    return c.json({ error: "Not a member of this server" }, 403);
  }

  const [server] = await db
    .select()
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  return c.json({ server });
});

serverRoutes.patch("/:id", async (c) => {
  const serverId = c.req.param("id");
  const userId = c.get("userId");

  const [server] = await db
    .select()
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  if (server.ownerId !== userId) {
    return c.json({ error: "Only the owner can update the server" }, 403);
  }

  const body = await c.req.json();
  const parsed = updateServerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [updated] = await db
    .update(servers)
    .set(parsed.data)
    .where(eq(servers.id, serverId))
    .returning();

  return c.json({ server: updated });
});

serverRoutes.delete("/:id", async (c) => {
  const serverId = c.req.param("id");
  const userId = c.get("userId");

  const [server] = await db
    .select()
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  if (server.ownerId !== userId) {
    return c.json({ error: "Only the owner can delete the server" }, 403);
  }

  await db.delete(servers).where(eq(servers.id, serverId));
  return c.json({ success: true });
});

serverRoutes.post("/join/:inviteCode", async (c) => {
  const inviteCode = c.req.param("inviteCode");
  const userId = c.get("userId");

  const [server] = await db
    .select()
    .from(servers)
    .where(eq(servers.inviteCode, inviteCode))
    .limit(1);

  if (!server) {
    return c.json({ error: "Invalid invite code" }, 404);
  }

  const [existingMember] = await db
    .select()
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.serverId, server.id)))
    .limit(1);

  if (existingMember) {
    return c.json({ error: "Already a member" }, 409);
  }

  await db.insert(members).values({
    userId,
    serverId: server.id,
  });

  return c.json({ server }, 201);
});
