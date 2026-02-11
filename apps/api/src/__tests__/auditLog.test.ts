import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import { setupDatabase, clearDatabase, createApp, createTestUser, getAuthHeaders, testDb } from "./helpers";
import { sql } from "drizzle-orm";
import type { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  await setupDatabase();
  // Add columns that the users schema expects but helpers.ts doesn't create yet
  await testDb.run(sql`ALTER TABLE users ADD COLUMN bio TEXT`).catch(() => {});
  await testDb.run(sql`ALTER TABLE users ADD COLUMN banner_url TEXT`).catch(() => {});
  await testDb.run(sql`ALTER TABLE users ADD COLUMN pronouns TEXT`).catch(() => {});
  await testDb.run(sql`ALTER TABLE servers ADD COLUMN description TEXT`).catch(() => {});
  await testDb.run(sql`CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL REFERENCES servers(id),
    actor_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    target_id TEXT,
    target_type TEXT,
    reason TEXT,
    metadata TEXT,
    created_at INTEGER
  )`);
  await testDb.run(sql`CREATE INDEX IF NOT EXISTS audit_log_server_created_at_idx ON audit_log(server_id, created_at)`);
  await testDb.run(sql`CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log(actor_id)`);

  app = createApp();
  const { auditLogRoutes } = await import("../routes/auditLog");
  app.route("/", auditLogRoutes);
});

beforeEach(async () => {
  await clearDatabase();
  await testDb.run(sql`DELETE FROM audit_log`);
});

async function createTestServer(app: Hono) {
  const { token, user } = await createTestUser(app, "owner", "owner@test.com");
  const res = await app.request("/servers", {
    method: "POST",
    body: JSON.stringify({ name: "Test Server" }),
    headers: getAuthHeaders(token),
  });
  const { server } = (await res.json()) as any;
  return { token, user, server };
}

describe("logAuditEvent", () => {
  test("creates an entry in the database", async () => {
    const { user, server } = await createTestServer(app);
    const { logAuditEvent } = await import("../lib/auditLog");

    await logAuditEvent({
      serverId: server.id,
      actorId: user.id,
      action: "member.ban",
      targetId: "some-user-id",
      targetType: "user",
      reason: "Spam",
      metadata: { duration: "permanent" },
    });

    const rows = await testDb.all(sql`SELECT * FROM audit_log WHERE server_id = ${server.id}`);
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("member.ban");
    expect(rows[0].actor_id).toBe(user.id);
    expect(rows[0].target_id).toBe("some-user-id");
    expect(rows[0].target_type).toBe("user");
    expect(rows[0].reason).toBe("Spam");
    expect(JSON.parse(rows[0].metadata as string)).toEqual({ duration: "permanent" });
  });
});

