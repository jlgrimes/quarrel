import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import {
  setupDatabase,
  clearDatabase,
  createApp,
  createTestUser,
  getAuthHeaders,
  testDb,
  analyticsMock,
} from "./helpers";

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  await setupDatabase();
  app = createApp();
});

beforeEach(async () => {
  await clearDatabase();
  analyticsMock.clear();
});

describe("Reserved usernames", () => {
  test("blocks registration with reserved username 'claude'", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "claude",
        email: "someone@test.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(409);
  });

  test("blocks registration with reserved username 'chatgpt' (case insensitive)", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "ChatGPT",
        email: "someone@test.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(409);
  });

  test("blocks registration with reserved username 'gemini'", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "gemini",
        email: "someone@test.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(409);
  });

  test("allows non-reserved usernames", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "normaluser",
        email: "normal@test.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(201);
  });
});

async function createServerWithOwner() {
  const { token, user } = await createTestUser(app, "owner", "owner@test.com");

  const serverRes = await app.request("/servers", {
    method: "POST",
    body: JSON.stringify({ name: "Test Server" }),
    headers: getAuthHeaders(token),
  });
  const { server } = (await serverRes.json()) as any;
  return { token, user, server };
}

async function seedBotUser() {
  // Insert a bot user for testing
  await testDb.run(
    `INSERT OR IGNORE INTO users (id, username, display_name, email, hashed_password, status, is_bot)
     VALUES ('00000000-0000-0000-0000-000000000001', 'claude', 'Claude', 'claude@bot.quarrel', 'BOT_NO_LOGIN', 'online', 1)`
  );
  await testDb.run(
    `INSERT OR IGNORE INTO users (id, username, display_name, email, hashed_password, status, is_bot)
     VALUES ('00000000-0000-0000-0000-000000000002', 'chatgpt', 'ChatGPT', 'chatgpt@bot.quarrel', 'BOT_NO_LOGIN', 'online', 1)`
  );
  await testDb.run(
    `INSERT OR IGNORE INTO users (id, username, display_name, email, hashed_password, status, is_bot)
     VALUES ('00000000-0000-0000-0000-000000000003', 'gemini', 'Gemini', 'gemini@bot.quarrel', 'BOT_NO_LOGIN', 'online', 1)`
  );
}

