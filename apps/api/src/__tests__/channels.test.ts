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

async function createServerWithOwner(app: Hono) {
  const { token, user } = await createTestUser(app);
  const res = await app.request("/servers", {
    method: "POST",
    body: JSON.stringify({ name: "Test Server" }),
    headers: getAuthHeaders(token),
  });
  const data = (await res.json()) as any;
  return { token, user, server: data.server };
}

describe("POST /servers/:id/channels", () => {
  test("creates channel", async () => {
    const { token, server } = await createServerWithOwner(app);
    const res = await app.request(`/servers/${server.id}/channels`, {
      method: "POST",
      body: JSON.stringify({ name: "random", type: "text" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.channel.name).toBe("random");
    expect(data.channel.type).toBe("text");
    expect(data.channel.serverId).toBe(server.id);
  });
});

describe("GET /servers/:id/channels", () => {
  test("lists channels", async () => {
    const { token, server } = await createServerWithOwner(app);
    // Server already has #general, add another
    await app.request(`/servers/${server.id}/channels`, {
      method: "POST",
      body: JSON.stringify({ name: "random" }),
      headers: getAuthHeaders(token),
    });

    const res = await app.request(`/servers/${server.id}/channels`, {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.channels.length).toBe(2);
    const names = data.channels.map((c: any) => c.name);
    expect(names).toContain("general");
    expect(names).toContain("random");
  });
});

describe("PATCH /channels/:id", () => {
  test("updates channel", async () => {
    const { token, server } = await createServerWithOwner(app);
    // Create a channel to update
    const createRes = await app.request(`/servers/${server.id}/channels`, {
      method: "POST",
      body: JSON.stringify({ name: "old-name" }),
      headers: getAuthHeaders(token),
    });
    const { channel } = (await createRes.json()) as any;

    const res = await app.request(`/channels/${channel.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "new-name", topic: "A new topic" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.channel.name).toBe("new-name");
    expect(data.channel.topic).toBe("A new topic");
  });
});

describe("DELETE /channels/:id", () => {
  test("owner can delete", async () => {
    const { token, server } = await createServerWithOwner(app);
    const createRes = await app.request(`/servers/${server.id}/channels`, {
      method: "POST",
      body: JSON.stringify({ name: "to-delete" }),
      headers: getAuthHeaders(token),
    });
    const { channel } = (await createRes.json()) as any;

    const res = await app.request(`/channels/${channel.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);

    // Verify channel is gone
    const listRes = await app.request(`/servers/${server.id}/channels`, {
      headers: getAuthHeaders(token),
    });
    const listData = (await listRes.json()) as any;
    const names = listData.channels.map((c: any) => c.name);
    expect(names).not.toContain("to-delete");
  });
});
