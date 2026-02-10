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

// Helper to create a server and return the serverId
async function createTestServer(app: Hono, token: string, name = "Test Server") {
  const res = await app.request("/servers", {
    method: "POST",
    headers: getAuthHeaders(token),
    body: JSON.stringify({ name }),
  });
  const data = (await res.json()) as any;
  return data.server;
}

describe("POST /servers/:serverId/roles", () => {
  test("owner can create a role", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const server = await createTestServer(app, token);

    const res = await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ name: "Moderator", color: "#ff0000", permissions: 6 }),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.role).toBeDefined();
    expect(data.role.name).toBe("Moderator");
    expect(data.role.color).toBe("#ff0000");
    expect(data.role.permissions).toBe(6);
    expect(data.role.serverId).toBe(server.id);
  });

  test("non-owner cannot create a role", async () => {
    const { token: ownerToken } = await createTestUser(app, "alice", "alice@example.com");
    const { token: memberToken } = await createTestUser(app, "bob", "bob@example.com");
    const server = await createTestServer(app, ownerToken);

    // Bob joins the server
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    const res = await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
      body: JSON.stringify({ name: "Admin" }),
    });
    expect(res.status).toBe(403);
  });

  test("returns 404 for non-existent server", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");

    const res = await app.request(`/servers/fake-id/roles`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ name: "Admin" }),
    });
    expect(res.status).toBe(404);
  });

  test("returns 400 for invalid role data", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const server = await createTestServer(app, token);

    const res = await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ name: "" }),
    });
    expect(res.status).toBe(400);
  });

  test("roles get incrementing positions", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const server = await createTestServer(app, token);

    const res1 = await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ name: "Role1" }),
    });
    const data1 = (await res1.json()) as any;
    expect(data1.role.position).toBe(0);

    const res2 = await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ name: "Role2" }),
    });
    const data2 = (await res2.json()) as any;
    expect(data2.role.position).toBe(1);
  });
});

describe("GET /servers/:serverId/roles", () => {
  test("member can list roles", async () => {
    const { token: ownerToken } = await createTestUser(app, "alice", "alice@example.com");
    const { token: memberToken } = await createTestUser(app, "bob", "bob@example.com");
    const server = await createTestServer(app, ownerToken);

    // Bob joins
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    // Create a role
    await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
      body: JSON.stringify({ name: "Moderator" }),
    });

    // Bob can list roles
    const res = await app.request(`/servers/${server.id}/roles`, {
      headers: getAuthHeaders(memberToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.roles.length).toBe(1);
    expect(data.roles[0].name).toBe("Moderator");
  });

  test("non-member cannot list roles", async () => {
    const { token: ownerToken } = await createTestUser(app, "alice", "alice@example.com");
    const { token: outsiderToken } = await createTestUser(app, "bob", "bob@example.com");
    const server = await createTestServer(app, ownerToken);

    const res = await app.request(`/servers/${server.id}/roles`, {
      headers: getAuthHeaders(outsiderToken),
    });
    expect(res.status).toBe(403);
  });

  test("roles are sorted by position", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const server = await createTestServer(app, token);

    await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ name: "First" }),
    });
    await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ name: "Second" }),
    });

    const res = await app.request(`/servers/${server.id}/roles`, {
      headers: getAuthHeaders(token),
    });
    const data = (await res.json()) as any;
    expect(data.roles[0].name).toBe("First");
    expect(data.roles[1].name).toBe("Second");
  });
});

