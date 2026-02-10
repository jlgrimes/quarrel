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

describe("POST /friends/:userId", () => {
  test("sends friend request", async () => {
    const { token: aliceToken } = await createTestUser(
      app,
      "alice",
      "alice@example.com"
    );
    const { user: bob } = await createTestUser(
      app,
      "bob",
      "bob@example.com"
    );

    const res = await app.request(`/friends/${bob.id}`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.friend).toBeDefined();
    expect(data.friend.status).toBe("pending");
    expect(data.friend.friendId).toBe(bob.id);
  });

  test("rejects self-friend", async () => {
    const { token, user } = await createTestUser(app);
    const res = await app.request(`/friends/${user.id}`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toContain("yourself");
  });
});

describe("PATCH /friends/:id/accept", () => {
  test("accepts request", async () => {
    const { token: aliceToken } = await createTestUser(
      app,
      "alice",
      "alice@example.com"
    );
    const { token: bobToken, user: bob } = await createTestUser(
      app,
      "bob",
      "bob@example.com"
    );

    // Alice sends request to Bob
    const sendRes = await app.request(`/friends/${bob.id}`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });
    const { friend } = (await sendRes.json()) as any;

    // Bob accepts
    const res = await app.request(`/friends/${friend.id}/accept`, {
      method: "PATCH",
      headers: getAuthHeaders(bobToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.friend.status).toBe("accepted");
  });
});

describe("DELETE /friends/:id", () => {
  test("removes friend", async () => {
    const { token: aliceToken } = await createTestUser(
      app,
      "alice",
      "alice@example.com"
    );
    const { token: bobToken, user: bob } = await createTestUser(
      app,
      "bob",
      "bob@example.com"
    );

    // Alice sends request to Bob
    const sendRes = await app.request(`/friends/${bob.id}`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });
    const { friend } = (await sendRes.json()) as any;

    // Alice removes it
    const res = await app.request(`/friends/${friend.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);

    // Friends list should be empty
    const listRes = await app.request("/friends", {
      headers: getAuthHeaders(aliceToken),
    });
    const listData = (await listRes.json()) as any;
    expect(listData.friends.length).toBe(0);
  });
});

describe("GET /friends", () => {
  test("lists all friends", async () => {
    const { token: aliceToken, user: alice } = await createTestUser(
      app,
      "alice",
      "alice@example.com"
    );
    const { user: bob } = await createTestUser(
      app,
      "bob",
      "bob@example.com"
    );
    const { user: carol } = await createTestUser(
      app,
      "carol",
      "carol@example.com"
    );

    // Alice sends requests to Bob and Carol
    await app.request(`/friends/${bob.id}`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });
    await app.request(`/friends/${carol.id}`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });

    const res = await app.request("/friends", {
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.friends.length).toBe(2);
  });
});
