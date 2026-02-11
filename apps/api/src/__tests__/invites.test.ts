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

  // Add columns from other features that the test DB schema doesn't have yet
  await testDb.run(sql`ALTER TABLE users ADD COLUMN bio TEXT`).catch(() => {});
  await testDb.run(sql`ALTER TABLE users ADD COLUMN banner_url TEXT`).catch(() => {});
  await testDb.run(sql`ALTER TABLE users ADD COLUMN pronouns TEXT`).catch(() => {});
  await testDb.run(sql`ALTER TABLE servers ADD COLUMN description TEXT`).catch(() => {});

  // Create invites table for tests
  await testDb.run(sql`CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL REFERENCES servers(id),
    code TEXT UNIQUE NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    expires_at INTEGER,
    max_uses INTEGER,
    uses INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER
  )`);
  await testDb.run(sql`CREATE INDEX IF NOT EXISTS invites_server_idx ON invites(server_id)`);
  await testDb.run(sql`CREATE INDEX IF NOT EXISTS invites_code_idx ON invites(code)`);

  app = createApp();
  const { inviteRoutes } = await import("../routes/invites");
  app.route("/", inviteRoutes);
});

beforeEach(async () => {
  await clearDatabase();
  await testDb.run(sql`DELETE FROM invites`);
});

async function createServer(app: Hono, token: string, name = "Test Server") {
  const res = await app.request("/servers", {
    method: "POST",
    body: JSON.stringify({ name }),
    headers: getAuthHeaders(token),
  });
  const data = (await res.json()) as any;
  return data.server;
}

