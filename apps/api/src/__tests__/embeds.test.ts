import { describe, test, expect, beforeAll, beforeEach, mock, afterEach } from "bun:test";
import {
  setupDatabase,
  clearDatabase,
  createApp,
  createTestUser,
  getAuthHeaders,
} from "./helpers";
import { clearMetadataCache } from "../lib/urlMetadata";
import type { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  await setupDatabase();
  app = createApp();
});

beforeEach(async () => {
  await clearDatabase();
  clearMetadataCache();
});

describe("POST /embeds/metadata", () => {
  test("returns 401 without auth", async () => {
    const res = await app.request("/embeds/metadata", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });

  test("returns 400 without url", async () => {
    const { token } = await createTestUser(app);
    const res = await app.request("/embeds/metadata", {
      method: "POST",
      body: JSON.stringify({}),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toContain("URL is required");
  });

  test("returns 400 for non-http URLs", async () => {
    const { token } = await createTestUser(app);
    const res = await app.request("/embeds/metadata", {
      method: "POST",
      body: JSON.stringify({ url: "ftp://example.com" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toContain("Invalid URL");
  });

  test("blocks private IPs (localhost)", async () => {
    const { token } = await createTestUser(app);
    const res = await app.request("/embeds/metadata", {
      method: "POST",
      body: JSON.stringify({ url: "http://localhost:3000/secret" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toContain("Private URLs");
  });

  test("blocks private IPs (127.0.0.1)", async () => {
    const { token } = await createTestUser(app);
    const res = await app.request("/embeds/metadata", {
      method: "POST",
      body: JSON.stringify({ url: "http://127.0.0.1:8080/admin" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
  });

  test("blocks private IPs (192.168.x.x)", async () => {
    const { token } = await createTestUser(app);
    const res = await app.request("/embeds/metadata", {
      method: "POST",
      body: JSON.stringify({ url: "http://192.168.1.1/admin" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
  });

  test("blocks .local domains", async () => {
    const { token } = await createTestUser(app);
    const res = await app.request("/embeds/metadata", {
      method: "POST",
      body: JSON.stringify({ url: "http://myserver.local/page" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
  });

  test("returns fallback metadata on fetch failure", async () => {
    const { token } = await createTestUser(app);
    // Use a domain that won't resolve
    const res = await app.request("/embeds/metadata", {
      method: "POST",
      body: JSON.stringify({ url: "https://this-domain-definitely-does-not-exist-xyz123.com" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.metadata.url).toBe("https://this-domain-definitely-does-not-exist-xyz123.com");
    expect(data.metadata.title).toBeNull();
  });
});
