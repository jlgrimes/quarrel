import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import {
  setupDatabase,
  clearDatabase,
  createApp,
  createTestUser,
  getAuthHeaders,
  r2MockOverride,
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

describe("POST /users/me/avatar/presign", () => {
  test("returns presigned URL for valid request", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const res = await app.request("/users/me/avatar/presign", {
      method: "POST",
      body: JSON.stringify({
        contentType: "image/png",
        contentLength: 1024,
      }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.presignedUrl).toBeDefined();
    expect(data.publicUrl).toBeDefined();
    expect(data.presignedUrl).toContain("r2-mock.example.com");
    expect(data.publicUrl).toContain("cdn.example.com");
    expect(data.publicUrl).toContain(".png");
  });

  test("rejects invalid content type", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const res = await app.request("/users/me/avatar/presign", {
      method: "POST",
      body: JSON.stringify({
        contentType: "image/bmp",
        contentLength: 1024,
      }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
  });

  test("rejects file too large", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const res = await app.request("/users/me/avatar/presign", {
      method: "POST",
      body: JSON.stringify({
        contentType: "image/png",
        contentLength: 9 * 1024 * 1024, // 9 MB, over 8 MB limit
      }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
  });

  test("returns 401 without auth", async () => {
    const res = await app.request("/users/me/avatar/presign", {
      method: "POST",
      body: JSON.stringify({
        contentType: "image/png",
        contentLength: 1024,
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });

  test("returns 500 with error message when R2 fails", async () => {
    r2MockOverride.createPresignedUploadUrl = async () => {
      throw new Error("R2 unavailable");
    };
    try {
      const { token } = await createTestUser(app, "alice", "alice@example.com");
      const res = await app.request("/users/me/avatar/presign", {
        method: "POST",
        body: JSON.stringify({
          contentType: "image/png",
          contentLength: 1024,
        }),
        headers: getAuthHeaders(token),
      });
      expect(res.status).toBe(500);
      const data = (await res.json()) as any;
      expect(data.error).toBe("Failed to generate upload URL");
    } finally {
      delete r2MockOverride.createPresignedUploadUrl;
    }
  });
});

describe("DELETE /users/me/avatar", () => {
  test("clears avatar URL", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");

    // First set an avatar URL via PATCH
    await app.request("/users/me", {
      method: "PATCH",
      body: JSON.stringify({ avatarUrl: "https://cdn.example.com/avatars/old.png" }),
      headers: getAuthHeaders(token),
    });

    // Now delete the avatar
    const res = await app.request("/users/me/avatar", {
      method: "DELETE",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);

    // Verify avatar is cleared
    const meRes = await app.request("/auth/me", {
      headers: getAuthHeaders(token),
    });
    const meData = (await meRes.json()) as any;
    expect(meData.user.avatarUrl).toBeNull();
  });

  test("returns 401 without auth", async () => {
    const res = await app.request("/users/me/avatar", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /users/me with avatarUrl", () => {
  test("updates avatar URL successfully", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");
    const res = await app.request("/users/me", {
      method: "PATCH",
      body: JSON.stringify({ avatarUrl: "https://cdn.example.com/avatars/new.png" }),
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.user.avatarUrl).toBe("https://cdn.example.com/avatars/new.png");
  });
});
