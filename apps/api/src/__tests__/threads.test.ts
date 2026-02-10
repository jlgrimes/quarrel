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

// Helper: create a server, channel, and a message to thread on
async function createServerChannelAndMessage(app: Hono) {
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
  const channel = channels[0]; // #general

  const msgRes = await app.request(`/channels/${channel.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: "Parent message for thread" }),
    headers: getAuthHeaders(token),
  });
  const { message } = (await msgRes.json()) as any;

  return { token, user, server, channel, message };
}

describe("POST /messages/:id/threads", () => {
  test("creates a thread from a message", async () => {
    const { token, message } = await createServerChannelAndMessage(app);

    const res = await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.thread).toBeDefined();
    expect(data.thread.parentMessageId).toBe(message.id);
    expect(data.thread.id).toBeDefined();
    expect(data.firstMessage).toBeNull();
  });

  test("creates thread with initial message", async () => {
    const { token, message, user } = await createServerChannelAndMessage(app);

    const res = await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({ content: "First thread reply" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.thread).toBeDefined();
    expect(data.firstMessage).toBeDefined();
    expect(data.firstMessage.content).toBe("First thread reply");
    expect(data.firstMessage.author.id).toBe(user.id);
  });

  test("rejects duplicate thread on same message", async () => {
    const { token, message } = await createServerChannelAndMessage(app);

    await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });

    const res = await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toContain("already exists");
  });

  test("rejects non-member", async () => {
    const { message } = await createServerChannelAndMessage(app);
    const { token: otherToken } = await createTestUser(
      app,
      "other",
      "other@example.com"
    );

    const res = await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: getAuthHeaders(otherToken),
    });
    expect(res.status).toBe(403);
  });

  test("rejects nonexistent message", async () => {
    const { token } = await createServerChannelAndMessage(app);

    const res = await app.request("/messages/nonexistent-id/threads", {
      method: "POST",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /channels/:id/threads", () => {
  test("lists active threads in a channel", async () => {
    const { token, channel, message } =
      await createServerChannelAndMessage(app);

    // Create a thread
    await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({ content: "Thread reply" }),
      headers: getAuthHeaders(token),
    });

    const res = await app.request(`/channels/${channel.id}/threads`, {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.threads.length).toBe(1);
    expect(data.threads[0].parentMessageId).toBe(message.id);
    expect(data.threads[0].creator).toBeDefined();
    expect(data.threads[0].memberCount).toBeGreaterThanOrEqual(1);
  });

  test("returns empty for channel with no threads", async () => {
    const { token, channel } = await createServerChannelAndMessage(app);

    const res = await app.request(`/channels/${channel.id}/threads`, {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.threads.length).toBe(0);
  });

  test("excludes archived threads", async () => {
    const { token, channel, message } =
      await createServerChannelAndMessage(app);

    // Create and archive a thread
    const createRes = await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });
    const { thread } = (await createRes.json()) as any;

    await app.request(`/threads/${thread.id}`, {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });

    const res = await app.request(`/channels/${channel.id}/threads`, {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.threads.length).toBe(0);
  });
});

describe("GET /threads/:id", () => {
  test("returns thread details with members", async () => {
    const { token, message, user } = await createServerChannelAndMessage(app);

    const createRes = await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });
    const { thread } = (await createRes.json()) as any;

    const res = await app.request(`/threads/${thread.id}`, {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.thread.id).toBe(thread.id);
    expect(data.members.length).toBeGreaterThanOrEqual(1);
    expect(data.members[0].user).toBeDefined();
    expect(data.members[0].user.id).toBe(user.id);
  });

  test("returns 404 for nonexistent thread", async () => {
    const { token } = await createServerChannelAndMessage(app);

    const res = await app.request("/threads/nonexistent-id", {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /threads/:id/messages", () => {
  test("sends a message to a thread", async () => {
    const { token, message, user } = await createServerChannelAndMessage(app);

    const createRes = await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });
    const { thread } = (await createRes.json()) as any;

    const res = await app.request(`/threads/${thread.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Thread reply!" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.message.content).toBe("Thread reply!");
    expect(data.message.author.id).toBe(user.id);
  });

  test("auto-adds sender as thread member", async () => {
    const { token, message, server } =
      await createServerChannelAndMessage(app);

    const createRes = await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });
    const { thread } = (await createRes.json()) as any;

    // Create another user and have them join the server
    const { token: otherToken, user: otherUser } = await createTestUser(
      app,
      "other",
      "other@example.com"
    );
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(otherToken),
    });

    // Other user sends a message to the thread
    await app.request(`/threads/${thread.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Hello from other user" }),
      headers: getAuthHeaders(otherToken),
    });

    // Check thread details - other user should now be a member
    const detailRes = await app.request(`/threads/${thread.id}`, {
      headers: getAuthHeaders(token),
    });
    const detail = (await detailRes.json()) as any;
    const memberIds = detail.members.map((m: any) => m.userId);
    expect(memberIds).toContain(otherUser.id);
  });

  test("rejects message to archived thread", async () => {
    const { token, message } = await createServerChannelAndMessage(app);

    const createRes = await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });
    const { thread } = (await createRes.json()) as any;

    // Archive the thread
    await app.request(`/threads/${thread.id}`, {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });

    const res = await app.request(`/threads/${thread.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Should fail" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toContain("archived");
  });

  test("rejects non-member", async () => {
    const { message, token } = await createServerChannelAndMessage(app);
    const { token: otherToken } = await createTestUser(
      app,
      "other",
      "other@example.com"
    );

    const createRes = await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });
    const { thread } = (await createRes.json()) as any;

    const res = await app.request(`/threads/${thread.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Should fail" }),
      headers: getAuthHeaders(otherToken),
    });
    expect(res.status).toBe(403);
  });
});

describe("GET /threads/:id/messages", () => {
  test("lists thread messages (newest first)", async () => {
    const { token, message } = await createServerChannelAndMessage(app);

    const createRes = await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({ content: "First reply" }),
      headers: getAuthHeaders(token),
    });
    const { thread } = (await createRes.json()) as any;

    // Send a couple more messages with delay for timestamp ordering
    await app.request(`/threads/${thread.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Second reply" }),
      headers: getAuthHeaders(token),
    });
    await new Promise((r) => setTimeout(r, 1100));
    await app.request(`/threads/${thread.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Third reply" }),
      headers: getAuthHeaders(token),
    });

    const res = await app.request(`/threads/${thread.id}/messages`, {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages.length).toBe(3);
    // Newest first
    expect(data.messages[0].content).toBe("Third reply");
  });
});

describe("POST /threads/:id/members", () => {
  test("joins a thread", async () => {
    const { token, message, server } =
      await createServerChannelAndMessage(app);

    const createRes = await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });
    const { thread } = (await createRes.json()) as any;

    // Create another user and have them join the server
    const { token: otherToken } = await createTestUser(
      app,
      "other",
      "other@example.com"
    );
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(otherToken),
    });

    const res = await app.request(`/threads/${thread.id}/members`, {
      method: "POST",
      headers: getAuthHeaders(otherToken),
    });
    expect(res.status).toBe(201);
  });

  test("rejects duplicate join", async () => {
    const { token, message } = await createServerChannelAndMessage(app);

    const createRes = await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });
    const { thread } = (await createRes.json()) as any;

    // Creator is already a member
    const res = await app.request(`/threads/${thread.id}/members`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /threads/:id/members", () => {
  test("leaves a thread", async () => {
    const { token, message } = await createServerChannelAndMessage(app);

    const createRes = await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });
    const { thread } = (await createRes.json()) as any;

    const res = await app.request(`/threads/${thread.id}/members`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
  });

  test("rejects if not a member", async () => {
    const { token, message, server } =
      await createServerChannelAndMessage(app);
    const { token: otherToken } = await createTestUser(
      app,
      "other",
      "other@example.com"
    );
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(otherToken),
    });

    const createRes = await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });
    const { thread } = (await createRes.json()) as any;

    const res = await app.request(`/threads/${thread.id}/members`, {
      method: "DELETE",
      headers: getAuthHeaders(otherToken),
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /threads/:id/members", () => {
  test("updates notification preference", async () => {
    const { token, message } = await createServerChannelAndMessage(app);

    const createRes = await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });
    const { thread } = (await createRes.json()) as any;

    const res = await app.request(`/threads/${thread.id}/members`, {
      method: "PATCH",
      body: JSON.stringify({ notifyPreference: "mentions" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);

    // Verify the change
    const detailRes = await app.request(`/threads/${thread.id}`, {
      headers: getAuthHeaders(token),
    });
    const detail = (await detailRes.json()) as any;
    const myMember = detail.members.find(
      (m: any) => m.notifyPreference === "mentions"
    );
    expect(myMember).toBeDefined();
  });
});

describe("PATCH /threads/:id (archive)", () => {
  test("thread creator can archive", async () => {
    const { token, message } = await createServerChannelAndMessage(app);

    const createRes = await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });
    const { thread } = (await createRes.json()) as any;

    const res = await app.request(`/threads/${thread.id}`, {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.thread.archivedAt).toBeDefined();
  });

  test("non-creator/non-owner cannot archive", async () => {
    const { token, message, server } =
      await createServerChannelAndMessage(app);

    const createRes = await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });
    const { thread } = (await createRes.json()) as any;

    // Create another user and have them join
    const { token: otherToken } = await createTestUser(
      app,
      "other",
      "other@example.com"
    );
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(otherToken),
    });

    const res = await app.request(`/threads/${thread.id}`, {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: getAuthHeaders(otherToken),
    });
    expect(res.status).toBe(403);
  });
});

describe("thread member tracking", () => {
  test("original message author is added as thread member", async () => {
    const { token, message, user, server } =
      await createServerChannelAndMessage(app);

    // Create another user, have them join, and create a thread on the original user's message
    const { token: otherToken, user: otherUser } = await createTestUser(
      app,
      "other",
      "other@example.com"
    );
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(otherToken),
    });

    const createRes = await app.request(`/messages/${message.id}/threads`, {
      method: "POST",
      body: JSON.stringify({ content: "Starting a thread on your message" }),
      headers: getAuthHeaders(otherToken),
    });
    expect(createRes.status).toBe(201);
    const { thread } = (await createRes.json()) as any;

    // Check members - both the original author and thread creator should be members
    const detailRes = await app.request(`/threads/${thread.id}`, {
      headers: getAuthHeaders(token),
    });
    const detail = (await detailRes.json()) as any;
    const memberIds = detail.members.map((m: any) => m.userId);
    expect(memberIds).toContain(user.id); // original message author
    expect(memberIds).toContain(otherUser.id); // thread creator
  });
});
