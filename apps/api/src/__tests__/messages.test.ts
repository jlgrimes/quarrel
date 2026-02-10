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

// Helper: create a server and return the first channel (general)
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
  const channel = channels[0]; // #general

  return { token, user, server, channel };
}

describe("POST /channels/:id/messages", () => {
  test("sends message", async () => {
    const { token, channel, user } = await createServerAndChannel(app);
    const res = await app.request(`/channels/${channel.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Hello world!" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.message.content).toBe("Hello world!");
    expect(data.message.authorId).toBe(user.id);
    expect(data.message.author).toBeDefined();
    expect(data.message.author.username).toBe(user.username);
  });
});

describe("GET /channels/:id/messages", () => {
  test("lists messages (newest first)", async () => {
    const { token, channel } = await createServerAndChannel(app);
    // Send messages with delays so timestamps (stored as integer seconds) differ
    for (let i = 1; i <= 3; i++) {
      await app.request(`/channels/${channel.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: `Message ${i}` }),
        headers: getAuthHeaders(token),
      });
      if (i < 3) await new Promise((r) => setTimeout(r, 1100));
    }

    const res = await app.request(`/channels/${channel.id}/messages`, {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages.length).toBe(3);
    // Newest first
    expect(data.messages[0].content).toBe("Message 3");
    expect(data.messages[2].content).toBe("Message 1");
  });

  test("cursor pagination works", async () => {
    const { token, channel } = await createServerAndChannel(app);
    // Send messages with delays so timestamps differ
    for (let i = 1; i <= 5; i++) {
      await app.request(`/channels/${channel.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: `Message ${i}` }),
        headers: getAuthHeaders(token),
      });
      if (i < 5) await new Promise((r) => setTimeout(r, 1100));
    }

    // First page with limit 3
    const res1 = await app.request(
      `/channels/${channel.id}/messages?limit=3`,
      { headers: getAuthHeaders(token) }
    );
    const data1 = (await res1.json()) as any;
    expect(data1.messages.length).toBe(3);
    expect(data1.nextCursor).toBeDefined();

    // Second page using cursor
    const res2 = await app.request(
      `/channels/${channel.id}/messages?limit=3&cursor=${data1.nextCursor}`,
      { headers: getAuthHeaders(token) }
    );
    const data2 = (await res2.json()) as any;
    expect(data2.messages.length).toBe(2);
    expect(data2.nextCursor).toBeNull();
  });
});

describe("PATCH /messages/:id", () => {
  test("author can edit", async () => {
    const { token, channel } = await createServerAndChannel(app);
    const sendRes = await app.request(`/channels/${channel.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Original" }),
      headers: getAuthHeaders(token),
    });
    const { message } = (await sendRes.json()) as any;

    const res = await app.request(`/messages/${message.id}`, {
      method: "PATCH",
      body: JSON.stringify({ content: "Edited" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.message.content).toBe("Edited");
    expect(data.message.editedAt).toBeDefined();
  });

  test("non-author rejected", async () => {
    const { token: ownerToken, channel, server } =
      await createServerAndChannel(app);
    const { token: otherToken } = await createTestUser(
      app,
      "other",
      "other@example.com"
    );

    // Other user joins the server
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(otherToken),
    });

    // Owner sends a message
    const sendRes = await app.request(`/channels/${channel.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Owner message" }),
      headers: getAuthHeaders(ownerToken),
    });
    const { message } = (await sendRes.json()) as any;

    // Other user tries to edit it
    const res = await app.request(`/messages/${message.id}`, {
      method: "PATCH",
      body: JSON.stringify({ content: "Hacked" }),
      headers: getAuthHeaders(otherToken),
    });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /messages/:id", () => {
  test("soft deletes", async () => {
    const { token, channel } = await createServerAndChannel(app);
    const sendRes = await app.request(`/channels/${channel.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "To be deleted" }),
      headers: getAuthHeaders(token),
    });
    const { message } = (await sendRes.json()) as any;

    const res = await app.request(`/messages/${message.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);

    // Soft-deleted messages should NOT appear in the listing
    const listRes = await app.request(`/channels/${channel.id}/messages`, {
      headers: getAuthHeaders(token),
    });
    const listData = (await listRes.json()) as any;
    const deletedMsg = listData.messages.find((m: any) => m.id === message.id);
    expect(deletedMsg).toBeUndefined();
  });
});
