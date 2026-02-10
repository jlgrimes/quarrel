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

describe("POST /dms/conversations", () => {
  test("creates conversation", async () => {
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

    const res = await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.conversation).toBeDefined();
    expect(data.conversation.id).toBeDefined();
  });

  test("returns existing conversation", async () => {
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

    // Create first
    const res1 = await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    const data1 = (await res1.json()) as any;

    // Request again — should return same conversation
    const res2 = await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    const data2 = (await res2.json()) as any;
    expect(data2.conversation.id).toBe(data1.conversation.id);
    // Second time returns 200, not 201
    expect(res2.status).toBe(200);
  });
});

describe("GET /dms/conversations", () => {
  test("lists conversations", async () => {
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

    // Create conversations with bob and carol
    await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: carol.id }),
      headers: getAuthHeaders(aliceToken),
    });

    const res = await app.request("/dms/conversations", {
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.conversations.length).toBe(2);
  });
});

describe("POST /dms/:id/messages", () => {
  test("sends DM", async () => {
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

    const convRes = await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    const res = await app.request(`/dms/${conversation.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Hey Bob!" }),
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.message.content).toBe("Hey Bob!");
    expect(data.message.conversationId).toBe(conversation.id);
  });
});

describe("GET /dms/:id/messages", () => {
  test("lists DMs", async () => {
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

    const convRes = await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    // Alice sends messages
    await app.request(`/dms/${conversation.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Hey Bob!" }),
      headers: getAuthHeaders(aliceToken),
    });
    // Bob replies
    await app.request(`/dms/${conversation.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Hey Alice!" }),
      headers: getAuthHeaders(bobToken),
    });

    // Alice reads messages
    const res = await app.request(`/dms/${conversation.id}/messages`, {
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages.length).toBe(2);
  });
});

describe("GET /dms/conversations - member data", () => {
  test("conversations include members array with user data", async () => {
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

    await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });

    const res = await app.request("/dms/conversations", {
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.conversations.length).toBe(1);

    const conv = data.conversations[0];
    expect(conv.members).toBeDefined();
    expect(Array.isArray(conv.members)).toBe(true);
    expect(conv.members.length).toBe(1);

    const member = conv.members[0];
    expect(member.id).toBe(bob.id);
    expect(member.username).toBe("bob");
    expect(member.displayName).toBeDefined();
    expect(member.avatarUrl).toBeDefined();
    expect(member.status).toBeDefined();
    // Should not leak sensitive fields
    expect(member).not.toHaveProperty("hashedPassword");
    expect(member).not.toHaveProperty("email");
  });
});

describe("GET /dms/:id/messages - author data", () => {
  test("messages include author object with user data", async () => {
    const { token: aliceToken, user: alice } = await createTestUser(
      app,
      "alice",
      "alice@example.com"
    );
    const { token: bobToken, user: bob } = await createTestUser(
      app,
      "bob",
      "bob@example.com"
    );

    const convRes = await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    // Alice sends a message
    await app.request(`/dms/${conversation.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Hello Bob!" }),
      headers: getAuthHeaders(aliceToken),
    });

    // Bob sends a message
    await app.request(`/dms/${conversation.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Hi Alice!" }),
      headers: getAuthHeaders(bobToken),
    });

    // Read messages
    const res = await app.request(`/dms/${conversation.id}/messages`, {
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages.length).toBe(2);

    // Each message should have an author object
    for (const msg of data.messages) {
      expect(msg.author).toBeDefined();
      expect(msg.author).toHaveProperty("id");
      expect(msg.author).toHaveProperty("username");
      expect(msg.author).toHaveProperty("displayName");
      expect(msg.author).toHaveProperty("avatarUrl");
      // Should not leak sensitive fields
      expect(msg.author).not.toHaveProperty("hashedPassword");
      expect(msg.author).not.toHaveProperty("email");
    }

    // Verify correct author is attached to each message
    const aliceMsg = data.messages.find(
      (m: any) => m.content === "Hello Bob!"
    );
    const bobMsg = data.messages.find(
      (m: any) => m.content === "Hi Alice!"
    );

    expect(aliceMsg.author.id).toBe(alice.id);
    expect(aliceMsg.author.username).toBe("alice");

    expect(bobMsg.author.id).toBe(bob.id);
    expect(bobMsg.author.username).toBe("bob");
  });
});

describe("POST /dms/conversations - member data", () => {
  test("new conversation includes members with user data", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@example.com");
    const { user: bob } = await createTestUser(app, "bob", "bob@example.com");

    const res = await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;

    expect(data.conversation.members).toBeDefined();
    expect(data.conversation.members.length).toBe(1);
    expect(data.conversation.members[0].id).toBe(bob.id);
    expect(data.conversation.members[0].username).toBe("bob");
  });

  test("existing conversation includes members with user data", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@example.com");
    const { user: bob } = await createTestUser(app, "bob", "bob@example.com");

    // Create first
    await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });

    // Request again — should return existing with members
    const res = await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;

    expect(data.conversation.members).toBeDefined();
    expect(data.conversation.members.length).toBe(1);
    expect(data.conversation.members[0].id).toBe(bob.id);
    expect(data.conversation.members[0].username).toBe("bob");
  });
});

// ===== Group DM Tests =====

describe("POST /dms/conversations/group", () => {
  test("creates group conversation with multiple users", async () => {
    const { token: aliceToken, user: alice } = await createTestUser(app, "alice", "alice@example.com");
    const { user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const { user: carol } = await createTestUser(app, "carol", "carol@example.com");

    const res = await app.request("/dms/conversations/group", {
      method: "POST",
      body: JSON.stringify({ userIds: [bob.id, carol.id] }),
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.conversation).toBeDefined();
    expect(data.conversation.isGroup).toBe(true);
    expect(data.conversation.ownerId).toBe(alice.id);
    expect(data.conversation.members.length).toBe(2);
  });

  test("creates group conversation with custom name", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@example.com");
    const { user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const { user: carol } = await createTestUser(app, "carol", "carol@example.com");

    const res = await app.request("/dms/conversations/group", {
      method: "POST",
      body: JSON.stringify({ userIds: [bob.id, carol.id], name: "The Gang" }),
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.conversation.name).toBe("The Gang");
  });

  test("rejects group DM with fewer than 2 other users", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@example.com");
    const { user: bob } = await createTestUser(app, "bob", "bob@example.com");

    const res = await app.request("/dms/conversations/group", {
      method: "POST",
      body: JSON.stringify({ userIds: [bob.id] }),
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(400);
  });

  test("rejects group DM that includes self", async () => {
    const { token: aliceToken, user: alice } = await createTestUser(app, "alice", "alice@example.com");
    const { user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const { user: carol } = await createTestUser(app, "carol", "carol@example.com");

    const res = await app.request("/dms/conversations/group", {
      method: "POST",
      body: JSON.stringify({ userIds: [alice.id, bob.id, carol.id] }),
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(400);
  });

  test("rejects group DM with non-existent user", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@example.com");
    const { user: bob } = await createTestUser(app, "bob", "bob@example.com");

    const res = await app.request("/dms/conversations/group", {
      method: "POST",
      body: JSON.stringify({ userIds: [bob.id, "nonexistent-id"] }),
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /dms/:conversationId", () => {
  test("owner can update group name", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@example.com");
    const { user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const { user: carol } = await createTestUser(app, "carol", "carol@example.com");

    const convRes = await app.request("/dms/conversations/group", {
      method: "POST",
      body: JSON.stringify({ userIds: [bob.id, carol.id], name: "Old Name" }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    const res = await app.request(`/dms/${conversation.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name" }),
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.conversation.name).toBe("New Name");
  });

  test("non-owner cannot update group", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@example.com");
    const { token: bobToken, user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const { user: carol } = await createTestUser(app, "carol", "carol@example.com");

    const convRes = await app.request("/dms/conversations/group", {
      method: "POST",
      body: JSON.stringify({ userIds: [bob.id, carol.id] }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    const res = await app.request(`/dms/${conversation.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Bob's Name" }),
      headers: getAuthHeaders(bobToken),
    });
    expect(res.status).toBe(403);
  });

  test("cannot update a 1:1 conversation", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@example.com");
    const { user: bob } = await createTestUser(app, "bob", "bob@example.com");

    const convRes = await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    const res = await app.request(`/dms/${conversation.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name" }),
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /dms/:conversationId/members", () => {
  test("owner can add member to group DM", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@example.com");
    const { user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const { user: carol } = await createTestUser(app, "carol", "carol@example.com");
    const { user: dave } = await createTestUser(app, "dave", "dave@example.com");

    const convRes = await app.request("/dms/conversations/group", {
      method: "POST",
      body: JSON.stringify({ userIds: [bob.id, carol.id] }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    const res = await app.request(`/dms/${conversation.id}/members`, {
      method: "POST",
      body: JSON.stringify({ userId: dave.id }),
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.member.id).toBe(dave.id);
  });

  test("non-owner cannot add member", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@example.com");
    const { token: bobToken, user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const { user: carol } = await createTestUser(app, "carol", "carol@example.com");
    const { user: dave } = await createTestUser(app, "dave", "dave@example.com");

    const convRes = await app.request("/dms/conversations/group", {
      method: "POST",
      body: JSON.stringify({ userIds: [bob.id, carol.id] }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    const res = await app.request(`/dms/${conversation.id}/members`, {
      method: "POST",
      body: JSON.stringify({ userId: dave.id }),
      headers: getAuthHeaders(bobToken),
    });
    expect(res.status).toBe(403);
  });

  test("cannot add duplicate member", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@example.com");
    const { user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const { user: carol } = await createTestUser(app, "carol", "carol@example.com");

    const convRes = await app.request("/dms/conversations/group", {
      method: "POST",
      body: JSON.stringify({ userIds: [bob.id, carol.id] }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    const res = await app.request(`/dms/${conversation.id}/members`, {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(409);
  });
});

describe("DELETE /dms/:conversationId/members/:userId", () => {
  test("owner can remove member from group DM", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@example.com");
    const { user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const { user: carol } = await createTestUser(app, "carol", "carol@example.com");

    const convRes = await app.request("/dms/conversations/group", {
      method: "POST",
      body: JSON.stringify({ userIds: [bob.id, carol.id] }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    const res = await app.request(`/dms/${conversation.id}/members/${bob.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
  });

  test("non-owner cannot remove member", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@example.com");
    const { token: bobToken, user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const { user: carol } = await createTestUser(app, "carol", "carol@example.com");

    const convRes = await app.request("/dms/conversations/group", {
      method: "POST",
      body: JSON.stringify({ userIds: [bob.id, carol.id] }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    const res = await app.request(`/dms/${conversation.id}/members/${carol.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(bobToken),
    });
    expect(res.status).toBe(403);
  });

  test("owner cannot remove themselves", async () => {
    const { token: aliceToken, user: alice } = await createTestUser(app, "alice", "alice@example.com");
    const { user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const { user: carol } = await createTestUser(app, "carol", "carol@example.com");

    const convRes = await app.request("/dms/conversations/group", {
      method: "POST",
      body: JSON.stringify({ userIds: [bob.id, carol.id] }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    const res = await app.request(`/dms/${conversation.id}/members/${alice.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /dms/:conversationId/leave", () => {
  test("member can leave group DM", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@example.com");
    const { token: bobToken, user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const { user: carol } = await createTestUser(app, "carol", "carol@example.com");

    const convRes = await app.request("/dms/conversations/group", {
      method: "POST",
      body: JSON.stringify({ userIds: [bob.id, carol.id] }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    const res = await app.request(`/dms/${conversation.id}/leave`, {
      method: "POST",
      headers: getAuthHeaders(bobToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);

    // Bob should no longer be able to send messages
    const msgRes = await app.request(`/dms/${conversation.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Hello" }),
      headers: getAuthHeaders(bobToken),
    });
    expect(msgRes.status).toBe(403);
  });

  test("owner leaving transfers ownership", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@example.com");
    const { token: bobToken, user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const { user: carol } = await createTestUser(app, "carol", "carol@example.com");

    const convRes = await app.request("/dms/conversations/group", {
      method: "POST",
      body: JSON.stringify({ userIds: [bob.id, carol.id] }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    // Alice (owner) leaves
    const res = await app.request(`/dms/${conversation.id}/leave`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(200);

    // Bob should now be able to update the group (as new owner)
    const updateRes = await app.request(`/dms/${conversation.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Bob's Group" }),
      headers: getAuthHeaders(bobToken),
    });
    expect(updateRes.status).toBe(200);
  });

  test("cannot leave 1:1 conversation", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@example.com");
    const { user: bob } = await createTestUser(app, "bob", "bob@example.com");

    const convRes = await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    const res = await app.request(`/dms/${conversation.id}/leave`, {
      method: "POST",
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(400);
  });
});

describe("Group DM messaging", () => {
  test("all members can send and read messages in group DM", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@example.com");
    const { token: bobToken, user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const { token: carolToken, user: carol } = await createTestUser(app, "carol", "carol@example.com");

    const convRes = await app.request("/dms/conversations/group", {
      method: "POST",
      body: JSON.stringify({ userIds: [bob.id, carol.id] }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    // All three send messages
    await app.request(`/dms/${conversation.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Alice here" }),
      headers: getAuthHeaders(aliceToken),
    });
    await app.request(`/dms/${conversation.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Bob here" }),
      headers: getAuthHeaders(bobToken),
    });
    await app.request(`/dms/${conversation.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Carol here" }),
      headers: getAuthHeaders(carolToken),
    });

    // All can read
    const res = await app.request(`/dms/${conversation.id}/messages`, {
      headers: getAuthHeaders(carolToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages.length).toBe(3);
  });
});

describe("GET /dms/conversations - group DMs", () => {
  test("group DMs appear in conversation list with isGroup flag", async () => {
    const { token: aliceToken } = await createTestUser(app, "alice", "alice@example.com");
    const { user: bob } = await createTestUser(app, "bob", "bob@example.com");
    const { user: carol } = await createTestUser(app, "carol", "carol@example.com");

    // Create a 1:1 DM
    await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });

    // Create a group DM
    await app.request("/dms/conversations/group", {
      method: "POST",
      body: JSON.stringify({ userIds: [bob.id, carol.id], name: "Group Chat" }),
      headers: getAuthHeaders(aliceToken),
    });

    const res = await app.request("/dms/conversations", {
      headers: getAuthHeaders(aliceToken),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.conversations.length).toBe(2);

    const groupConv = data.conversations.find((c: any) => c.isGroup);
    const dmConv = data.conversations.find((c: any) => !c.isGroup);

    expect(groupConv).toBeDefined();
    expect(groupConv.name).toBe("Group Chat");
    expect(groupConv.members.length).toBe(2); // bob and carol (excludes self)

    expect(dmConv).toBeDefined();
    expect(dmConv.members.length).toBe(1); // just bob
  });
});

describe("DM access control", () => {
  test("non-member cannot read messages from a conversation", async () => {
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
    const { token: carolToken } = await createTestUser(
      app,
      "carol",
      "carol@example.com"
    );

    // Alice creates conversation with Bob
    const convRes = await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    // Alice sends a message
    await app.request(`/dms/${conversation.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Secret message" }),
      headers: getAuthHeaders(aliceToken),
    });

    // Carol tries to read messages — should be denied
    const res = await app.request(`/dms/${conversation.id}/messages`, {
      headers: getAuthHeaders(carolToken),
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error).toContain("Not a member");
  });

  test("non-member cannot send messages to a conversation", async () => {
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
    const { token: carolToken } = await createTestUser(
      app,
      "carol",
      "carol@example.com"
    );

    // Alice creates conversation with Bob
    const convRes = await app.request("/dms/conversations", {
      method: "POST",
      body: JSON.stringify({ userId: bob.id }),
      headers: getAuthHeaders(aliceToken),
    });
    const { conversation } = (await convRes.json()) as any;

    // Carol tries to send a message — should be denied
    const res = await app.request(`/dms/${conversation.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Sneaky message" }),
      headers: getAuthHeaders(carolToken),
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error).toContain("Not a member");
  });
});
