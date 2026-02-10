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

// Helper: create a server, return token/user/server/channel
async function createServerAndChannel(
  app: Hono,
  username = "testuser",
  email = "test@example.com",
  serverName = "Test Server"
) {
  const { token, user } = await createTestUser(app, username, email);
  const serverRes = await app.request("/servers", {
    method: "POST",
    body: JSON.stringify({ name: serverName }),
    headers: getAuthHeaders(token),
  });
  const { server } = (await serverRes.json()) as any;

  const channelsRes = await app.request(`/servers/${server.id}/channels`, {
    headers: getAuthHeaders(token),
  });
  const { channels } = (await channelsRes.json()) as any;
  const channel = channels[0]; // #general

  return { token, user, server, channel };
}

// Helper: send a message to a channel
async function sendMessage(
  app: Hono,
  token: string,
  channelId: string,
  content: string
) {
  const res = await app.request(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
    headers: getAuthHeaders(token),
  });
  return (await res.json()) as any;
}

describe("GET /search", () => {
  test("requires authentication", async () => {
    const res = await app.request("/search?q=hello");
    expect(res.status).toBe(401);
  });

  test("requires query parameter", async () => {
    const { token } = await createServerAndChannel(app);
    const res = await app.request("/search", {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
  });

  test("returns empty results when no messages match", async () => {
    const { token } = await createServerAndChannel(app);
    const res = await app.request("/search?q=nonexistent", {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages).toEqual([]);
    expect(data.total).toBe(0);
  });

  test("finds messages by content", async () => {
    const { token, channel } = await createServerAndChannel(app);
    await sendMessage(app, token, channel.id, "Hello world!");
    await sendMessage(app, token, channel.id, "Goodbye world!");
    await sendMessage(app, token, channel.id, "Something else");

    const res = await app.request("/search?q=world", {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages.length).toBe(2);
    expect(data.total).toBe(2);
    // Should include author info
    expect(data.messages[0].author).toBeDefined();
    expect(data.messages[0].author.username).toBe("testuser");
  });

  test("includes channel and server context", async () => {
    const { token, channel, server } = await createServerAndChannel(app);
    await sendMessage(app, token, channel.id, "Hello world!");

    const res = await app.request("/search?q=Hello", {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages.length).toBe(1);
    expect(data.messages[0].channel).toBeDefined();
    expect(data.messages[0].channel.name).toBe("general");
    expect(data.messages[0].server).toBeDefined();
    expect(data.messages[0].server.name).toBe("Test Server");
  });

  test("filters by serverId", async () => {
    const { token, channel: ch1, server: s1 } = await createServerAndChannel(app);
    // Create a second server
    const server2Res = await app.request("/servers", {
      method: "POST",
      body: JSON.stringify({ name: "Server 2" }),
      headers: getAuthHeaders(token),
    });
    const { server: s2 } = (await server2Res.json()) as any;
    const ch2Res = await app.request(`/servers/${s2.id}/channels`, {
      headers: getAuthHeaders(token),
    });
    const { channels: ch2s } = (await ch2Res.json()) as any;
    const ch2 = ch2s[0];

    await sendMessage(app, token, ch1.id, "hello from server 1");
    await sendMessage(app, token, ch2.id, "hello from server 2");

    const res = await app.request(`/search?q=hello&serverId=${s1.id}`, {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages.length).toBe(1);
    expect(data.messages[0].content).toBe("hello from server 1");
  });

  test("filters by channelId", async () => {
    const { token, server } = await createServerAndChannel(app);

    // Create a second channel
    const createChRes = await app.request(`/servers/${server.id}/channels`, {
      method: "POST",
      body: JSON.stringify({ name: "random" }),
      headers: getAuthHeaders(token),
    });
    const { channel: ch2 } = (await createChRes.json()) as any;

    // Get the general channel
    const chListRes = await app.request(`/servers/${server.id}/channels`, {
      headers: getAuthHeaders(token),
    });
    const { channels: allChs } = (await chListRes.json()) as any;
    const general = allChs.find((ch: any) => ch.name === "general");

    await sendMessage(app, token, general.id, "hello in general");
    await sendMessage(app, token, ch2.id, "hello in random");

    const res = await app.request(`/search?q=hello&channelId=${ch2.id}`, {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages.length).toBe(1);
    expect(data.messages[0].content).toBe("hello in random");
  });

  test("filters by authorId", async () => {
    const { token: ownerToken, user: owner, channel, server } =
      await createServerAndChannel(app);

    // Create second user and join server
    const { token: user2Token, user: user2 } = await createTestUser(
      app,
      "user2",
      "user2@example.com"
    );
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(user2Token),
    });

    await sendMessage(app, ownerToken, channel.id, "hello from owner");
    await sendMessage(app, user2Token, channel.id, "hello from user2");

    const res = await app.request(
      `/search?q=hello&authorId=${user2.id}`,
      { headers: getAuthHeaders(ownerToken) }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages.length).toBe(1);
    expect(data.messages[0].content).toBe("hello from user2");
  });

  test("excludes deleted messages", async () => {
    const { token, channel } = await createServerAndChannel(app);
    const { message } = await sendMessage(
      app,
      token,
      channel.id,
      "hello to delete"
    );
    await sendMessage(app, token, channel.id, "hello to keep");

    // Delete the first message
    await app.request(`/messages/${message.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    });

    const res = await app.request("/search?q=hello", {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages.length).toBe(1);
    expect(data.messages[0].content).toBe("hello to keep");
  });

  test("only returns messages from servers user is a member of", async () => {
    // User 1 creates a server with a message
    const { token: t1, channel: ch1 } = await createServerAndChannel(app);
    await sendMessage(app, t1, ch1.id, "secret hello");

    // User 2 creates their own server
    const { token: t2 } = await createServerAndChannel(
      app,
      "user2",
      "user2@example.com",
      "User 2 Server"
    );

    // User 2 should not see user 1's messages
    const res = await app.request("/search?q=secret", {
      headers: getAuthHeaders(t2),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages.length).toBe(0);
  });

  test("pagination with limit and offset", async () => {
    const { token, channel } = await createServerAndChannel(app);
    for (let i = 1; i <= 5; i++) {
      await sendMessage(app, token, channel.id, `searchable msg ${i}`);
    }

    // Page 1: limit 2
    const res1 = await app.request("/search?q=searchable&limit=2&offset=0", {
      headers: getAuthHeaders(token),
    });
    const data1 = (await res1.json()) as any;
    expect(data1.messages.length).toBe(2);
    expect(data1.total).toBe(5);

    // Page 2: limit 2, offset 2
    const res2 = await app.request("/search?q=searchable&limit=2&offset=2", {
      headers: getAuthHeaders(token),
    });
    const data2 = (await res2.json()) as any;
    expect(data2.messages.length).toBe(2);
    expect(data2.total).toBe(5);

    // Page 3: limit 2, offset 4
    const res3 = await app.request("/search?q=searchable&limit=2&offset=4", {
      headers: getAuthHeaders(token),
    });
    const data3 = (await res3.json()) as any;
    expect(data3.messages.length).toBe(1);
    expect(data3.total).toBe(5);
  });

  test("returns 403 when filtering by non-member server", async () => {
    const { token: t1 } = await createServerAndChannel(app);
    const { server: s2 } = await createServerAndChannel(
      app,
      "user2",
      "user2@example.com",
      "Other Server"
    );

    const res = await app.request(`/search?q=hello&serverId=${s2.id}`, {
      headers: getAuthHeaders(t1),
    });
    expect(res.status).toBe(403);
  });

  test("case-insensitive search", async () => {
    const { token, channel } = await createServerAndChannel(app);
    await sendMessage(app, token, channel.id, "Hello World");

    // SQLite LIKE is case-insensitive for ASCII by default
    const res = await app.request("/search?q=hello", {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages.length).toBe(1);
  });

  test("results ordered newest first", async () => {
    const { token, channel } = await createServerAndChannel(app);
    await sendMessage(app, token, channel.id, "test first");
    await new Promise((r) => setTimeout(r, 1100));
    await sendMessage(app, token, channel.id, "test second");

    const res = await app.request("/search?q=test", {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages.length).toBe(2);
    expect(data.messages[0].content).toBe("test second");
    expect(data.messages[1].content).toBe("test first");
  });
});
