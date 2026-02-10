import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import {
  setupDatabase,
  clearDatabase,
  createApp,
  createTestUser,
  getAuthHeaders,
  loginTestUser,
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

describe("GET /users/me/settings", () => {
  test("returns default settings for new user", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const res = await app.request("/users/me/settings", {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.settings).toBeDefined();
    expect(data.settings.theme).toBe("dark");
    expect(data.settings.fontSize).toBe("normal");
    expect(data.settings.compactMode).toBe(false);
    expect(data.settings.notificationsEnabled).toBe(true);
    expect(data.settings.notificationSounds).toBe(true);
    expect(data.settings.allowDms).toBe("everyone");
  });

  test("returns same settings on subsequent calls", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");

    // First call creates settings
    const res1 = await app.request("/users/me/settings", {
      headers: getAuthHeaders(token),
    });
    const data1 = (await res1.json()) as any;

    // Second call returns same settings
    const res2 = await app.request("/users/me/settings", {
      headers: getAuthHeaders(token),
    });
    const data2 = (await res2.json()) as any;

    expect(data2.settings.id).toBe(data1.settings.id);
  });

  test("returns 401 without auth", async () => {
    const res = await app.request("/users/me/settings", {
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /users/me/settings", () => {
  test("updates theme", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const res = await app.request("/users/me/settings", {
      method: "PATCH",
      body: JSON.stringify({ theme: "light" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.settings.theme).toBe("light");
  });

  test("updates multiple settings at once", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const res = await app.request("/users/me/settings", {
      method: "PATCH",
      body: JSON.stringify({
        theme: "light",
        fontSize: "large",
        compactMode: true,
        notificationsEnabled: false,
        notificationSounds: false,
        allowDms: "friends",
      }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.settings.theme).toBe("light");
    expect(data.settings.fontSize).toBe("large");
    expect(data.settings.compactMode).toBe(true);
    expect(data.settings.notificationsEnabled).toBe(false);
    expect(data.settings.notificationSounds).toBe(false);
    expect(data.settings.allowDms).toBe("friends");
  });

  test("rejects invalid theme", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const res = await app.request("/users/me/settings", {
      method: "PATCH",
      body: JSON.stringify({ theme: "rainbow" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
  });

  test("rejects invalid fontSize", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const res = await app.request("/users/me/settings", {
      method: "PATCH",
      body: JSON.stringify({ fontSize: "huge" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
  });

  test("rejects invalid allowDms", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const res = await app.request("/users/me/settings", {
      method: "PATCH",
      body: JSON.stringify({ allowDms: "strangers" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
  });

  test("creates settings row if it does not exist yet", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    // Directly patch without calling GET first
    const res = await app.request("/users/me/settings", {
      method: "PATCH",
      body: JSON.stringify({ theme: "light" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.settings.theme).toBe("light");
    // Other fields should be defaults
    expect(data.settings.fontSize).toBe("normal");
  });

  test("returns 401 without auth", async () => {
    const res = await app.request("/users/me/settings", {
      method: "PATCH",
      body: JSON.stringify({ theme: "light" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /users/me/password", () => {
  test("changes password successfully", async () => {
    const { token } = await createTestUser(
      app,
      "alice",
      "alice@example.com",
      "oldpassword123"
    );

    const res = await app.request("/users/me/password", {
      method: "PATCH",
      body: JSON.stringify({
        currentPassword: "oldpassword123",
        newPassword: "newpassword456",
      }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);

    // Verify new password works for login
    const loginRes = await loginTestUser(
      app,
      "alice@example.com",
      "newpassword456"
    );
    expect(loginRes.status).toBe(200);
  });

  test("rejects wrong current password", async () => {
    const { token } = await createTestUser(
      app,
      "alice",
      "alice@example.com",
      "password123"
    );

    const res = await app.request("/users/me/password", {
      method: "PATCH",
      body: JSON.stringify({
        currentPassword: "wrongpassword",
        newPassword: "newpassword456",
      }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(403);
  });

  test("rejects same password", async () => {
    const { token } = await createTestUser(
      app,
      "alice",
      "alice@example.com",
      "password123"
    );

    const res = await app.request("/users/me/password", {
      method: "PATCH",
      body: JSON.stringify({
        currentPassword: "password123",
        newPassword: "password123",
      }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
  });

  test("rejects password too short", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");

    const res = await app.request("/users/me/password", {
      method: "PATCH",
      body: JSON.stringify({
        currentPassword: "password123",
        newPassword: "short",
      }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
  });

  test("returns 401 without auth", async () => {
    const res = await app.request("/users/me/password", {
      method: "PATCH",
      body: JSON.stringify({
        currentPassword: "old",
        newPassword: "new12345",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /users/me/account", () => {
  test("deletes account with correct password", async () => {
    const { token } = await createTestUser(
      app,
      "alice",
      "alice@example.com",
      "password123"
    );

    const res = await app.request("/users/me/account", {
      method: "DELETE",
      body: JSON.stringify({ password: "password123" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);

    // Verify user can no longer log in
    const loginRes = await app.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(loginRes.status).toBe(401);
  });

  test("rejects wrong password", async () => {
    const { token } = await createTestUser(
      app,
      "alice",
      "alice@example.com",
      "password123"
    );

    const res = await app.request("/users/me/account", {
      method: "DELETE",
      body: JSON.stringify({ password: "wrongpassword" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(403);
  });

  test("returns 401 without auth", async () => {
    const res = await app.request("/users/me/account", {
      method: "DELETE",
      body: JSON.stringify({ password: "anything" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });
});
