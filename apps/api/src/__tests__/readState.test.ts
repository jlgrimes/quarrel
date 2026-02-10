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

// Helper to create a server and get its default channel
async function createServerWithChannel(token: string) {
  const serverRes = await app.request("/servers", {
    method: "POST",
    body: JSON.stringify({ name: "Test Server" }),
    headers: getAuthHeaders(token),
  });
  const { server } = (await serverRes.json()) as any;

  const channelRes = await app.request(`/servers/${server.id}/channels`, {
    method: "POST",
    body: JSON.stringify({ name: "general", type: "text" }),
    headers: getAuthHeaders(token),
  });
  const { channel } = (await channelRes.json()) as any;

  return { server, channel };
}

describe("POST /channels/:id/ack", () => {
  test("marks channel as read", async () => {
    const { token, user } = await createTestUser(app, "alice", "alice@test.com");
    const { channel } = await createServerWithChannel(token);

    // Send a message
    await app.request(`/channels/${channel.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Hello!" }),
      headers: getAuthHeaders(token),
    });

    // Ack
    const res = await app.request(`/channels/${channel.id}/ack`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.lastReadMessageId).toBeDefined();
  });

  test("ack reduces unread count to 0", async () => {
    const { token, user } = await createTestUser(app, "alice", "alice@test.com");
    const { server, channel } = await createServerWithChannel(token);

    // Send messages
    await app.request(`/channels/${channel.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Message 1" }),
      headers: getAuthHeaders(token),
    });
    await app.request(`/channels/${channel.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Message 2" }),
      headers: getAuthHeaders(token),
    });

    // Check unread count before ack
    const beforeRes = await app.request(`/servers/${server.id}/channels`, {
      headers: getAuthHeaders(token),
    });
    const beforeData = (await beforeRes.json()) as any;
    const channelBefore = beforeData.channels.find((c: any) => c.id === channel.id);
    expect(channelBefore.unreadCount).toBe(2);

    // Ack
    await app.request(`/channels/${channel.id}/ack`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });

    // Check unread count after ack
    const afterRes = await app.request(`/servers/${server.id}/channels`, {
      headers: getAuthHeaders(token),
    });
    const afterData = (await afterRes.json()) as any;
    const channelAfter = afterData.channels.find((c: any) => c.id === channel.id);
    expect(channelAfter.unreadCount).toBe(0);
  });

  test("returns 404 for non-existent channel", async () => {
    const { token } = await createTestUser(app, "alice", "alice@test.com");
    const res = await app.request("/channels/non-existent/ack", {
      method: "POST",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(404);
  });

  test("returns 403 for non-member", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@test.com");
    const { token: bobToken } = await createTestUser(app, "bob", "bob@test.com");
    const { channel } = await createServerWithChannel(aliceToken);

    const res = await app.request(`/channels/${channel.id}/ack`, {
      method: "POST",
      headers: getAuthHeaders(bobToken),
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /dms/:conversationId/ack", () => {
  test("marks DM conversation as read", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@test.com");
    const { token: bobToken, user: bob } = await createTestUser(app, "bob", "bob@test.com");

    // Create conversation
    const convRes = await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    // Bob sends a message
    await app.request(`/dms/${conversation.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Hey Alice!" }),
      headers: getAuthHeaders(bobToken),
    });

    // Alice acks
    const res = await app.request(`/dms/${conversation.id}/ack`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.lastReadMessageId).toBeDefined();
  });

  test("ack reduces DM unread count to 0", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@test.com");
    const { token: bobToken, user: bob } = await createTestUser(app, "bob", "bob@test.com");

    // Create conversation
    const convRes = await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    // Bob sends messages
    await app.request(`/dms/${conversation.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Message 1" }),
      headers: getAuthHeaders(bobToken),
    });
    await app.request(`/dms/${conversation.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Message 2" }),
      headers: getAuthHeaders(bobToken),
    });

    // Check unread count before ack
    const beforeRes = await app.request("/dms/conversations", {
      headers: getAuthHeaders(aliceToken),
    });
    const beforeData = (await beforeRes.json()) as any;
    const convBefore = beforeData.conversations.find((c: any) => c.id === conversation.id);
    expect(convBefore.unreadCount).toBe(2);

    // Alice acks
    await app.request(`/dms/${conversation.id}/ack`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });

    // Check unread count after ack
    const afterRes = await app.request("/dms/conversations", {
      headers: getAuthHeaders(aliceToken),
    });
    const afterData = (await afterRes.json()) as any;
    const convAfter = afterData.conversations.find((c: any) => c.id === conversation.id);
    expect(convAfter.unreadCount).toBe(0);
  });

  test("returns 403 for non-member", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@test.com");
    const { user: bob } = await createTestUser(app, "bob", "bob@test.com");
    const { token: carolToken } = await createTestUser(app, "carol", "carol@test.com");

    const convRes = await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    const res = await app.request(`/dms/${conversation.id}/ack`, {
      method: "POST",
      headers: getAuthHeaders(carolToken),
    });
    expect(res.status).toBe(403);
  });
});

describe("GET /servers/:serverId/channels - unread counts", () => {
  test("channels include unreadCount and lastReadMessageId", async () => {
    const { token } = await createTestUser(app, "alice", "alice@test.com");
    const { server, channel } = await createServerWithChannel(token);

    // Send a message
    await app.request(`/channels/${channel.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Hello!" }),
      headers: getAuthHeaders(token),
    });

    const res = await app.request(`/servers/${server.id}/channels`, {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    const ch = data.channels.find((c: any) => c.id === channel.id);
    expect(ch).toHaveProperty("unreadCount");
    expect(ch).toHaveProperty("lastReadMessageId");
    expect(ch.unreadCount).toBe(1);
    expect(ch.lastReadMessageId).toBeNull();
  });
});

describe("GET /dms/conversations - unread counts", () => {
  test("conversations include unreadCount", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@test.com");
    const { token: bobToken, user: bob } = await createTestUser(app, "bob", "bob@test.com");

    const convRes = await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    // Bob sends a message
    await app.request(`/dms/${conversation.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Hey!" }),
      headers: getAuthHeaders(bobToken),
    });

    const res = await app.request("/dms/conversations", {
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    const conv = data.conversations.find((c: any) => c.id === conversation.id);
    expect(conv).toHaveProperty("unreadCount");
    expect(conv.unreadCount).toBe(1);
  });
});
