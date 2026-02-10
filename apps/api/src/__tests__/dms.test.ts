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
