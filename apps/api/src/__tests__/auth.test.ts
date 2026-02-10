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
import { parseCookie } from "./security-utils";

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

  test("rejects duplicate email with generic message", async () => {
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
    expect(data.error).toBe("Registration failed. Please try different credentials.");
  });

  test("rejects duplicate username with generic message", async () => {
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
    expect(data.error).toBe("Registration failed. Please try different credentials.");
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

  test("returns session token for WebSocket auth", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const res = await app.request("/auth/me", {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.token).toBe(token);
  });

  test("returns 401 without auth", async () => {
    const res = await app.request("/auth/me");
    expect(res.status).toBe(401);
  });
});

describe("online status", () => {
  test("user status is online after register", async () => {
    const { user } = await createTestUser(app, "alice", "alice@example.com");
    expect(user.status).toBe("online");
  });

  test("user status is online after login", async () => {
    await createTestUser(app, "alice", "alice@example.com", "password123");
    const { user } = await loginTestUser(app, "alice@example.com", "password123");
    expect(user.status).toBe("online");
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

describe("security", () => {
  test("session tokens are not UUIDs - uses crypto-secure random tokens", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "alice",
        email: "alice@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const data = (await res.json()) as any;
    // UUID v4 format: 8-4-4-4-12 hex chars
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(data.token).not.toMatch(uuidRegex);
    // base64url-encoded 32 bytes = 43 chars (no padding)
    expect(data.token.length).toBeGreaterThanOrEqual(40);
  });

  test("login session tokens are also crypto-secure", async () => {
    await createTestUser(app, "alice", "alice@example.com", "password123");
    const res = await app.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const data = (await res.json()) as any;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(data.token).not.toMatch(uuidRegex);
    expect(data.token.length).toBeGreaterThanOrEqual(40);
  });

  test("duplicate email and username return identical error messages (no enumeration)", async () => {
    await createTestUser(app, "alice", "alice@example.com");

    const emailDupRes = await app.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "bob",
        email: "alice@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const emailDupData = (await emailDupRes.json()) as any;

    // Clear rate limit state between requests
    await clearDatabase();
    await createTestUser(app, "alice", "alice@example.com");

    const usernameDupRes = await app.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "alice",
        email: "bob@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const usernameDupData = (await usernameDupRes.json()) as any;

    // Both should return the exact same error
    expect(emailDupData.error).toBe(usernameDupData.error);
    // Should not leak which field caused the conflict
    expect(emailDupData.error).not.toContain("Email");
    expect(emailDupData.error).not.toContain("Username");
    expect(emailDupData.error).not.toContain("email");
    expect(emailDupData.error).not.toContain("username");
  });

  test("responses include security headers", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    // secureHeaders() adds X-Content-Type-Options
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    // secureHeaders() adds X-Frame-Options
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
  });

  test("session cookie uses SameSite=Lax", async () => {
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
    const setCookieHeader = res.headers.get("Set-Cookie") || "";
    const cookie = parseCookie(setCookieHeader);
    expect(cookie["samesite"]).toBe("Lax");
  });
});
