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

// Helper: create a server, get #general channel, and send a message
async function createServerAndMessage(app: Hono) {
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

  const msgRes = await app.request(`/channels/${channel.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: "Hello world!" }),
    headers: getAuthHeaders(token),
  });
  const { message } = (await msgRes.json()) as any;

  return { token, user, server, channel, message };
}

describe("PUT /messages/:id/reactions/:emoji", () => {
  test("adds a reaction", async () => {
    const { token, message } = await createServerAndMessage(app);

    const res = await app.request(
      `/messages/${message.id}/reactions/${encodeURIComponent("👍")}`,
      {
        method: "PUT",
        headers: getAuthHeaders(token),
      }
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.reaction).toBeDefined();
    expect(data.reaction.emoji).toBe("👍");
    expect(data.reaction.messageId).toBe(message.id);
  });

  test("returns existing reaction on duplicate", async () => {
    const { token, message } = await createServerAndMessage(app);

    // Add reaction twice
    await app.request(
      `/messages/${message.id}/reactions/${encodeURIComponent("👍")}`,
      { method: "PUT", headers: getAuthHeaders(token) }
    );
    const res = await app.request(
      `/messages/${message.id}/reactions/${encodeURIComponent("👍")}`,
      { method: "PUT", headers: getAuthHeaders(token) }
    );
    expect(res.status).toBe(200);
  });

  test("returns 404 for nonexistent message", async () => {
    const { token } = await createServerAndMessage(app);

    const res = await app.request(
      `/messages/nonexistent/reactions/${encodeURIComponent("👍")}`,
      { method: "PUT", headers: getAuthHeaders(token) }
    );
    expect(res.status).toBe(404);
  });

  test("multiple users can react to same message", async () => {
    const { token: token1, message, server } = await createServerAndMessage(app);
    const { token: token2 } = await createTestUser(app, "user2", "user2@example.com");

    // User2 joins the server
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(token2),
    });

    // Both users add the same reaction
    await app.request(
      `/messages/${message.id}/reactions/${encodeURIComponent("🎉")}`,
      { method: "PUT", headers: getAuthHeaders(token1) }
    );
    await app.request(
      `/messages/${message.id}/reactions/${encodeURIComponent("🎉")}`,
      { method: "PUT", headers: getAuthHeaders(token2) }
    );

    // Check reactions
    const res = await app.request(`/messages/${message.id}/reactions`, {
      headers: getAuthHeaders(token1),
    });
    const data = (await res.json()) as any;
    expect(data.reactions.length).toBe(1);
    expect(data.reactions[0].emoji).toBe("🎉");
    expect(data.reactions[0].count).toBe(2);
    expect(data.reactions[0].me).toBe(true);
  });
});

describe("DELETE /messages/:id/reactions/:emoji", () => {
  test("removes own reaction", async () => {
    const { token, message } = await createServerAndMessage(app);

    // Add and then remove
    await app.request(
      `/messages/${message.id}/reactions/${encodeURIComponent("👍")}`,
      { method: "PUT", headers: getAuthHeaders(token) }
    );

    const res = await app.request(
      `/messages/${message.id}/reactions/${encodeURIComponent("👍")}`,
      { method: "DELETE", headers: getAuthHeaders(token) }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);

    // Verify reaction is gone
    const checkRes = await app.request(`/messages/${message.id}/reactions`, {
      headers: getAuthHeaders(token),
    });
    const checkData = (await checkRes.json()) as any;
    expect(checkData.reactions.length).toBe(0);
  });

  test("returns 404 when reaction doesn't exist", async () => {
    const { token, message } = await createServerAndMessage(app);

    const res = await app.request(
      `/messages/${message.id}/reactions/${encodeURIComponent("👍")}`,
      { method: "DELETE", headers: getAuthHeaders(token) }
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /messages/:id/reactions", () => {
  test("returns aggregated reactions with me flag", async () => {
    const { token: token1, message, server } = await createServerAndMessage(app);
    const { token: token2 } = await createTestUser(app, "user2", "user2@example.com");

    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(token2),
    });

    // User1 adds 👍, User2 adds 👍 and ❤️
    await app.request(
      `/messages/${message.id}/reactions/${encodeURIComponent("👍")}`,
      { method: "PUT", headers: getAuthHeaders(token1) }
    );
    await app.request(
      `/messages/${message.id}/reactions/${encodeURIComponent("👍")}`,
      { method: "PUT", headers: getAuthHeaders(token2) }
    );
    await app.request(
      `/messages/${message.id}/reactions/${encodeURIComponent("❤️")}`,
      { method: "PUT", headers: getAuthHeaders(token2) }
    );

    // Check from user1's perspective
    const res1 = await app.request(`/messages/${message.id}/reactions`, {
      headers: getAuthHeaders(token1),
    });
    const data1 = (await res1.json()) as any;
    expect(data1.reactions.length).toBe(2);

    const thumbs = data1.reactions.find((r: any) => r.emoji === "👍");
    expect(thumbs.count).toBe(2);
    expect(thumbs.me).toBe(true);

    const heart = data1.reactions.find((r: any) => r.emoji === "❤️");
    expect(heart.count).toBe(1);
    expect(heart.me).toBe(false);

    // Check from user2's perspective
    const res2 = await app.request(`/messages/${message.id}/reactions`, {
      headers: getAuthHeaders(token2),
    });
    const data2 = (await res2.json()) as any;
    const heart2 = data2.reactions.find((r: any) => r.emoji === "❤️");
    expect(heart2.me).toBe(true);
  });
});

describe("GET /channels/:channelId/messages - reactions included", () => {
  test("messages include reactions array", async () => {
    const { token, channel, message } = await createServerAndMessage(app);

    // Add a reaction
    await app.request(
      `/messages/${message.id}/reactions/${encodeURIComponent("👍")}`,
      { method: "PUT", headers: getAuthHeaders(token) }
    );

    // Fetch messages
    const res = await app.request(`/channels/${channel.id}/messages`, {
      headers: getAuthHeaders(token),
    });
    const data = (await res.json()) as any;
    expect(data.messages.length).toBe(1);
    expect(data.messages[0].reactions).toBeDefined();
    expect(Array.isArray(data.messages[0].reactions)).toBe(true);
    expect(data.messages[0].reactions.length).toBe(1);
    expect(data.messages[0].reactions[0].emoji).toBe("👍");
    expect(data.messages[0].reactions[0].count).toBe(1);
    expect(data.messages[0].reactions[0].me).toBe(true);
  });

  test("messages with no reactions have empty array", async () => {
    const { token, channel } = await createServerAndMessage(app);

    const res = await app.request(`/channels/${channel.id}/messages`, {
      headers: getAuthHeaders(token),
    });
    const data = (await res.json()) as any;
    expect(data.messages[0].reactions).toEqual([]);
  });
});
