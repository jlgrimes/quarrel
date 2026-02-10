import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import {
  setupDatabase,
  clearDatabase,
  createApp,
  createTestUser,
  loginTestUser,
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

describe("POST /auth/register", () => {
  test("creates user and returns token", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "alice",
        email: "alice@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.token).toBeDefined();
    expect(data.user).toBeDefined();
    expect(data.user.username).toBe("alice");
    expect(data.user.email).toBe("alice@example.com");
    expect(data.user.hashedPassword).toBeUndefined();
  });

  test("rejects duplicate email", async () => {
    await createTestUser(app, "alice", "alice@example.com");
    const res = await app.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "bob",
        email: "alice@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(409);
    const data = (await res.json()) as any;
    expect(data.error).toContain("Email");
  });

  test("rejects duplicate username", async () => {
    await createTestUser(app, "alice", "alice@example.com");
    const res = await app.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "alice",
        email: "bob@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(409);
    const data = (await res.json()) as any;
    expect(data.error).toContain("Username");
  });

  test("validates input - short password", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "alice",
        email: "alice@example.com",
        password: "abc",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
  });

  test("validates input - invalid email", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "alice",
        email: "not-an-email",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /auth/login", () => {
  test("returns token for valid credentials", async () => {
    await createTestUser(app, "alice", "alice@example.com", "password123");
    const res = await app.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.token).toBeDefined();
    expect(data.user.username).toBe("alice");
  });

  test("rejects wrong password", async () => {
    await createTestUser(app, "alice", "alice@example.com", "password123");
    const res = await app.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "alice@example.com",
        password: "wrongpassword",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
    const data = (await res.json()) as any;
    expect(data.error).toContain("Invalid");
  });

  test("rejects non-existent email", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "nobody@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
    const data = (await res.json()) as any;
    expect(data.error).toContain("Invalid");
  });
});

describe("GET /auth/me", () => {
  test("returns user with valid session", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const res = await app.request("/auth/me", {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.user.username).toBe("alice");
    expect(data.user.hashedPassword).toBeUndefined();
  });

  test("does not expose session token in response", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const res = await app.request("/auth/me", {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.token).toBeUndefined();
  });

  test("returns 401 without auth", async () => {
    const res = await app.request("/auth/me");
    expect(res.status).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  test("destroys session", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const logoutRes = await app.request("/auth/logout", {
      method: "POST",
      headers: getAuthHeaders(token),
    });
    expect(logoutRes.status).toBe(200);
    const data = (await logoutRes.json()) as any;
    expect(data.success).toBe(true);

    // Session should now be invalid
    const meRes = await app.request("/auth/me", {
      headers: getAuthHeaders(token),
    });
    expect(meRes.status).toBe(401);
  });
});