describe("GET /servers/:serverId/audit-log", () => {
  test("owner can view audit log", async () => {
    const { token, user, server } = await createTestServer(app);
    const { logAuditEvent } = await import("../lib/auditLog");

    await logAuditEvent({
      serverId: server.id,
      actorId: user.id,
      action: "member.kick",
      targetId: "target-1",
      targetType: "user",
    });

    const res = await app.request(`/servers/${server.id}/audit-log`, {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const { entries } = (await res.json()) as any;
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("member.kick");
  });

  test("returns entries sorted newest first", async () => {
    const { token, user, server } = await createTestServer(app);
    const { logAuditEvent } = await import("../lib/auditLog");

    // Insert with explicit timestamps to ensure ordering
    await testDb.run(sql`INSERT INTO audit_log (id, server_id, actor_id, action, created_at) VALUES ('a1', ${server.id}, ${user.id}, 'channel.create', ${Math.floor(new Date("2024-01-01").getTime() / 1000)})`);
    await testDb.run(sql`INSERT INTO audit_log (id, server_id, actor_id, action, created_at) VALUES ('a2', ${server.id}, ${user.id}, 'channel.update', ${Math.floor(new Date("2024-01-03").getTime() / 1000)})`);
    await testDb.run(sql`INSERT INTO audit_log (id, server_id, actor_id, action, created_at) VALUES ('a3', ${server.id}, ${user.id}, 'channel.delete', ${Math.floor(new Date("2024-01-02").getTime() / 1000)})`);

    const res = await app.request(`/servers/${server.id}/audit-log`, {
      headers: getAuthHeaders(token),
    });
    const { entries } = (await res.json()) as any;
    expect(entries).toHaveLength(3);
    expect(entries[0].action).toBe("channel.update");
    expect(entries[1].action).toBe("channel.delete");
    expect(entries[2].action).toBe("channel.create");
  });

  test("pagination with cursor works", async () => {
    const { token, user, server } = await createTestServer(app);

    // Insert 3 entries with known timestamps
    await testDb.run(sql`INSERT INTO audit_log (id, server_id, actor_id, action, created_at) VALUES ('p1', ${server.id}, ${user.id}, 'role.create', ${Math.floor(new Date("2024-01-01").getTime() / 1000)})`);
    await testDb.run(sql`INSERT INTO audit_log (id, server_id, actor_id, action, created_at) VALUES ('p2', ${server.id}, ${user.id}, 'role.update', ${Math.floor(new Date("2024-01-02").getTime() / 1000)})`);
    await testDb.run(sql`INSERT INTO audit_log (id, server_id, actor_id, action, created_at) VALUES ('p3', ${server.id}, ${user.id}, 'role.delete', ${Math.floor(new Date("2024-01-03").getTime() / 1000)})`);

    // Use a cursor that excludes the newest entry
    const cursor = new Date("2024-01-03").toISOString();
    const res = await app.request(`/servers/${server.id}/audit-log?cursor=${cursor}`, {
      headers: getAuthHeaders(token),
    });
    const { entries } = (await res.json()) as any;
    expect(entries).toHaveLength(2);
    expect(entries[0].action).toBe("role.update");
    expect(entries[1].action).toBe("role.create");
  });

  test("filter by action type works", async () => {
    const { token, user, server } = await createTestServer(app);

    await testDb.run(sql`INSERT INTO audit_log (id, server_id, actor_id, action, created_at) VALUES ('f1', ${server.id}, ${user.id}, 'member.kick', ${Math.floor(Date.now() / 1000)})`);
    await testDb.run(sql`INSERT INTO audit_log (id, server_id, actor_id, action, created_at) VALUES ('f2', ${server.id}, ${user.id}, 'member.ban', ${Math.floor(Date.now() / 1000)})`);
    await testDb.run(sql`INSERT INTO audit_log (id, server_id, actor_id, action, created_at) VALUES ('f3', ${server.id}, ${user.id}, 'member.kick', ${Math.floor(Date.now() / 1000)})`);

    const res = await app.request(`/servers/${server.id}/audit-log?action=member.kick`, {
      headers: getAuthHeaders(token),
    });
    const { entries } = (await res.json()) as any;
    expect(entries).toHaveLength(2);
    expect(entries.every((e: any) => e.action === "member.kick")).toBe(true);
  });

  test("non-member gets 403", async () => {
    const { server } = await createTestServer(app);
    const { token: otherToken } = await createTestUser(app, "outsider", "outsider@test.com");

    const res = await app.request(`/servers/${server.id}/audit-log`, {
      headers: getAuthHeaders(otherToken),
    });
    expect(res.status).toBe(403);
  });

  test("non-privileged member gets 403", async () => {
    const { server } = await createTestServer(app);
    const { token: memberToken } = await createTestUser(app, "member", "member@test.com");

    // Join the server
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    const res = await app.request(`/servers/${server.id}/audit-log`, {
      headers: getAuthHeaders(memberToken),
    });
    expect(res.status).toBe(403);
  });

  test("entries include actor username and displayName", async () => {
    const { token, user, server } = await createTestServer(app);

    await testDb.run(sql`INSERT INTO audit_log (id, server_id, actor_id, action, created_at) VALUES ('u1', ${server.id}, ${user.id}, 'server.update', ${Math.floor(Date.now() / 1000)})`);

    const res = await app.request(`/servers/${server.id}/audit-log`, {
      headers: getAuthHeaders(token),
    });
    const { entries } = (await res.json()) as any;
    expect(entries).toHaveLength(1);
    expect(entries[0].actorUsername).toBe("owner");
    expect(entries[0]).toHaveProperty("actorDisplayName");
  });

  test("multiple entries returned in correct order", async () => {
    const { token, user, server } = await createTestServer(app);

    for (let i = 0; i < 5; i++) {
      await testDb.run(sql`INSERT INTO audit_log (id, server_id, actor_id, action, created_at) VALUES (${`m${i}`}, ${server.id}, ${user.id}, ${`action.${i}`}, ${Math.floor(new Date(`2024-01-0${i + 1}`).getTime() / 1000)})`);
    }

    const res = await app.request(`/servers/${server.id}/audit-log`, {
      headers: getAuthHeaders(token),
    });
    const { entries } = (await res.json()) as any;
    expect(entries).toHaveLength(5);
    // Should be newest first
    expect(entries[0].action).toBe("action.4");
    expect(entries[4].action).toBe("action.0");
  });
});
