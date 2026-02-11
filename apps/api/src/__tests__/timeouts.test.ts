import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import {
  setupDatabase,
  clearDatabase,
  createApp,
  createTestUser,
  getAuthHeaders,
  testDb,
} from "./helpers";
import { sql } from "drizzle-orm";
import type { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  await setupDatabase();
  await testDb.run(sql`CREATE TABLE IF NOT EXISTS timeouts (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL REFERENCES servers(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    timed_out_by TEXT NOT NULL REFERENCES users(id),
    reason TEXT,
    expires_at INTEGER NOT NULL,
    created_at INTEGER
  )`);
  await testDb.run(
    sql`CREATE INDEX IF NOT EXISTS timeouts_server_user_idx ON timeouts(server_id, user_id)`
  );

  app = createApp();
  const { timeoutRoutes } = await import("../routes/timeouts");
  app.route("/", timeoutRoutes);
});

beforeEach(async () => {
  await clearDatabase();
  await testDb.run(sql`DELETE FROM timeouts`);
});

async function createServerWithMember(app: Hono) {
  const { token: ownerToken, user: owner } = await createTestUser(
    app,
    "owner",
    "owner@test.com"
  );
  const serverRes = await app.request("/servers", {
    method: "POST",
    body: JSON.stringify({ name: "Test Server" }),
    headers: getAuthHeaders(ownerToken),
  });
  const { server } = (await serverRes.json()) as any;

  const { token: memberToken, user: member } = await createTestUser(
    app,
    "member",
    "member@test.com"
  );
  await app.request(`/servers/join/${server.inviteCode}`, {
    method: "POST",
    headers: getAuthHeaders(memberToken),
  });

  return { ownerToken, owner, memberToken, member, server };
}

describe("POST /servers/:serverId/timeouts/:userId", () => {
  test("owner can timeout a member", async () => {
    const { ownerToken, member, server } = await createServerWithMember(app);

    const res = await app.request(
      `/servers/${server.id}/timeouts/${member.id}`,
      {
        method: "POST",
        body: JSON.stringify({ duration: 3600, reason: "Spam" }),
        headers: getAuthHeaders(ownerToken),
      }
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.timeout).toBeDefined();
    expect(data.timeout.userId).toBe(member.id);
    expect(data.timeout.reason).toBe("Spam");
  });

  test("cannot timeout the server owner", async () => {
    const { memberToken, owner, server } = await createServerWithMember(app);

    // Member can't timeout owner (and also doesn't have permission), but the owner-check happens first
    const res = await app.request(
      `/servers/${server.id}/timeouts/${owner.id}`,
      {
        method: "POST",
        body: JSON.stringify({ duration: 3600 }),
        headers: getAuthHeaders(memberToken),
      }
    );
    // Either 400 (cannot timeout owner) or 403 (no permission) is acceptable
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("owner cannot be timed out even by owner themselves", async () => {
    const { ownerToken, owner, server } = await createServerWithMember(app);

    const res = await app.request(
      `/servers/${server.id}/timeouts/${owner.id}`,
      {
        method: "POST",
        body: JSON.stringify({ duration: 3600 }),
        headers: getAuthHeaders(ownerToken),
      }
    );
    expect(res.status).toBe(400);
  });

  test("non-privileged member gets 403", async () => {
    const { memberToken, owner, server } = await createServerWithMember(app);

    const { user: target } = await createTestUser(
      app,
      "target",
      "target@test.com"
    );
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(
        (
          await createTestUser(app, "target2", "target2@test.com")
        ).token
      ),
    });

    const res = await app.request(
      `/servers/${server.id}/timeouts/${target.id}`,
      {
        method: "POST",
        body: JSON.stringify({ duration: 3600 }),
        headers: getAuthHeaders(memberToken),
      }
    );
    expect(res.status).toBe(403);
  });
});

describe("GET /servers/:serverId/timeouts", () => {
  test("lists active timeouts", async () => {
    const { ownerToken, member, server } = await createServerWithMember(app);

    // Create a timeout
    await app.request(`/servers/${server.id}/timeouts/${member.id}`, {
      method: "POST",
      body: JSON.stringify({ duration: 3600, reason: "Test" }),
      headers: getAuthHeaders(ownerToken),
    });

    const res = await app.request(`/servers/${server.id}/timeouts`, {
      headers: getAuthHeaders(ownerToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.timeouts.length).toBe(1);
    expect(data.timeouts[0].username).toBe("member");
  });

  test("expired timeout not in active list", async () => {
    const { ownerToken, member, server } = await createServerWithMember(app);

    // Insert a timeout that already expired
    const pastDate = new Date(Date.now() - 60000);
    await testDb.run(
      sql`INSERT INTO timeouts (id, server_id, user_id, timed_out_by, expires_at, created_at)
          VALUES (${crypto.randomUUID()}, ${server.id}, ${member.id}, ${server.ownerId}, ${Math.floor(pastDate.getTime() / 1000)}, ${Math.floor(Date.now() / 1000)})`
    );

    const res = await app.request(`/servers/${server.id}/timeouts`, {
      headers: getAuthHeaders(ownerToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.timeouts.length).toBe(0);
  });
});

describe("DELETE /servers/:serverId/timeouts/:userId", () => {
  test("removes timeout early", async () => {
    const { ownerToken, member, server } = await createServerWithMember(app);

    // Create a timeout
    await app.request(`/servers/${server.id}/timeouts/${member.id}`, {
      method: "POST",
      body: JSON.stringify({ duration: 3600 }),
      headers: getAuthHeaders(ownerToken),
    });

    // Remove it
    const res = await app.request(
      `/servers/${server.id}/timeouts/${member.id}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(ownerToken),
      }
    );
    expect(res.status).toBe(200);

    // Verify it's gone
    const listRes = await app.request(`/servers/${server.id}/timeouts`, {
      headers: getAuthHeaders(ownerToken),
    });
    const data = (await listRes.json()) as any;
    expect(data.timeouts.length).toBe(0);
  });
});
