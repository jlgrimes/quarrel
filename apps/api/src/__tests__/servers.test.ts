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

describe("POST /servers", () => {
  test("creates server with #general channel", async () => {
    const { token } = await createTestUser(app);
    const res = await app.request("/servers", {
      method: "POST",
      body: JSON.stringify({ name: "Test Server" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.server).toBeDefined();
    expect(data.server.name).toBe("Test Server");
    expect(data.server.inviteCode).toBeDefined();

    // Verify #general channel was created
    const channelsRes = await app.request(
      `/servers/${data.server.id}/channels`,
      { headers: getAuthHeaders(token) }
    );
    const channelsData = (await channelsRes.json()) as any;
    expect(channelsData.channels.length).toBe(1);
    expect(channelsData.channels[0].name).toBe("general");
  });

  test("adds owner as member", async () => {
    const { token, user } = await createTestUser(app);
    const res = await app.request("/servers", {
      method: "POST",
      body: JSON.stringify({ name: "Test Server" }),
      headers: getAuthHeaders(token),
    });
    const data = (await res.json()) as any;

    // Owner should be able to GET the server (requires membership)
    const getRes = await app.request(`/servers/${data.server.id}`, {
      headers: getAuthHeaders(token),
    });
    expect(getRes.status).toBe(200);
    const serverData = (await getRes.json()) as any;
    expect(serverData.server.ownerId).toBe(user.id);
  });
});

describe("GET /servers", () => {
  test("lists user's servers", async () => {
    const { token } = await createTestUser(app);
    await app.request("/servers", {
      method: "POST",
      body: JSON.stringify({ name: "Server 1" }),
      headers: getAuthHeaders(token),
    });
    await app.request("/servers", {
      method: "POST",
      body: JSON.stringify({ name: "Server 2" }),
      headers: getAuthHeaders(token),
    });

    const res = await app.request("/servers", {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.servers.length).toBe(2);
  });
});

describe("GET /servers/:id", () => {
  test("returns server for member", async () => {
    const { token } = await createTestUser(app);
    const createRes = await app.request("/servers", {
      method: "POST",
      body: JSON.stringify({ name: "Test Server" }),
      headers: getAuthHeaders(token),
    });
    const { server } = (await createRes.json()) as any;

    const res = await app.request(`/servers/${server.id}`, {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.server.name).toBe("Test Server");
  });

  test("rejects non-member", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: otherToken } = await createTestUser(
      app,
      "other",
      "other@example.com"
    );

    const createRes = await app.request("/servers", {
      method: "POST",
      body: JSON.stringify({ name: "Test Server" }),
      headers: getAuthHeaders(ownerToken),
    });
    const { server } = (await createRes.json()) as any;

    const res = await app.request(`/servers/${server.id}`, {
      headers: getAuthHeaders(otherToken),
    });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /servers/:id", () => {
  test("owner can update", async () => {
    const { token } = await createTestUser(app);
    const createRes = await app.request("/servers", {
      method: "POST",
      body: JSON.stringify({ name: "Old Name" }),
      headers: getAuthHeaders(token),
    });
    const { server } = (await createRes.json()) as any;

    const res = await app.request(`/servers/${server.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.server.name).toBe("New Name");
  });

  test("non-owner rejected", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: otherToken } = await createTestUser(
      app,
      "other",
      "other@example.com"
    );

    const createRes = await app.request("/servers", {
      method: "POST",
      body: JSON.stringify({ name: "Test Server" }),
      headers: getAuthHeaders(ownerToken),
    });
    const { server } = (await createRes.json()) as any;

    const res = await app.request(`/servers/${server.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Hacked" }),
      headers: getAuthHeaders(otherToken),
    });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /servers/:id", () => {
  test("owner can delete", async () => {
    const { token } = await createTestUser(app);
    const createRes = await app.request("/servers", {
      method: "POST",
      body: JSON.stringify({ name: "Test Server" }),
      headers: getAuthHeaders(token),
    });
    const { server } = (await createRes.json()) as any;

    const res = await app.request(`/servers/${server.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
  });
});

describe("POST /servers/join/:inviteCode", () => {
  test("joins server", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: joinerToken } = await createTestUser(
      app,
      "joiner",
      "joiner@example.com"
    );

    const createRes = await app.request("/servers", {
      method: "POST",
      body: JSON.stringify({ name: "Test Server" }),
      headers: getAuthHeaders(ownerToken),
    });
    const { server } = (await createRes.json()) as any;

    const res = await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(joinerToken),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.server.id).toBe(server.id);

    // Verify they can now access the server
    const getRes = await app.request(`/servers/${server.id}`, {
      headers: getAuthHeaders(joinerToken),
    });
    expect(getRes.status).toBe(200);
  });

  test("rejects duplicate join", async () => {
    const { token: ownerToken } = await createTestUser(app);
    const { token: joinerToken } = await createTestUser(
      app,
      "joiner",
      "joiner@example.com"
    );

    const createRes = await app.request("/servers", {
      method: "POST",
      body: JSON.stringify({ name: "Test Server" }),
      headers: getAuthHeaders(ownerToken),
    });
    const { server } = (await createRes.json()) as any;

    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(joinerToken),
    });

    const res = await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(joinerToken),
    });
    expect(res.status).toBe(409);
  });
});

describe("invite code security", () => {
  test("invite codes are at least 16 characters long", async () => {
    const { token } = await createTestUser(app);
    const res = await app.request("/servers", {
      method: "POST",
      body: JSON.stringify({ name: "Test Server" }),
      headers: getAuthHeaders(token),
    });
    const data = (await res.json()) as any;
    expect(data.server.inviteCode.length).toBeGreaterThanOrEqual(16);
  });

  test("invite codes use alphanumeric characters", async () => {
    const { token } = await createTestUser(app);
    const res = await app.request("/servers", {
      method: "POST",
      body: JSON.stringify({ name: "Test Server" }),
      headers: getAuthHeaders(token),
    });
    const data = (await res.json()) as any;
    expect(data.server.inviteCode).toMatch(/^[A-Za-z0-9]+$/);
  });

  test("invite codes are unique across servers", async () => {
    const { token } = await createTestUser(app);
    const codes = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const res = await app.request("/servers", {
        method: "POST",
        body: JSON.stringify({ name: `Server ${i}` }),
        headers: getAuthHeaders(token),
      });
      const data = (await res.json()) as any;
      codes.add(data.server.inviteCode);
    }
    expect(codes.size).toBe(5);
  });
});
