import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import {
  setupDatabase,
  clearDatabase,
  createApp,
  createTestUser,
  getAuthHeaders,
} from "./helpers";
import type { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  await setupDatabase();
  app = createApp();
});

beforeEach(async () => {
  await clearDatabase();
});

// Helper to create a server and return the server data
async function createServer(app: Hono, token: string, name = "Test Server") {
  const res = await app.request("/servers", {
    method: "POST",
    body: JSON.stringify({ name }),
    headers: getAuthHeaders(token),
  });
  const data = (await res.json()) as any;
  return data.server;
}

describe("POST /servers/:serverId/bans/:userId", () => {
  test("owner can ban a member", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: memberToken, user: memberUser } = await createTestUser(
      app,
      "member",
      "member@example.com"
    );

    const server = await createServer(app, ownerToken);

    // Member joins the server
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    // Owner bans the member
    const res = await app.request(
      `/servers/${server.id}/bans/${memberUser.id}`,
      {
        method: "POST",
        body: JSON.stringify({ reason: "Breaking rules" }),
        headers: getAuthHeaders(ownerToken),
      }
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.ban).toBeDefined();
    expect(data.ban.userId).toBe(memberUser.id);
    expect(data.ban.reason).toBe("Breaking rules");
  });

  test("ban removes user from server", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: memberToken, user: memberUser } = await createTestUser(
      app,
      "member",
      "member@example.com"
    );

    const server = await createServer(app, ownerToken);

    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    // Ban the member
    await app.request(`/servers/${server.id}/bans/${memberUser.id}`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
    });

    // Member should no longer be able to access the server
    const getRes = await app.request(`/servers/${server.id}`, {
      headers: getAuthHeaders(memberToken),
    });
    expect(getRes.status).toBe(403);
  });

  test("non-owner cannot ban", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: memberToken, user: memberUser } = await createTestUser(
      app,
      "member",
      "member@example.com"
    );
    const { user: targetUser } = await createTestUser(
      app,
      "target",
      "target@example.com"
    );

    const server = await createServer(app, ownerToken);

    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    const res = await app.request(
      `/servers/${server.id}/bans/${targetUser.id}`,
      {
        method: "POST",
        headers: getAuthHeaders(memberToken),
      }
    );
    expect(res.status).toBe(403);
  });

  test("cannot ban yourself", async () => {
    const { token: ownerToken, user: ownerUser } = await createTestUser(app);
    const server = await createServer(app, ownerToken);

    const res = await app.request(
      `/servers/${server.id}/bans/${ownerUser.id}`,
      {
        method: "POST",
        headers: getAuthHeaders(ownerToken),
      }
    );
    expect(res.status).toBe(400);
  });

  test("cannot ban same user twice", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: memberToken, user: memberUser } = await createTestUser(
      app,
      "member",
      "member@example.com"
    );

    const server = await createServer(app, ownerToken);

    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    await app.request(`/servers/${server.id}/bans/${memberUser.id}`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
    });

    const res = await app.request(
      `/servers/${server.id}/bans/${memberUser.id}`,
      {
        method: "POST",
        headers: getAuthHeaders(ownerToken),
      }
    );
    expect(res.status).toBe(409);
  });

  test("ban without reason works", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: memberToken, user: memberUser } = await createTestUser(
      app,
      "member",
      "member@example.com"
    );

    const server = await createServer(app, ownerToken);

    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    const res = await app.request(
      `/servers/${server.id}/bans/${memberUser.id}`,
      {
        method: "POST",
        headers: getAuthHeaders(ownerToken),
      }
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.ban.reason).toBeNull();
  });
});

describe("DELETE /servers/:serverId/bans/:userId", () => {
  test("owner can unban a user", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: memberToken, user: memberUser } = await createTestUser(
      app,
      "member",
      "member@example.com"
    );

    const server = await createServer(app, ownerToken);

    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    // Ban then unban
    await app.request(`/servers/${server.id}/bans/${memberUser.id}`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
    });

    const res = await app.request(
      `/servers/${server.id}/bans/${memberUser.id}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(ownerToken),
      }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
  });

  test("non-owner cannot unban", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: memberToken, user: memberUser } = await createTestUser(
      app,
      "member",
      "member@example.com"
    );
    const { token: otherToken } = await createTestUser(
      app,
      "other",
      "other@example.com"
    );

    const server = await createServer(app, ownerToken);

    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    await app.request(`/servers/${server.id}/bans/${memberUser.id}`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
    });

    const res = await app.request(
      `/servers/${server.id}/bans/${memberUser.id}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(otherToken),
      }
    );
    expect(res.status).toBe(403);
  });

  test("unban non-banned user returns 404", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { user: otherUser } = await createTestUser(
      app,
      "other",
      "other@example.com"
    );

    const server = await createServer(app, ownerToken);

    const res = await app.request(
      `/servers/${server.id}/bans/${otherUser.id}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(ownerToken),
      }
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /servers/:serverId/bans", () => {
  test("owner can list bans", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: memberToken, user: memberUser } = await createTestUser(
      app,
      "member",
      "member@example.com"
    );

    const server = await createServer(app, ownerToken);

    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    await app.request(`/servers/${server.id}/bans/${memberUser.id}`, {
      method: "POST",
      body: JSON.stringify({ reason: "Spam" }),
      headers: getAuthHeaders(ownerToken),
    });

    const res = await app.request(`/servers/${server.id}/bans`, {
      headers: getAuthHeaders(ownerToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.bans.length).toBe(1);
    expect(data.bans[0].userId).toBe(memberUser.id);
    expect(data.bans[0].username).toBe("member");
    expect(data.bans[0].reason).toBe("Spam");
  });

  test("non-owner cannot list bans", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: memberToken } = await createTestUser(
      app,
      "member",
      "member@example.com"
    );

    const server = await createServer(app, ownerToken);

    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    const res = await app.request(`/servers/${server.id}/bans`, {
      headers: getAuthHeaders(memberToken),
    });
    expect(res.status).toBe(403);
  });

  test("empty ban list", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const server = await createServer(app, ownerToken);

    const res = await app.request(`/servers/${server.id}/bans`, {
      headers: getAuthHeaders(ownerToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.bans.length).toBe(0);
  });
});

describe("banned user cannot rejoin", () => {
  test("banned user is blocked from joining via invite code", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: memberToken, user: memberUser } = await createTestUser(
      app,
      "member",
      "member@example.com"
    );

    const server = await createServer(app, ownerToken);

    // Member joins
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    // Owner bans member
    await app.request(`/servers/${server.id}/bans/${memberUser.id}`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
    });

    // Banned user tries to rejoin
    const res = await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error).toBe("You are banned from this server");
  });

  test("unbanned user can rejoin", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: memberToken, user: memberUser } = await createTestUser(
      app,
      "member",
      "member@example.com"
    );

    const server = await createServer(app, ownerToken);

    // Member joins
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    // Owner bans member
    await app.request(`/servers/${server.id}/bans/${memberUser.id}`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
    });

    // Owner unbans member
    await app.request(`/servers/${server.id}/bans/${memberUser.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(ownerToken),
    });

    // Unbanned user can now rejoin
    const res = await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });
    expect(res.status).toBe(201);
  });
});
