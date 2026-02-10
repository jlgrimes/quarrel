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

async function sendTestMessage(app: Hono, channelId: string, token: string, content: string) {
  const res = await app.request(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
    headers: getAuthHeaders(token),
  });
  const data = (await res.json()) as any;
  return data.message;
}

describe("POST /messages/:id/pin", () => {
  test("server owner can pin a message", async () => {
    const { token, channel } = await createServerAndChannel(app);
    const message = await sendTestMessage(app, channel.id, token, "Pin this!");

    const res = await app.request(`/messages/${message.id}/pin`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.message.pinnedAt).toBeDefined();
    expect(data.message.pinnedBy).toBeDefined();
  });

  test("returns 400 if already pinned", async () => {
    const { token, channel } = await createServerAndChannel(app);
    const message = await sendTestMessage(app, channel.id, token, "Pin this!");

    await app.request(`/messages/${message.id}/pin`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });

    const res = await app.request(`/messages/${message.id}/pin`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
  });

  test("non-owner cannot pin", async () => {
    const { token: ownerToken, channel, server } = await createServerAndChannel(app);
    const { token: otherToken } = await createTestUser(app, "other", "other@example.com");

    // Other user joins the server
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(otherToken),
    });

    const message = await sendTestMessage(app, channel.id, ownerToken, "Owner message");

    const res = await app.request(`/messages/${message.id}/pin`, {
      method: "POST",
      headers: getAuthHeaders(otherToken),
    });
    expect(res.status).toBe(403);
  });

  test("returns 404 for non-existent message", async () => {
    const { token } = await createServerAndChannel(app);

    const res = await app.request(`/messages/non-existent-id/pin`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /messages/:id/pin", () => {
  test("server owner can unpin a message", async () => {
    const { token, channel } = await createServerAndChannel(app);
    const message = await sendTestMessage(app, channel.id, token, "Pinned!");

    await app.request(`/messages/${message.id}/pin`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });

    const res = await app.request(`/messages/${message.id}/pin`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.message.pinnedAt).toBeNull();
    expect(data.message.pinnedBy).toBeNull();
  });

  test("returns 400 if not pinned", async () => {
    const { token, channel } = await createServerAndChannel(app);
    const message = await sendTestMessage(app, channel.id, token, "Not pinned");

    const res = await app.request(`/messages/${message.id}/pin`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
  });

  test("non-owner cannot unpin", async () => {
    const { token: ownerToken, channel, server } = await createServerAndChannel(app);
    const { token: otherToken } = await createTestUser(app, "other", "other@example.com");

    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(otherToken),
    });

    const message = await sendTestMessage(app, channel.id, ownerToken, "Pinned!");
    await app.request(`/messages/${message.id}/pin`, {
      method: "POST",
      headers: getAuthHeaders(ownerToken),
    });

    const res = await app.request(`/messages/${message.id}/pin`, {
      method: "DELETE",
      headers: getAuthHeaders(otherToken),
    });
    expect(res.status).toBe(403);
  });
});

describe("GET /channels/:id/pins", () => {
  test("returns pinned messages for a channel", async () => {
    const { token, channel } = await createServerAndChannel(app);

    const msg1 = await sendTestMessage(app, channel.id, token, "Pinned 1");
    const msg2 = await sendTestMessage(app, channel.id, token, "Not pinned");
    const msg3 = await sendTestMessage(app, channel.id, token, "Pinned 2");

    await app.request(`/messages/${msg1.id}/pin`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });
    await app.request(`/messages/${msg3.id}/pin`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });

    const res = await app.request(`/channels/${channel.id}/pins`, {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages.length).toBe(2);
    // Should include authors
    expect(data.messages[0].author).toBeDefined();
    // Should not include unpinned message
    const ids = data.messages.map((m: any) => m.id);
    expect(ids).not.toContain(msg2.id);
  });

  test("returns empty array if no pins", async () => {
    const { token, channel } = await createServerAndChannel(app);

    const res = await app.request(`/channels/${channel.id}/pins`, {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages.length).toBe(0);
  });

  test("non-member cannot view pins", async () => {
    const { channel } = await createServerAndChannel(app);
    const { token: otherToken } = await createTestUser(app, "other", "other@example.com");

    const res = await app.request(`/channels/${channel.id}/pins`, {
      headers: getAuthHeaders(otherToken),
    });
    expect(res.status).toBe(403);
  });
});
