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
  // Add description column
  try {
    await testDb.run(sql`ALTER TABLE servers ADD COLUMN description TEXT`);
  } catch {}
  app = createApp();
});

beforeEach(async () => {
  await clearDatabase();
});

describe("server description", () => {
  test("PATCH with description updates server", async () => {
    const { token } = await createTestUser(app);
    const createRes = await app.request("/servers", {
      method: "POST",
      body: JSON.stringify({ name: "Test Server" }),
      headers: getAuthHeaders(token),
    });
    const { server } = (await createRes.json()) as any;

    const res = await app.request(`/servers/${server.id}`, {
      method: "PATCH",
      body: JSON.stringify({ description: "A cool server" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.server.description).toBe("A cool server");
  });

  test("description returned in GET /servers/:id", async () => {
    const { token } = await createTestUser(app);
    const createRes = await app.request("/servers", {
      method: "POST",
      body: JSON.stringify({ name: "Test Server" }),
      headers: getAuthHeaders(token),
    });
    const { server } = (await createRes.json()) as any;

    // Set description
    await app.request(`/servers/${server.id}`, {
      method: "PATCH",
      body: JSON.stringify({ description: "My description" }),
      headers: getAuthHeaders(token),
    });

    // Fetch and verify
    const getRes = await app.request(`/servers/${server.id}`, {
      headers: getAuthHeaders(token),
    });
    expect(getRes.status).toBe(200);
    const data = (await getRes.json()) as any;
    expect(data.server.description).toBe("My description");
  });

  test("description max 1000 chars validation", async () => {
    const { token } = await createTestUser(app);
    const createRes = await app.request("/servers", {
      method: "POST",
      body: JSON.stringify({ name: "Test Server" }),
      headers: getAuthHeaders(token),
    });
    const { server } = (await createRes.json()) as any;

    const longDesc = "a".repeat(1001);
    const res = await app.request(`/servers/${server.id}`, {
      method: "PATCH",
      body: JSON.stringify({ description: longDesc }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
  });
});
