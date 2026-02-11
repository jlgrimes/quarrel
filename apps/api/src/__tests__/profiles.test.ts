import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import { setupDatabase, clearDatabase, createApp, createTestUser, getAuthHeaders, testDb } from "./helpers";
import { sql } from "drizzle-orm";
import type { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  await setupDatabase();
  try { await testDb.run(sql`ALTER TABLE users ADD COLUMN bio TEXT`); } catch {}
  try { await testDb.run(sql`ALTER TABLE users ADD COLUMN banner_url TEXT`); } catch {}
  try { await testDb.run(sql`ALTER TABLE users ADD COLUMN pronouns TEXT`); } catch {}
  app = createApp();
});

beforeEach(async () => {
  await clearDatabase();
});

async function createTestServer(app: Hono, token: string) {
  const res = await app.request("/servers", {
    method: "POST",
    body: JSON.stringify({ name: "Test Server" }),
    headers: getAuthHeaders(token),
  });
  return ((await res.json()) as any).server;
}

describe("Profile fields", () => {
  test("PATCH /users/me - update bio", async () => {
    const { token } = await createTestUser(app);
    const res = await app.request("/users/me", {
      method: "PATCH",
      body: JSON.stringify({ bio: "Hello world" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.user.bio).toBe("Hello world");
  });

  test("PATCH /users/me - update pronouns", async () => {
    const { token } = await createTestUser(app);
    const res = await app.request("/users/me", {
      method: "PATCH",
      body: JSON.stringify({ pronouns: "they/them" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.user.pronouns).toBe("they/them");
  });

  test("PATCH /users/me - update bannerUrl", async () => {
    const { token } = await createTestUser(app);
    const res = await app.request("/users/me", {
      method: "PATCH",
      body: JSON.stringify({ bannerUrl: "https://example.com/banner.png" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.user.bannerUrl).toBe("https://example.com/banner.png");
  });

  test("PATCH /users/me - bio exceeding 190 chars rejected", async () => {
    const { token } = await createTestUser(app);
    const res = await app.request("/users/me", {
      method: "PATCH",
      body: JSON.stringify({ bio: "a".repeat(191) }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
  });

  test("PATCH /users/me - pronouns exceeding 50 chars rejected", async () => {
    const { token } = await createTestUser(app);
    const res = await app.request("/users/me", {
      method: "PATCH",
      body: JSON.stringify({ pronouns: "a".repeat(51) }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
  });

  test("GET /users/:id - returns bio, bannerUrl, pronouns", async () => {
    const { token, user } = await createTestUser(app);
    await app.request("/users/me", {
      method: "PATCH",
      body: JSON.stringify({ bio: "My bio", bannerUrl: "https://example.com/b.png", pronouns: "she/her" }),
      headers: getAuthHeaders(token),
    });
    const res = await app.request(`/users/${user.id}`, {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.user.bio).toBe("My bio");
    expect(data.user.bannerUrl).toBe("https://example.com/b.png");
    expect(data.user.pronouns).toBe("she/her");
  });
});

describe("Server nicknames", () => {
  test("PATCH /servers/:id/members/me/nickname - set nickname", async () => {
    const { token } = await createTestUser(app);
    const server = await createTestServer(app, token);
    const res = await app.request(`/servers/${server.id}/members/me/nickname`, {
      method: "PATCH",
      body: JSON.stringify({ nickname: "Cool Nick" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.member.nickname).toBe("Cool Nick");
  });

  test("PATCH /servers/:id/members/me/nickname - clear nickname", async () => {
    const { token } = await createTestUser(app);
    const server = await createTestServer(app, token);
    // Set then clear
    await app.request(`/servers/${server.id}/members/me/nickname`, {
      method: "PATCH",
      body: JSON.stringify({ nickname: "Temp" }),
      headers: getAuthHeaders(token),
    });
    const res = await app.request(`/servers/${server.id}/members/me/nickname`, {
      method: "PATCH",
      body: JSON.stringify({ nickname: null }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.member.nickname).toBeNull();
  });

  test("PATCH /servers/:id/members/me/nickname - non-member gets 403", async () => {
    const { token } = await createTestUser(app);
    const { token: token2 } = await createTestUser(app, "other", "other@example.com");
    const server = await createTestServer(app, token);
    const res = await app.request(`/servers/${server.id}/members/me/nickname`, {
      method: "PATCH",
      body: JSON.stringify({ nickname: "Hacker" }),
      headers: getAuthHeaders(token2),
    });
    expect(res.status).toBe(403);
  });

  test("PATCH /servers/:id/members/me/nickname - nickname > 32 chars rejected", async () => {
    const { token } = await createTestUser(app);
    const server = await createTestServer(app, token);
    const res = await app.request(`/servers/${server.id}/members/me/nickname`, {
      method: "PATCH",
      body: JSON.stringify({ nickname: "a".repeat(33) }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
  });
});