describe("Bot CRUD", () => {
  test("owner can add a bot", async () => {
    await seedBotUser();
    const { token, server } = await createServerWithOwner();

    const res = await app.request(`/servers/${server.id}/bots`, {
      method: "POST",
      body: JSON.stringify({
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250929",
        apiKey: "sk-test-key",
      }),
      headers: getAuthHeaders(token),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.bot.provider).toBe("anthropic");
    expect(data.bot.hasApiKey).toBe(true);
  });

  test("owner can list bots (apiKey not exposed)", async () => {
    await seedBotUser();
    const { token, server } = await createServerWithOwner();

    // Add a bot first
    await app.request(`/servers/${server.id}/bots`, {
      method: "POST",
      body: JSON.stringify({
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250929",
        apiKey: "sk-secret-key",
      }),
      headers: getAuthHeaders(token),
    });

    const res = await app.request(`/servers/${server.id}/bots`, {
      method: "GET",
      headers: getAuthHeaders(token),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.bots.length).toBe(1);
    expect(data.bots[0].hasApiKey).toBe(true);
    expect(data.bots[0].apiKey).toBeUndefined();
    expect(data.bots[0].botUser).toBeDefined();
    expect(data.bots[0].botUser.username).toBe("claude");
  });

  test("owner can update bot", async () => {
    await seedBotUser();
    const { token, server } = await createServerWithOwner();

    const addRes = await app.request(`/servers/${server.id}/bots`, {
      method: "POST",
      body: JSON.stringify({
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250929",
        apiKey: "sk-test-key",
      }),
      headers: getAuthHeaders(token),
    });
    const { bot } = (await addRes.json()) as any;

    const res = await app.request(`/servers/${server.id}/bots/${bot.id}`, {
      method: "PATCH",
      body: JSON.stringify({ model: "claude-opus-4-6", enabled: false }),
      headers: getAuthHeaders(token),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.bot.model).toBe("claude-opus-4-6");
    expect(data.bot.enabled).toBe(false);
  });

  test("owner can remove bot", async () => {
    await seedBotUser();
    const { token, server } = await createServerWithOwner();

    const addRes = await app.request(`/servers/${server.id}/bots`, {
      method: "POST",
      body: JSON.stringify({
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250929",
        apiKey: "sk-test-key",
      }),
      headers: getAuthHeaders(token),
    });
    const { bot } = (await addRes.json()) as any;

    const res = await app.request(`/servers/${server.id}/bots/${bot.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    });

    expect(res.status).toBe(200);

    // Verify bot is gone
    const listRes = await app.request(`/servers/${server.id}/bots`, {
      method: "GET",
      headers: getAuthHeaders(token),
    });
    const data = (await listRes.json()) as any;
    expect(data.bots.length).toBe(0);
  });

  test("non-owner gets 403 on bot mutations", async () => {
    await seedBotUser();
    const { server } = await createServerWithOwner();

    // Create a non-owner user
    const { token: memberToken } = await createTestUser(app, "member", "member@test.com");

    // Join the server
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    // Try to add bot
    const res = await app.request(`/servers/${server.id}/bots`, {
      method: "POST",
      body: JSON.stringify({
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250929",
        apiKey: "sk-test-key",
      }),
      headers: getAuthHeaders(memberToken),
    });

    expect(res.status).toBe(403);
  });

  test("non-owner can list bots", async () => {
    await seedBotUser();
    const { token: ownerToken, server } = await createServerWithOwner();

    // Add bot as owner
    await app.request(`/servers/${server.id}/bots`, {
      method: "POST",
      body: JSON.stringify({
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250929",
        apiKey: "sk-test-key",
      }),
      headers: getAuthHeaders(ownerToken),
    });

    // Create a non-owner member
    const { token: memberToken } = await createTestUser(app, "member", "member@test.com");
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    // Member can list bots
    const res = await app.request(`/servers/${server.id}/bots`, {
      method: "GET",
      headers: getAuthHeaders(memberToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.bots.length).toBe(1);
  });

  test("duplicate bot returns 409", async () => {
    await seedBotUser();
    const { token, server } = await createServerWithOwner();

    await app.request(`/servers/${server.id}/bots`, {
      method: "POST",
      body: JSON.stringify({
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250929",
        apiKey: "sk-test-key",
      }),
      headers: getAuthHeaders(token),
    });

    const res = await app.request(`/servers/${server.id}/bots`, {
      method: "POST",
      body: JSON.stringify({
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250929",
        apiKey: "sk-other-key",
      }),
      headers: getAuthHeaders(token),
    });

    expect(res.status).toBe(409);
  });

  test("analytics events are captured for bot operations", async () => {
    await seedBotUser();
    const { token, user, server } = await createServerWithOwner();

    // Add bot
    const addRes = await app.request(`/servers/${server.id}/bots`, {
      method: "POST",
      body: JSON.stringify({
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250929",
        apiKey: "sk-test-key",
      }),
      headers: getAuthHeaders(token),
    });
    const { bot } = (await addRes.json()) as any;

    expect(analyticsMock.events.some((e) => e.event === "bot:added")).toBe(true);

    // Update bot
    await app.request(`/servers/${server.id}/bots/${bot.id}`, {
      method: "PATCH",
      body: JSON.stringify({ model: "claude-opus-4-6" }),
      headers: getAuthHeaders(token),
    });
    expect(analyticsMock.events.some((e) => e.event === "bot:updated")).toBe(true);

    // Remove bot
    await app.request(`/servers/${server.id}/bots/${bot.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    });
    expect(analyticsMock.events.some((e) => e.event === "bot:removed")).toBe(true);
  });
});
