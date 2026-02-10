import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import { setupDatabase, clearDatabase, createApp, resetRateLimiters } from "./helpers";
import type { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  await setupDatabase();
  app = createApp();
});

beforeEach(async () => {
  await clearDatabase();
  await resetRateLimiters();
});

describe("Auth rate limiting (/auth/register, /auth/login)", () => {
  test("allows up to 5 requests then returns 429", async () => {
    // The auth rate limiter allows 5 points per 60 seconds.
    // Each register call consumes 1 point. After 5 we should get 429.
    for (let i = 0; i < 5; i++) {
      const res = await app.request("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: `user${i}`,
          email: `user${i}@example.com`,
          password: "password123",
        }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(201);
    }

    // 6th request should be rate limited
    const blocked = await app.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "user5",
        email: "user5@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(blocked.status).toBe(429);
    const data = (await blocked.json()) as any;
    expect(data.error).toContain("Too many requests");
    expect(blocked.headers.get("Retry-After")).toBeDefined();
  });

  test("login endpoint is also rate limited", async () => {
    // First register a user
    await app.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "alice",
        email: "alice@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });

    // Register consumed 1 point. 4 more login attempts should succeed.
    for (let i = 0; i < 4; i++) {
      const res = await app.request("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "alice@example.com",
          password: "password123",
        }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(200);
    }

    // 6th request (1 register + 4 login + 1 more) should be rate limited
    const blocked = await app.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(blocked.status).toBe(429);
  });

  test("rate limit resets allow new requests", async () => {
    // Exhaust the auth rate limit
    for (let i = 0; i < 5; i++) {
      await app.request("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: `user${i}`,
          email: `user${i}@example.com`,
          password: "password123",
        }),
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify we're blocked
    const blocked = await app.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "blocked",
        email: "blocked@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(blocked.status).toBe(429);

    // Reset limiters (simulates time passing)
    await resetRateLimiters();

    // Should be allowed again
    const allowed = await app.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "allowed",
        email: "allowed@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(allowed.status).toBe(201);
  });
});

describe("429 response format", () => {
  test("includes Retry-After header and error message", async () => {
    // Exhaust auth limit
    for (let i = 0; i < 5; i++) {
      await app.request("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "nobody@example.com",
          password: "password123",
        }),
        headers: { "Content-Type": "application/json" },
      });
    }

    const res = await app.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "nobody@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(429);

    const retryAfter = res.headers.get("Retry-After");
    expect(retryAfter).toBeDefined();
    expect(Number(retryAfter)).toBeGreaterThan(0);

    const body = (await res.json()) as any;
    expect(body.error).toBe("Too many requests, please try again later");
  });
});
