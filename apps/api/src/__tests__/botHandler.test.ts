import { describe, test, expect, beforeAll, beforeEach, mock } from "bun:test";
import {
  setupDatabase,
  clearDatabase,
  testDb,
  analyticsMock,
} from "./helpers";

// Mock the AI providers module before importing botHandler
mock.module("../lib/aiProviders", () => ({
  callAIProvider: async () => "Hello! I'm a bot response.",
}));

// Mock the ws module to capture broadcasts
const broadcasts: any[] = [];
mock.module("../ws", () => ({
  broadcastToChannel: (channelId: string, event: string, data: any) => {
    broadcasts.push({ channelId, event, data });
  },
  broadcastToServer: () => {},
  sendToUser: () => {},
}));

const { handleBotMentions, _testing } = await import("../lib/botHandler");
const { callAIProvider } = await import("../lib/aiProviders");

beforeAll(async () => {
  await setupDatabase();
});

beforeEach(async () => {
  await clearDatabase();
  analyticsMock.clear();
  broadcasts.length = 0;
  _testing.rateLimitMap.clear();
});

async function seedBotAndServer() {
  // Create a bot user
  await testDb.run(
    `INSERT INTO users (id, username, display_name, email, hashed_password, status, is_bot)
     VALUES ('bot-1', 'claude', 'Claude', 'claude@bot.quarrel', 'BOT_NO_LOGIN', 'online', 1)`
  );
  // Create a regular user
  await testDb.run(
    `INSERT INTO users (id, username, display_name, email, hashed_password, status, is_bot)
     VALUES ('user-1', 'testuser', 'Test User', 'test@test.com', 'hashed', 'online', 0)`
  );
  // Create server
  await testDb.run(
    `INSERT INTO servers (id, name, owner_id, invite_code)
     VALUES ('server-1', 'Test Server', 'user-1', 'test-invite')`
  );
  // Create channel
  await testDb.run(
    `INSERT INTO channels (id, server_id, name, type, position)
     VALUES ('channel-1', 'server-1', 'general', 'text', 0)`
  );
  // Create members
  await testDb.run(
    `INSERT INTO members (id, user_id, server_id)
     VALUES ('member-1', 'user-1', 'server-1')`
  );
  await testDb.run(
    `INSERT INTO members (id, user_id, server_id)
     VALUES ('member-2', 'bot-1', 'server-1')`
  );
  // Create server_bot config
  await testDb.run(
    `INSERT INTO server_bots (id, server_id, bot_user_id, provider, model, api_key, enabled)
     VALUES ('sb-1', 'server-1', 'bot-1', 'anthropic', 'claude-sonnet-4-5-20250929', 'sk-test', 1)`
  );
}

describe("Bot Handler", () => {
  test("no mentions → no AI calls", async () => {
    await seedBotAndServer();
    broadcasts.length = 0;
    await handleBotMentions("channel-1", "server-1", "Hello everyone!", "user-1");
    // No message:new broadcasts for bot
    const botMessages = broadcasts.filter(
      (b) => b.event === "message:new" && b.data?.author?.isBot
    );
    expect(botMessages.length).toBe(0);
  });

  test("non-bot mention → no AI calls", async () => {
    await seedBotAndServer();
    broadcasts.length = 0;
    await handleBotMentions("channel-1", "server-1", "Hey <@user-1> what's up?", "user-1");
    const botMessages = broadcasts.filter(
      (b) => b.event === "message:new" && b.data?.author?.isBot
    );
    expect(botMessages.length).toBe(0);
  });

  test("bot not in server → no AI calls", async () => {
    // Create bot user but no server_bot config
    await testDb.run(
      `INSERT INTO users (id, username, display_name, email, hashed_password, status, is_bot)
       VALUES ('bot-orphan', 'orphanbot', 'Orphan Bot', 'orphan@bot.quarrel', 'BOT_NO_LOGIN', 'online', 1)`
    );
    await testDb.run(
      `INSERT INTO users (id, username, display_name, email, hashed_password, status, is_bot)
       VALUES ('user-orphan', 'testuser2', 'Test', 'test2@test.com', 'hashed', 'online', 0)`
    );
    await testDb.run(
      `INSERT INTO servers (id, name, owner_id, invite_code)
       VALUES ('server-orphan', 'Server 2', 'user-orphan', 'inv2')`
    );
    await testDb.run(
      `INSERT INTO channels (id, server_id, name, type, position)
       VALUES ('channel-orphan', 'server-orphan', 'general', 'text', 0)`
    );

    broadcasts.length = 0;
    await handleBotMentions("channel-orphan", "server-orphan", "Hey <@bot-orphan>", "user-orphan");
    const botMessages = broadcasts.filter(
      (b) => b.event === "message:new" && b.data?.author?.isBot
    );
    expect(botMessages.length).toBe(0);
  });

  test("valid mention → AI call + message saved + broadcast", async () => {
    await seedBotAndServer();
    broadcasts.length = 0;

    await handleBotMentions("channel-1", "server-1", "Hey <@bot-1> how are you?", "user-1");

    // Should have typing and message:new broadcasts
    const typingBroadcasts = broadcasts.filter((b) => b.event === "typing:update");
    expect(typingBroadcasts.length).toBe(1);

    const messageBroadcasts = broadcasts.filter((b) => b.event === "message:new");
    expect(messageBroadcasts.length).toBe(1);
    expect(messageBroadcasts[0].data.author.isBot).toBe(true);
    expect(messageBroadcasts[0].data.content).toBe("Hello! I'm a bot response.");

    // Verify analytics events
    expect(analyticsMock.events.some((e) => e.event === "bot:mention")).toBe(true);
    expect(analyticsMock.events.some((e) => e.event === "bot:response_sent")).toBe(true);
  });

  test("plain @username mention triggers bot response", async () => {
    await seedBotAndServer();
    broadcasts.length = 0;

    await handleBotMentions("channel-1", "server-1", "Hey @claude can you help?", "user-1");

    const messageBroadcasts = broadcasts.filter((b) => b.event === "message:new");
    expect(messageBroadcasts.length).toBe(1);
    expect(messageBroadcasts[0].data.author.isBot).toBe(true);
  });

  test("rate limiting works", async () => {
    await seedBotAndServer();
    broadcasts.length = 0;

    // First call should work
    await handleBotMentions("channel-1", "server-1", "Hey <@bot-1> first", "user-1");
    const first = broadcasts.filter((b) => b.event === "message:new");
    expect(first.length).toBe(1);

    // Second call within rate limit should be skipped
    broadcasts.length = 0;
    await handleBotMentions("channel-1", "server-1", "Hey <@bot-1> second", "user-1");
    const second = broadcasts.filter((b) => b.event === "message:new");
    expect(second.length).toBe(0);
  });

  test("disabled bot → no response", async () => {
    await seedBotAndServer();
    // Disable the bot
    await testDb.run(`UPDATE server_bots SET enabled = 0 WHERE id = 'sb-1'`);

    broadcasts.length = 0;
    await handleBotMentions("channel-1", "server-1", "Hey <@bot-1> hello?", "user-1");
    const botMessages = broadcasts.filter((b) => b.event === "message:new");
    expect(botMessages.length).toBe(0);
  });
});
