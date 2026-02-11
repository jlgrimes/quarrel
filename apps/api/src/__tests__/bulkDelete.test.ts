import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import {
  setupDatabase,
  clearDatabase,
  createApp,
  createTestUser,
  getAuthHeaders,
  testDb,
} from "./helpers";
import { sql } from "drizzle-orm";
import type { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  await setupDatabase();
  // Add description column for servers
  try {
    await testDb.run(sql`ALTER TABLE servers ADD COLUMN description TEXT`);
  } catch {}
  app = createApp();
});

beforeEach(async () => {
  await clearDatabase();
});

async function createServerWithChannel(app: Hono) {
  const { token, user } = await createTestUser(app, "owner", "owner@test.com");
  const serverRes = await app.request("/servers", {
    method: "POST",
    body: JSON.stringify({ name: "Test" }),
    headers: getAuthHeaders(token),
  });
  const { server } = (await serverRes.json()) as any;

  const channelsRes = await app.request(
    `/servers/${server.id}/channels`,
    { headers: getAuthHeaders(token) }
  );
  const { channels } = (await channelsRes.json()) as any;
  return { token, user, server, channel: channels[0] };
}

async function sendMessage(app: Hono, token: string, channelId: string, content: string) {
  const res = await app.request(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
    headers: getAuthHeaders(token),
  });
  const data = (await res.json()) as any;
  return data.message;
}

describe("POST /channels/:channelId/messages/bulk-delete", () => {
  test("owner can bulk delete messages", async () => {
    const { token, channel } = await createServerWithChannel(app);

    const msg1 = await sendMessage(app, token, channel.id, "msg1");
    const msg2 = await sendMessage(app, token, channel.id, "msg2");
    const msg3 = await sendMessage(app, token, channel.id, "msg3");

    const res = await app.request(
      `/channels/${channel.id}/messages/bulk-delete`,
      {
        method: "POST",
        body: JSON.stringify({ messageIds: [msg1.id, msg2.id] }),
        headers: getAuthHeaders(token),
      }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.deleted).toBe(2);
  });

  test("requires at least 2 message IDs", async () => {
    const { token, channel } = await createServerWithChannel(app);
    const msg = await sendMessage(app, token, channel.id, "msg");

    const res = await app.request(
      `/channels/${channel.id}/messages/bulk-delete`,
      {
        method: "POST",
        body: JSON.stringify({ messageIds: [msg.id] }),
        headers: getAuthHeaders(token),
      }
    );
    expect(res.status).toBe(400);
  });

  test("max 100 message IDs", async () => {
    const { token, channel } = await createServerWithChannel(app);

    const ids = Array.from({ length: 101 }, () => crypto.randomUUID());

    const res = await app.request(
      `/channels/${channel.id}/messages/bulk-delete`,
      {
        method: "POST",
        body: JSON.stringify({ messageIds: ids }),
        headers: getAuthHeaders(token),
      }
    );
    expect(res.status).toBe(400);
  });

  test("non-privileged cannot bulk delete", async () => {
    const { token, channel, server } = await createServerWithChannel(app);
    const { token: memberToken } = await createTestUser(
      app,
      "member",
      "member@test.com"
    );
    await app.request(`/servers/join/${server.inviteCode}`, {
      method: "POST",
      headers: getAuthHeaders(memberToken),
    });

    const msg1 = await sendMessage(app, token, channel.id, "msg1");
    const msg2 = await sendMessage(app, token, channel.id, "msg2");

    const res = await app.request(
      `/channels/${channel.id}/messages/bulk-delete`,
      {
        method: "POST",
        body: JSON.stringify({ messageIds: [msg1.id, msg2.id] }),
        headers: getAuthHeaders(memberToken),
      }
    );
    expect(res.status).toBe(403);
  });

  test("returns count of deleted messages", async () => {
    const { token, channel } = await createServerWithChannel(app);

    const msg1 = await sendMessage(app, token, channel.id, "a");
    const msg2 = await sendMessage(app, token, channel.id, "b");
    const msg3 = await sendMessage(app, token, channel.id, "c");

    const res = await app.request(
      `/channels/${channel.id}/messages/bulk-delete`,
      {
        method: "POST",
        body: JSON.stringify({ messageIds: [msg1.id, msg2.id, msg3.id] }),
        headers: getAuthHeaders(token),
      }
    );
    const data = (await res.json()) as any;
    expect(data.deleted).toBe(3);
  });

  test("messages actually soft-deleted", async () => {
    const { token, channel } = await createServerWithChannel(app);

    const msg1 = await sendMessage(app, token, channel.id, "a");
    const msg2 = await sendMessage(app, token, channel.id, "b");
    const msg3 = await sendMessage(app, token, channel.id, "c");

    await app.request(`/channels/${channel.id}/messages/bulk-delete`, {
      method: "POST",
      body: JSON.stringify({ messageIds: [msg1.id, msg2.id] }),
      headers: getAuthHeaders(token),
    });

    // GET messages should only show the non-deleted one
    const getRes = await app.request(`/channels/${channel.id}/messages`, {
      headers: getAuthHeaders(token),
    });
    const data = (await getRes.json()) as any;
    expect(data.messages.length).toBe(1);
    expect(data.messages[0].id).toBe(msg3.id);
  });
});
