import { describe, test, expect, beforeAll, beforeEach, mock } from "bun:test";

let shouldFailProvider = false;
mock.module("../lib/aiProviders", () => ({
  callAIProvider: async () => {
    if (shouldFailProvider) {
      throw new Error("OpenAI API error (429): insufficient_quota");
    }
    return "pong";
  },
  callAIProviderStream: async () => {
    if (shouldFailProvider) {
      throw new Error("OpenAI API error (429): insufficient_quota");
    }
    return "pong";
  },
}));

const {
  setupDatabase,
  clearDatabase,
  createApp,
  createTestUser,
  getAuthHeaders,
  testDb,
} = await import("./helpers");

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  await setupDatabase();
  app = createApp();
});

beforeEach(async () => {
  shouldFailProvider = false;
  await clearDatabase();
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
  await testDb.run(
    `INSERT OR IGNORE INTO users (id, username, display_name, email, hashed_password, status, is_bot)
     VALUES ('00000000-0000-0000-0000-000000000002', 'chatgpt', 'ChatGPT', 'chatgpt@bot.quarrel', 'BOT_NO_LOGIN', 'online', 1)`
  );
}

describe("Bot connection test endpoint", () => {
  test("owner can test bot connection successfully", async () => {
    await seedBotUser();
    const { token, server } = await createServerWithOwner();

    const addRes = await app.request(`/servers/${server.id}/bots`, {
      method: "POST",
      body: JSON.stringify({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "sk-test-key",
      }),
      headers: getAuthHeaders(token),
    });
    const { bot } = (await addRes.json()) as any;

    const res = await app.request(`/servers/${server.id}/bots/${bot.id}/test`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.responsePreview).toContain("pong");
  });

  test("test endpoint returns success false with provider error details", async () => {
    await seedBotUser();
    const { token, server } = await createServerWithOwner();
    shouldFailProvider = true;

    const addRes = await app.request(`/servers/${server.id}/bots`, {
      method: "POST",
      body: JSON.stringify({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "sk-test-key",
      }),
      headers: getAuthHeaders(token),
    });
    const { bot } = (await addRes.json()) as any;

    const res = await app.request(`/servers/${server.id}/bots/${bot.id}/test`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(false);
    expect(String(data.error)).toContain("insufficient_quota");
  });

  test("non-owner cannot test bot connection", async () => {
    await seedBotUser();
    const { token: ownerToken, server } = await createServerWithOwner();
    const { token: memberToken } = await createTestUser(app, "member", "member@test.com");

    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    const addRes = await app.request(`/servers/${server.id}/bots`, {
      method: "POST",
      body: JSON.stringify({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "sk-test-key",
      }),
      headers: getAuthHeaders(ownerToken),
    });
    const { bot } = (await addRes.json()) as any;

    const res = await app.request(`/servers/${server.id}/bots/${bot.id}/test`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });
    expect(res.status).toBe(403);
  });
});