describe("POST /servers/:serverId/invites", () => {
  test("creates invite with defaults", async () => {
    const { token } = await createTestUser(app);
    const server = await createServer(app, token);

    const res = await app.request(`/servers/${server.id}/invites`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.invite.code).toBeDefined();
    expect(data.invite.code.length).toBe(8);
    expect(data.invite.serverId).toBe(server.id);
    expect(data.invite.uses).toBe(0);
    expect(data.invite.expiresAt).toBeNull();
    expect(data.invite.maxUses).toBeNull();
  });

  test("creates invite with maxAge", async () => {
    const { token } = await createTestUser(app);
    const server = await createServer(app, token);

    const res = await app.request(`/servers/${server.id}/invites`, {
      method: "POST",
      body: JSON.stringify({ maxAge: 3600 }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.invite.expiresAt).toBeDefined();
    expect(data.invite.expiresAt).not.toBeNull();
  });

  test("creates invite with maxUses", async () => {
    const { token } = await createTestUser(app);
    const server = await createServer(app, token);

    const res = await app.request(`/servers/${server.id}/invites`, {
      method: "POST",
      body: JSON.stringify({ maxUses: 5 }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.invite.maxUses).toBe(5);
  });

  test("non-member cannot create invite", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: otherToken } = await createTestUser(app, "other", "other@example.com");
    const server = await createServer(app, ownerToken);

    const res = await app.request(`/servers/${server.id}/invites`, {
      method: "POST",
      headers: getAuthHeaders(otherToken),
    });
    expect(res.status).toBe(403);
  });

  test("server not found returns 404", async () => {
    const { token } = await createTestUser(app);

    const res = await app.request("/servers/nonexistent/invites", {
      method: "POST",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /servers/:serverId/invites", () => {
  test("lists created invites", async () => {
    const { token } = await createTestUser(app);
    const server = await createServer(app, token);

    // Create two invites
    await app.request(`/servers/${server.id}/invites`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });
    await app.request(`/servers/${server.id}/invites`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });

    const res = await app.request(`/servers/${server.id}/invites`, {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.invites.length).toBe(2);
  });

  test("non-member cannot list invites", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: otherToken } = await createTestUser(app, "other", "other@example.com");
    const server = await createServer(app, ownerToken);

    const res = await app.request(`/servers/${server.id}/invites`, {
      headers: getAuthHeaders(otherToken),
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /invites/:code/join", () => {
  test("join via invite works", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: memberToken } = await createTestUser(app, "joiner", "joiner@example.com");
    const server = await createServer(app, ownerToken);

    // Create invite
    const createRes = await app.request(`/servers/${server.id}/invites`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
    });
    const { invite } = (await createRes.json()) as any;

    // Join
    const res = await app.request(`/invites/${invite.code}/join`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.server.id).toBe(server.id);
  });

  test("expired invite returns 410", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: memberToken } = await createTestUser(app, "joiner", "joiner@example.com");
    const server = await createServer(app, ownerToken);

    // Create invite with 1 second maxAge
    const createRes = await app.request(`/servers/${server.id}/invites`, {
      method: "POST",
      body: JSON.stringify({ maxAge: 1 }),
      headers: getAuthHeaders(ownerToken),
    });
    const { invite } = (await createRes.json()) as any;

    // Manually set expiresAt to the past
    await testDb.run(
      sql`UPDATE invites SET expires_at = ${Math.floor(Date.now() / 1000) - 3600} WHERE code = ${invite.code}`
    );

    const res = await app.request(`/invites/${invite.code}/join`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });
    expect(res.status).toBe(410);
    const data = (await res.json()) as any;
    expect(data.error).toBe("Invite has expired");
  });

  test("max uses exceeded returns 410", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: memberToken } = await createTestUser(app, "joiner", "joiner@example.com");
    const server = await createServer(app, ownerToken);

    // Create invite with maxUses 1
    const createRes = await app.request(`/servers/${server.id}/invites`, {
      method: "POST",
      body: JSON.stringify({ maxUses: 1 }),
      headers: getAuthHeaders(ownerToken),
    });
    const { invite } = (await createRes.json()) as any;

    // Set uses to 1
    await testDb.run(sql`UPDATE invites SET uses = 1 WHERE code = ${invite.code}`);

    const res = await app.request(`/invites/${invite.code}/join`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });
    expect(res.status).toBe(410);
    const data = (await res.json()) as any;
    expect(data.error).toBe("Invite has reached maximum uses");
  });

  test("banned user cannot join via invite", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: memberToken, user: memberUser } = await createTestUser(
      app, "member", "member@example.com"
    );
    const server = await createServer(app, ownerToken);

    // Member joins via legacy invite code
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    // Ban the member
    await app.request(`/servers/${server.id}/bans/${memberUser.id}`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
    });

    // Create a new invite
    const createRes = await app.request(`/servers/${server.id}/invites`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
    });
    const { invite } = (await createRes.json()) as any;

    // Banned user tries to join via invite
    const res = await app.request(`/invites/${invite.code}/join`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error).toBe("You are banned from this server");
  });

  test("already a member returns 409", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: memberToken } = await createTestUser(app, "member", "member@example.com");
    const server = await createServer(app, ownerToken);

    // Member joins via legacy invite
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    // Create new invite
    const createRes = await app.request(`/servers/${server.id}/invites`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
    });
    const { invite } = (await createRes.json()) as any;

    // Already-member tries to join
    const res = await app.request(`/invites/${invite.code}/join`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });
    expect(res.status).toBe(409);
  });

  test("invite not found returns 404", async () => {
    const { token } = await createTestUser(app);

    const res = await app.request("/invites/BADCODE1/join", {
      method: "POST",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /invites/:code", () => {
  test("returns server name and member count", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const server = await createServer(app, ownerToken);

    const createRes = await app.request(`/servers/${server.id}/invites`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
    });
    const { invite } = (await createRes.json()) as any;

    const res = await app.request(`/invites/${invite.code}`, {
      headers: getAuthHeaders(ownerToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.server.name).toBe("Test Server");
    expect(data.server.id).toBe(server.id);
    expect(data.server.memberCount).toBeDefined();
    expect(data.code).toBe(invite.code);
  });

  test("not found returns 404", async () => {
    const { token } = await createTestUser(app);

    const res = await app.request("/invites/BADCODE1", {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /invites/:code", () => {
  test("owner can revoke invite", async () => {
    const { token } = await createTestUser(app);
    const server = await createServer(app, token);

    const createRes = await app.request(`/servers/${server.id}/invites`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });
    const { invite } = (await createRes.json()) as any;

    const res = await app.request(`/invites/${invite.code}`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);

    // Verify it's gone
    const getRes = await app.request(`/invites/${invite.code}`, {
      headers: getAuthHeaders(token),
    });
    expect(getRes.status).toBe(404);
  });

  test("non-member cannot revoke invite", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: otherToken } = await createTestUser(app, "other", "other@example.com");
    const server = await createServer(app, ownerToken);

    const createRes = await app.request(`/servers/${server.id}/invites`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
    });
    const { invite } = (await createRes.json()) as any;

    const res = await app.request(`/invites/${invite.code}`, {
      method: "DELETE",
      headers: getAuthHeaders(otherToken),
    });
    expect(res.status).toBe(403);
  });

  test("revoke nonexistent invite returns 404", async () => {
    const { token } = await createTestUser(app);

    const res = await app.request("/invites/BADCODE1", {
      method: "DELETE",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(404);
  });
});
