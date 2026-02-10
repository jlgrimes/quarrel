import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import {
  setupDatabase,
  clearDatabase,
  createApp,
  createTestUser,
  getAuthHeaders,
  testDb,
} from "./helpers";
import type { Hono } from "hono";
import { sql } from "drizzle-orm";

let app: Hono;

beforeAll(async () => {
  await setupDatabase();
  app = createApp();
});

beforeEach(async () => {
  await clearDatabase();
});

// --- #19 LOW-1: Weak password policy ---
describe("password policy (min 8 characters)", () => {
  test("rejects 6-character password on register", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "alice",
        email: "alice@example.com",
        password: "abcdef", // 6 chars - too short
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
  });

  test("rejects 7-character password on register", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "alice",
        email: "alice@example.com",
        password: "abcdefg", // 7 chars - too short
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
  });

  test("accepts 8-character password on register", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "alice",
        email: "alice@example.com",
        password: "abcdefgh", // 8 chars - minimum allowed
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(201);
  });

  test("rejects 7-character password on login", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "alice@example.com",
        password: "abcdefg", // 7 chars - too short
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
  });
});

// --- #20 LOW-2: Expired sessions never cleaned up ---
describe("expired session cleanup", () => {
  test("expired session is deleted from database on access", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");

    // Manually set the session to be expired using raw SQL
    const expiredTimestamp = Math.floor((Date.now() - 60000) / 1000);
    await testDb.run(
      sql`UPDATE sessions SET expires_at = ${expiredTimestamp} WHERE id = ${token}`
    );

    // Try to access with expired token - should get 401
    const res = await app.request("/auth/me", {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(401);

    // Verify the session was deleted from the database
    const result = await testDb.all(
      sql`SELECT id FROM sessions WHERE id = ${token}`
    );
    expect(result.length).toBe(0);
  });
});

// --- #22 LOW-4: parseInt without validation ---
describe("limit parameter parsing (NaN handling)", () => {
  // Helper: create a server and return the first channel
  async function createServerAndChannel(app: Hono) {
    const { token, user } = await createTestUser(app);
    const serverRes = await app.request("/servers", {
      method: "POST",
      body: JSON.stringify({ name: "Test Server" }),
      headers: getAuthHeaders(token),
    });
    const { server } = (await serverRes.json()) as any;

    const channelsRes = await app.request(`/servers/${server.id}/channels`, {
      headers: getAuthHeaders(token),
    });
    const { channels } = (await channelsRes.json()) as any;
    const channel = channels[0];

    return { token, user, server, channel };
  }

  test("channel messages: invalid limit defaults to batch size", async () => {
    const { token, channel } = await createServerAndChannel(app);

    // Send a message first
    await app.request(`/channels/${channel.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Hello" }),
      headers: getAuthHeaders(token),
    });

    // Request with invalid limit like "abc"
    const res = await app.request(
      `/channels/${channel.id}/messages?limit=abc`,
      { headers: getAuthHeaders(token) }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    // Should not error - should return messages using default batch size
    expect(data.messages).toBeDefined();
    expect(data.messages.length).toBe(1);
  });

  test("channel messages: limit=0 defaults to batch size", async () => {
    const { token, channel } = await createServerAndChannel(app);

    await app.request(`/channels/${channel.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Hello" }),
      headers: getAuthHeaders(token),
    });

    const res = await app.request(
      `/channels/${channel.id}/messages?limit=0`,
      { headers: getAuthHeaders(token) }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages).toBeDefined();
    expect(data.messages.length).toBe(1);
  });

  test("DM messages: invalid limit defaults to batch size", async () => {
    const { token: aliceToken } = await createTestUser(
      app,
      "alice",
      "alice@example.com"
    );
    const { user: bob } = await createTestUser(app, "bob", "bob@example.com");

    const convRes = await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    // Send a message
    await app.request(`/dms/${conversation.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Hey Bob!" }),
      headers: getAuthHeaders(aliceToken),
    });

    // Request with invalid limit
    const res = await app.request(
      `/dms/${conversation.id}/messages?limit=abc`,
      { headers: getAuthHeaders(aliceToken) }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages).toBeDefined();
    expect(data.messages.length).toBe(1);
  });

  test("DM messages: limit=0 defaults to batch size", async () => {
    const { token: aliceToken } = await createTestUser(
      app,
      "alice",
      "alice@example.com"
    );
    const { user: bob } = await createTestUser(app, "bob", "bob@example.com");

    const convRes = await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    await app.request(`/dms/${conversation.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Hey Bob!" }),
      headers: getAuthHeaders(aliceToken),
    });

    const res = await app.request(
      `/dms/${conversation.id}/messages?limit=0`,
      { headers: getAuthHeaders(aliceToken) }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages).toBeDefined();
    expect(data.messages.length).toBe(1);
  });
});