describe("PATCH /roles/:id", () => {
  test("owner can update a role", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const server = await createTestServer(app, token);

    const createRes = await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ name: "Mod" }),
    });
    const { role } = (await createRes.json()) as any;

    const res = await app.request(`/roles/${role.id}`, {
      method: "PATCH",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ name: "Moderator", color: "#00ff00" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.role.name).toBe("Moderator");
    expect(data.role.color).toBe("#00ff00");
  });

  test("non-owner cannot update a role", async () => {
    const { token: ownerToken } = await createTestUser(app, "alice", "alice@example.com");
    const { token: memberToken } = await createTestUser(app, "bob", "bob@example.com");
    const server = await createTestServer(app, ownerToken);

    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    const createRes = await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
      body: JSON.stringify({ name: "Mod" }),
    });
    const { role } = (await createRes.json()) as any;

    const res = await app.request(`/roles/${role.id}`, {
      method: "PATCH",
      headers: getAuthHeaders(memberToken),
      body: JSON.stringify({ name: "Hacked" }),
    });
    expect(res.status).toBe(403);
  });

  test("returns 404 for non-existent role", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");

    const res = await app.request(`/roles/fake-id`, {
      method: "PATCH",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ name: "Nope" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /roles/:id", () => {
  test("owner can delete a role when multiple exist", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const server = await createTestServer(app, token);

    // Create two roles
    const res1 = await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ name: "Role1" }),
    });
    const { role: role1 } = (await res1.json()) as any;

    await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ name: "Role2" }),
    });

    const res = await app.request(`/roles/${role1.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
  });

  test("cannot delete the only role", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const server = await createTestServer(app, token);

    const createRes = await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ name: "OnlyRole" }),
    });
    const { role } = (await createRes.json()) as any;

    const res = await app.request(`/roles/${role.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toContain("only role");
  });

  test("non-owner cannot delete a role", async () => {
    const { token: ownerToken } = await createTestUser(app, "alice", "alice@example.com");
    const { token: memberToken } = await createTestUser(app, "bob", "bob@example.com");
    const server = await createTestServer(app, ownerToken);

    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    const createRes = await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
      body: JSON.stringify({ name: "Mod" }),
    });
    const { role } = (await createRes.json()) as any;

    const res = await app.request(`/roles/${role.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(memberToken),
    });
    expect(res.status).toBe(403);
  });
});

describe("PUT /servers/:serverId/members/:userId/roles/:roleId", () => {
  test("owner can assign a role to a member", async () => {
    const { token: ownerToken } = await createTestUser(app, "alice", "alice@example.com");
    const { token: memberToken, user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const server = await createTestServer(app, ownerToken);

    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    const createRes = await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
      body: JSON.stringify({ name: "Moderator", color: "#ff0000" }),
    });
    const { role } = (await createRes.json()) as any;

    const res = await app.request(`/servers/${server.id}/members/${bob.id}/roles/${role.id}`, {
      method: "PUT",
      headers: getAuthHeaders(ownerToken),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
  });

  test("cannot assign role twice", async () => {
    const { token: ownerToken } = await createTestUser(app, "alice", "alice@example.com");
    const { token: memberToken, user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const server = await createTestServer(app, ownerToken);

    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    const createRes = await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
      body: JSON.stringify({ name: "Moderator" }),
    });
    const { role } = (await createRes.json()) as any;

    await app.request(`/servers/${server.id}/members/${bob.id}/roles/${role.id}`, {
      method: "PUT",
      headers: getAuthHeaders(ownerToken),
    });

    const res = await app.request(`/servers/${server.id}/members/${bob.id}/roles/${role.id}`, {
      method: "PUT",
      headers: getAuthHeaders(ownerToken),
    });
    expect(res.status).toBe(409);
  });

  test("non-owner cannot assign roles", async () => {
    const { token: ownerToken } = await createTestUser(app, "alice", "alice@example.com");
    const { token: memberToken, user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const server = await createTestServer(app, ownerToken);

    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    const createRes = await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
      body: JSON.stringify({ name: "Moderator" }),
    });
    const { role } = (await createRes.json()) as any;

    const res = await app.request(`/servers/${server.id}/members/${bob.id}/roles/${role.id}`, {
      method: "PUT",
      headers: getAuthHeaders(memberToken),
    });
    expect(res.status).toBe(403);
  });

  test("returns 404 for non-existent member", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const server = await createTestServer(app, token);

    const createRes = await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ name: "Mod" }),
    });
    const { role } = (await createRes.json()) as any;

    const res = await app.request(`/servers/${server.id}/members/fake-user/roles/${role.id}`, {
      method: "PUT",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /servers/:serverId/members/:userId/roles/:roleId", () => {
  test("owner can remove a role from a member", async () => {
    const { token: ownerToken } = await createTestUser(app, "alice", "alice@example.com");
    const { token: memberToken, user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const server = await createTestServer(app, ownerToken);

    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    const createRes = await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
      body: JSON.stringify({ name: "Moderator" }),
    });
    const { role } = (await createRes.json()) as any;

    // Assign the role
    await app.request(`/servers/${server.id}/members/${bob.id}/roles/${role.id}`, {
      method: "PUT",
      headers: getAuthHeaders(ownerToken),
    });

    // Remove the role
    const res = await app.request(`/servers/${server.id}/members/${bob.id}/roles/${role.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(ownerToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
  });

  test("non-owner cannot remove roles", async () => {
    const { token: ownerToken, user: alice } = await createTestUser(app, "alice", "alice@example.com");
    const { token: memberToken, user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const server = await createTestServer(app, ownerToken);

    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    const createRes = await app.request(`/servers/${server.id}/roles`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
      body: JSON.stringify({ name: "Moderator" }),
    });
    const { role } = (await createRes.json()) as any;

    // Assign to alice (owner)
    await app.request(`/servers/${server.id}/members/${alice.id}/roles/${role.id}`, {
      method: "PUT",
      headers: getAuthHeaders(ownerToken),
    });

    // Bob tries to remove
    const res = await app.request(`/servers/${server.id}/members/${alice.id}/roles/${role.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(memberToken),
    });
    expect(res.status).toBe(403);
  });
});
