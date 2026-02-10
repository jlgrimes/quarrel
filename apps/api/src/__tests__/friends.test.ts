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

describe("POST /friends/:username", () => {
  test("sends friend request by username", async () => {
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

    const res = await app.request(`/friends/bob`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.friend).toBeDefined();
    expect(data.friend.status).toBe("pending");
    expect(data.friend.friendId).toBe(bob.id);
  });

  test("returns 404 for non-existent username", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");

    const res = await app.request(`/friends/nobody`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data.error).toContain("User not found");
  });

  test("rejects self-friend by username", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");

    const res = await app.request(`/friends/alice`, {
      method: "POST",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toContain("yourself");
  });

  test("rejects duplicate friend request", async () => {
    const { token: aliceToken } = await createTestUser(
      app,
      "alice",
      "alice@example.com"
    );
    await createTestUser(app, "bob", "bob@example.com");

    // First request should succeed
    const res1 = await app.request(`/friends/bob`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });
    expect(res1.status).toBe(201);

    // Second request should be rejected
    const res2 = await app.request(`/friends/bob`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });
    expect(res2.status).toBe(409);
    const data = (await res2.json()) as any;
    expect(data.error).toContain("already exists");
  });

  test("returns 401 without auth", async () => {
    const res = await app.request(`/friends/bob`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /friends/:id/accept", () => {
  test("accepts request", async () => {
    const { token: aliceToken } = await createTestUser(
      app,
      "alice",
      "alice@example.com"
    );
    const { token: bobToken } = await createTestUser(
      app,
      "bob",
      "bob@example.com"
    );

    // Alice sends request to Bob
    const sendRes = await app.request(`/friends/bob`, {
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

  test("rejects accept from non-recipient", async () => {
    const { token: aliceToken } = await createTestUser(
      app,
      "alice",
      "alice@example.com"
    );
    const { token: bobToken } = await createTestUser(
      app,
      "bob",
      "bob@example.com"
    );

    // Alice sends request to Bob
    const sendRes = await app.request(`/friends/bob`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });
    const { friend } = (await sendRes.json()) as any;

    // Alice tries to accept her own request — should fail
    const res = await app.request(`/friends/${friend.id}/accept`, {
      method: "PATCH",
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error).toContain("sent to you");
  });

  test("rejects accept of non-existent request", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");

    const res = await app.request(`/friends/fake-id/accept`, {
      method: "PATCH",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(404);
  });

  test("rejects accept of already accepted request", async () => {
    const { token: aliceToken } = await createTestUser(
      app,
      "alice",
      "alice@example.com"
    );
    const { token: bobToken } = await createTestUser(
      app,
      "bob",
      "bob@example.com"
    );

    // Alice sends, Bob accepts
    const sendRes = await app.request(`/friends/bob`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });
    const { friend } = (await sendRes.json()) as any;

    await app.request(`/friends/${friend.id}/accept`, {
      method: "PATCH",
      headers: getAuthHeaders(bobToken),
    });

    // Bob tries to accept again
    const res = await app.request(`/friends/${friend.id}/accept`, {
      method: "PATCH",
      headers: getAuthHeaders(bobToken),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toContain("not pending");
  });
});

describe("DELETE /friends/:id", () => {
  test("removes friend", async () => {
    const { token: aliceToken } = await createTestUser(
      app,
      "alice",
      "alice@example.com"
    );
    await createTestUser(app, "bob", "bob@example.com");

    // Alice sends request to Bob
    const sendRes = await app.request(`/friends/bob`, {
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

  test("recipient can also remove", async () => {
    const { token: aliceToken } = await createTestUser(
      app,
      "alice",
      "alice@example.com"
    );
    const { token: bobToken } = await createTestUser(
      app,
      "bob",
      "bob@example.com"
    );

    const sendRes = await app.request(`/friends/bob`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });
    const { friend } = (await sendRes.json()) as any;

    // Bob removes Alice's request
    const res = await app.request(`/friends/${friend.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(bobToken),
    });
    expect(res.status).toBe(200);
  });

  test("third party cannot remove", async () => {
    const { token: aliceToken } = await createTestUser(
      app,
      "alice",
      "alice@example.com"
    );
    await createTestUser(app, "bob", "bob@example.com");
    const { token: carolToken } = await createTestUser(
      app,
      "carol",
      "carol@example.com"
    );

    const sendRes = await app.request(`/friends/bob`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });
    const { friend } = (await sendRes.json()) as any;

    // Carol tries to remove Alice→Bob request
    const res = await app.request(`/friends/${friend.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(carolToken),
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error).toContain("Not your");
  });

  test("returns 404 for non-existent request", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");

    const res = await app.request(`/friends/fake-id`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /friends", () => {
  test("lists all friends", async () => {
    const { token: aliceToken } = await createTestUser(
      app,
      "alice",
      "alice@example.com"
    );
    await createTestUser(app, "bob", "bob@example.com");
    await createTestUser(app, "carol", "carol@example.com");

    // Alice sends requests to Bob and Carol
    await app.request(`/friends/bob`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });
    await app.request(`/friends/carol`, {
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

  test("returns empty list when no friends", async () => {
    const { token } = await createTestUser(app, "alice", "alice@example.com");

    const res = await app.request("/friends", {
      headers: getAuthHeaders(token),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.friends.length).toBe(0);
  });

  test("recipient also sees the request", async () => {
    const { token: aliceToken } = await createTestUser(
      app,
      "alice",
      "alice@example.com"
    );
    const { token: bobToken } = await createTestUser(
      app,
      "bob",
      "bob@example.com"
    );

    await app.request(`/friends/bob`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });

    const res = await app.request("/friends", {
      headers: getAuthHeaders(bobToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.friends.length).toBe(1);
    expect(data.friends[0].status).toBe("pending");
  });
});

describe("GET /friends - user data enrichment", () => {
  test("sender sees friend record with 'friend' property containing recipient user data", async () => {
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

    await app.request(`/friends/bob`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });

    const res = await app.request("/friends", {
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.friends.length).toBe(1);

    const record = data.friends[0];
    expect(record.friend).toBeDefined();
    expect(record.friend.id).toBe(bob.id);
    expect(record.friend.username).toBe("bob");
    expect(record.friend.displayName).toBeDefined();
    expect(record.friend.status).toBeDefined();
  });

  test("recipient sees friend record with 'user' property containing sender user data", async () => {
    const { token: aliceToken, user: alice } = await createTestUser(
      app,
      "alice",
      "alice@example.com"
    );
    const { token: bobToken } = await createTestUser(
      app,
      "bob",
      "bob@example.com"
    );

    await app.request(`/friends/bob`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });

    const res = await app.request("/friends", {
      headers: getAuthHeaders(bobToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.friends.length).toBe(1);

    const record = data.friends[0];
    expect(record.user).toBeDefined();
    expect(record.user.id).toBe(alice.id);
    expect(record.user.username).toBe("alice");
    expect(record.user.displayName).toBeDefined();
    expect(record.user.status).toBeDefined();
  });

  test("enriched user objects have expected fields", async () => {
    const { token: aliceToken } = await createTestUser(
      app,
      "alice",
      "alice@example.com"
    );
    await createTestUser(app, "bob", "bob@example.com");

    await app.request(`/friends/bob`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });

    const res = await app.request("/friends", {
      headers: getAuthHeaders(aliceToken),
    });
    const data = (await res.json()) as any;
    const friendObj = data.friends[0].friend;

    expect(friendObj).toHaveProperty("id");
    expect(friendObj).toHaveProperty("username");
    expect(friendObj).toHaveProperty("displayName");
    expect(friendObj).toHaveProperty("avatarUrl");
    expect(friendObj).toHaveProperty("status");
    // Should not leak sensitive fields
    expect(friendObj).not.toHaveProperty("hashedPassword");
    expect(friendObj).not.toHaveProperty("email");
  });

  test("multiple friends each have correct user data attached", async () => {
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
    const { user: carol } = await createTestUser(
      app,
      "carol",
      "carol@example.com"
    );

    await app.request(`/friends/bob`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });
    await app.request(`/friends/carol`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });

    const res = await app.request("/friends", {
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.friends.length).toBe(2);

    const bobRecord = data.friends.find(
      (f: any) => f.friend?.username === "bob"
    );
    const carolRecord = data.friends.find(
      (f: any) => f.friend?.username === "carol"
    );

    expect(bobRecord).toBeDefined();
    expect(bobRecord.friend.id).toBe(bob.id);
    expect(bobRecord.friend.username).toBe("bob");

    expect(carolRecord).toBeDefined();
    expect(carolRecord.friend.id).toBe(carol.id);
    expect(carolRecord.friend.username).toBe("carol");
  });
});
