import { describe, test, expect, beforeAll, beforeEach, afterAll } from "bun:test";
import {
  setupDatabase,
  clearDatabase,
  testDb,
} from "./helpers";

// Import schema tables directly from the schema subpath to avoid loading
// the real @quarrel/db main module before the mock takes effect
import { users, sessions, servers, channels, members } from "@quarrel/db/schema/index";

// Import ws module (uses mocked DB)
const {
  websocketHandler,
  authenticateWS,
  MAX_CONNECTIONS_PER_USER,
  _testing,
} = await import("../ws");

// Helper to create a user + session directly in the DB
async function createUserWithSession(username = "testuser", email = "test@example.com") {
  const userId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const hashedPassword = await Bun.password.hash("password123");

  await testDb.insert(users).values({
    id: userId,
    username,
    email,
    hashedPassword,
    displayName: username,
    status: "offline",
  });

  await testDb.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  return { userId, sessionId };
}

// Helper to create a server + channel + membership
async function createServerWithChannel(ownerId: string, channelType = "text") {
  const serverId = crypto.randomUUID();
  const channelId = crypto.randomUUID();

  await testDb.insert(servers).values({
    id: serverId,
    name: "Test Server",
    ownerId,
    inviteCode: crypto.randomUUID(),
  });

  await testDb.insert(channels).values({
    id: channelId,
    serverId,
    name: channelType === "voice" ? "voice-chat" : "general",
    type: channelType,
  });

  await testDb.insert(members).values({
    id: crypto.randomUUID(),
    userId: ownerId,
    serverId,
  });

  return { serverId, channelId };
}

// ---- Mock WebSocket ----
// Creates a lightweight mock that matches the ServerWebSocket interface used by handlers
function createMockWS(data?: Partial<{ userId: string; token: string; subscribedChannels: Set<string>; subscribedServers: Set<string> }>) {
  const sentMessages: any[] = [];
  let closed = false;
  const ws = {
    data: {
      userId: data?.userId ?? "",
      token: data?.token ?? "",
      subscribedChannels: data?.subscribedChannels ?? new Set<string>(),
      subscribedServers: data?.subscribedServers ?? new Set<string>(),
    },
    send(msg: string) {
      sentMessages.push(JSON.parse(msg));
    },
    close() {
      closed = true;
    },
    // Expose test helpers
    _sentMessages: sentMessages,
    get _closed() { return closed; },
  };
  return ws as any;
}

// ---- Test server for HTTP-level upgrade rejection ----
let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;
let wsUrl: string;

beforeAll(async () => {
  await setupDatabase();

  server = Bun.serve({
    port: 0,
    fetch(req, srv) {
      const url = new URL(req.url);
      if (url.pathname === "/ws") {
        const token = url.searchParams.get("token");
        if (!token) {
          return new Response("Authentication required", { status: 401 });
        }
        const upgraded = srv.upgrade(req, {
          data: {
            userId: "",
            token,
            subscribedChannels: new Set<string>(),
            subscribedServers: new Set<string>(),
          },
        });
        if (upgraded) return undefined;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return new Response("Not found", { status: 404 });
    },
    websocket: websocketHandler,
  });

  baseUrl = `http://localhost:${server.port}`;
  wsUrl = `ws://localhost:${server.port}/ws`;
});

afterAll(() => {
  server?.stop();
});

beforeEach(async () => {
  await clearDatabase();
  // Clear WS in-memory state
  _testing.connectedClients.clear();
  _testing.channelSubscribers.clear();
  _testing.serverSubscribers.clear();
  _testing.voiceChannels.clear();
  _testing.userVoiceChannel.clear();
});

// =============================================================================
// authenticateWS direct test
// =============================================================================
describe("authenticateWS", () => {
  test("returns userId for valid session", async () => {
    const { sessionId, userId } = await createUserWithSession("authcheck", "authcheck@test.com");
    const result = await authenticateWS(sessionId);
    expect(result).toBe(userId);
  });

  test("returns null for invalid session", async () => {
    const result = await authenticateWS("nonexistent-session");
    expect(result).toBeNull();
  });
});

// =============================================================================
// #17 MED-6: WebSocket connection before auth
// =============================================================================
describe("WebSocket upgrade authentication (#17)", () => {
  test("rejects HTTP upgrade without token with 401", async () => {
    const res = await fetch(`${baseUrl}/ws`, {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toContain("Authentication required");
  });

  test("open handler closes connection with invalid token", async () => {
    const ws = createMockWS({ token: "invalid-token-xyz" });
    await websocketHandler.open(ws);

    expect(ws._closed).toBe(true);
    const errorMsg = ws._sentMessages.find((m: any) => m.event === "error");
    expect(errorMsg).toBeDefined();
    expect(errorMsg.data.message).toBe("Invalid token");
  });

  test("open handler closes connection with expired session", async () => {
    const userId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const hashedPassword = await Bun.password.hash("password123");

    await testDb.insert(users).values({
      id: userId,
      username: "expired",
      email: "expired@test.com",
      hashedPassword,
      displayName: "expired",
      status: "offline",
    });

    await testDb.insert(sessions).values({
      id: sessionId,
      userId,
      expiresAt: new Date(Date.now() - 1000), // expired
    });

    const ws = createMockWS({ token: sessionId });
    await websocketHandler.open(ws);

    expect(ws._closed).toBe(true);
    const errorMsg = ws._sentMessages.find((m: any) => m.event === "error");
    expect(errorMsg).toBeDefined();
    expect(errorMsg.data.message).toBe("Invalid token");
  });

  test("open handler closes connection with no token", async () => {
    const ws = createMockWS({ token: "" });
    await websocketHandler.open(ws);

    expect(ws._closed).toBe(true);
    const errorMsg = ws._sentMessages.find((m: any) => m.event === "error");
    expect(errorMsg).toBeDefined();
    expect(errorMsg.data.message).toBe("Not authenticated");
  });

  test("open handler authenticates with valid token", async () => {
    const { sessionId, userId } = await createUserWithSession("alice", "alice@test.com");
    const ws = createMockWS({ token: sessionId });
    await websocketHandler.open(ws);

    expect(ws._closed).toBe(false);
    expect(ws.data.userId).toBe(userId);
    const authMsg = ws._sentMessages.find((m: any) => m.event === "auth:success");
    expect(authMsg).toBeDefined();
    expect(authMsg.data.userId).toBe(userId);

    // Clean up
    _testing.removeClient(userId, ws);
  });

  test("open handler subscribes user to their server channels", async () => {
    const { sessionId, userId } = await createUserWithSession("sub_test", "sub@test.com");
    const { channelId, serverId } = await createServerWithChannel(userId);

    const ws = createMockWS({ token: sessionId });
    await websocketHandler.open(ws);

    expect(ws.data.subscribedChannels.has(channelId)).toBe(true);
    expect(ws.data.subscribedServers.has(serverId)).toBe(true);

    // Clean up
    _testing.removeClient(userId, ws);
  });
});

// =============================================================================
// #21 LOW-3: No max WebSocket connections per user
// =============================================================================
describe("max WebSocket connections per user (#21)", () => {
  test("MAX_CONNECTIONS_PER_USER is 5", () => {
    expect(MAX_CONNECTIONS_PER_USER).toBe(5);
  });

  test("addClient returns true up to the limit", () => {
    const userId = "test-limit-user";
    const mockSockets: any[] = [];

    for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i++) {
      const mock = createMockWS({ userId });
      const result = _testing.addClient(userId, mock);
      expect(result).toBe(true);
      mockSockets.push(mock);
    }

    // Clean up
    for (const mock of mockSockets) {
      _testing.removeClient(userId, mock);
    }
  });

  test("addClient returns false when limit reached", () => {
    const userId = "test-limit-user-2";
    const mockSockets: any[] = [];

    for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i++) {
      const mock = createMockWS({ userId });
      _testing.addClient(userId, mock);
      mockSockets.push(mock);
    }

    // Next one should fail
    const extraMock = createMockWS({ userId });
    const result = _testing.addClient(userId, extraMock);
    expect(result).toBe(false);

    // Clean up
    for (const mock of mockSockets) {
      _testing.removeClient(userId, mock);
    }
  });

  test("open handler rejects when connection limit reached", async () => {
    const { sessionId, userId } = await createUserWithSession("overload", "overload@test.com");

    // Fill up connections
    const existingConns: any[] = [];
    for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i++) {
      const mock = createMockWS({ userId });
      _testing.addClient(userId, mock);
      existingConns.push(mock);
    }

    // New connection with valid token should be rejected at the limit
    const ws = createMockWS({ token: sessionId });
    await websocketHandler.open(ws);

    expect(ws._closed).toBe(true);
    const errorMsg = ws._sentMessages.find((m: any) => m.event === "error");
    expect(errorMsg).toBeDefined();
    expect(errorMsg.data.message).toBe("Too many connections");

    // Clean up
    for (const mock of existingConns) {
      _testing.removeClient(userId, mock);
    }
  });

  test("connection limit check also applies to message-based auth", async () => {
    const { sessionId, userId } = await createUserWithSession("overload2", "overload2@test.com");

    // Fill up connections
    const existingConns: any[] = [];
    for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i++) {
      const mock = createMockWS({ userId });
      _testing.addClient(userId, mock);
      existingConns.push(mock);
    }

    // Simulate message-based auth (legacy path) - userId not set, no token in data
    const ws = createMockWS();
    await websocketHandler.message(ws, JSON.stringify({
      event: "auth",
      data: { token: sessionId },
    }));

    expect(ws._closed).toBe(true);
    const errorMsg = ws._sentMessages.find((m: any) => m.event === "error");
    expect(errorMsg).toBeDefined();
    expect(errorMsg.data.message).toBe("Too many connections");

    // Clean up
    for (const mock of existingConns) {
      _testing.removeClient(userId, mock);
    }
  });
});

// =============================================================================
// #7 HIGH-4: Typing indicator without membership check
// =============================================================================
describe("typing indicator membership check (#7)", () => {
  test("typing:start is ignored for non-subscribed channels", async () => {
    const { userId } = await createUserWithSession("typer", "typer@test.com");
    const subscribedChannels = new Set(["channel-abc"]);
    const ws = createMockWS({ userId, subscribedChannels });

    // Send typing for a channel the user is NOT subscribed to
    await _testing.eventHandlers["typing:start"](ws, { channelId: "not-subscribed-channel" });

    // Should NOT broadcast typing
    const typingMsgs = ws._sentMessages.filter((m: any) => m.event === "typing:update");
    expect(typingMsgs.length).toBe(0);
  });

  test("typing:start works for subscribed channels", async () => {
    const { userId } = await createUserWithSession("typer2", "typer2@test.com");
    const channelId = "channel-xyz";

    // Set up subscription and reverse index
    const ws = createMockWS({ userId, subscribedChannels: new Set([channelId]) });
    _testing.subscribeToChannel(ws, channelId);

    await _testing.eventHandlers["typing:start"](ws, { channelId });

    // Should broadcast typing to the channel (ws is subscribed, so it receives the broadcast)
    const typingMsgs = ws._sentMessages.filter((m: any) => m.event === "typing:update");
    expect(typingMsgs.length).toBe(1);
    expect(typingMsgs[0].data.channelId).toBe(channelId);
    expect(typingMsgs[0].data.userId).toBe(userId);

    // Clean up reverse index
    _testing.channelSubscribers.delete(channelId);
  });

  test("typing:start is ignored with no channelId", async () => {
    const { userId } = await createUserWithSession("typer3", "typer3@test.com");
    const ws = createMockWS({ userId });

    await _testing.eventHandlers["typing:start"](ws, {});

    const typingMsgs = ws._sentMessages.filter((m: any) => m.event === "typing:update");
    expect(typingMsgs.length).toBe(0);
  });

  test("typing:start is ignored with null channelId", async () => {
    const { userId } = await createUserWithSession("typer4", "typer4@test.com");
    const ws = createMockWS({ userId });

    await _testing.eventHandlers["typing:start"](ws, { channelId: null });

    const typingMsgs = ws._sentMessages.filter((m: any) => m.event === "typing:update");
    expect(typingMsgs.length).toBe(0);
  });
});

// =============================================================================
// #8 HIGH-5: Presence status without validation
// =============================================================================
describe("presence status validation (#8)", () => {
  test("rejects invalid status value", async () => {
    const { userId } = await createUserWithSession("presence1", "presence1@test.com");
    const ws = createMockWS({ userId, subscribedServers: new Set(["server-1"]) });

    await _testing.eventHandlers["presence:update"](ws, { status: "hacked_status" });

    // Should not send presence:update to anyone
    const presenceMsgs = ws._sentMessages.filter((m: any) => m.event === "presence:update");
    expect(presenceMsgs.length).toBe(0);
  });

  test("rejects empty status", async () => {
    const { userId } = await createUserWithSession("presence2", "presence2@test.com");
    const ws = createMockWS({ userId });

    await _testing.eventHandlers["presence:update"](ws, {});

    const presenceMsgs = ws._sentMessages.filter((m: any) => m.event === "presence:update");
    expect(presenceMsgs.length).toBe(0);
  });

  test("rejects script injection in status", async () => {
    const { userId } = await createUserWithSession("presence3", "presence3@test.com");
    const ws = createMockWS({ userId });

    await _testing.eventHandlers["presence:update"](ws, { status: "<script>alert(1)</script>" });

    const presenceMsgs = ws._sentMessages.filter((m: any) => m.event === "presence:update");
    expect(presenceMsgs.length).toBe(0);
  });

  test("accepts 'online' status", async () => {
    const { userId } = await createUserWithSession("presence4", "presence4@test.com");
    const ws = createMockWS({ userId, subscribedServers: new Set(["srv"]) });

    // Subscribe ws to the server for broadcast
    const subs = new Set<any>();
    subs.add(ws);
    _testing.serverSubscribers.set("srv", subs as any);

    await _testing.eventHandlers["presence:update"](ws, { status: "online" });

    const presenceMsgs = ws._sentMessages.filter((m: any) => m.event === "presence:update");
    expect(presenceMsgs.length).toBe(1);
    expect(presenceMsgs[0].data.status).toBe("online");

    _testing.serverSubscribers.delete("srv");
  });

  test("accepts 'idle' status", async () => {
    const { userId } = await createUserWithSession("presence5", "presence5@test.com");
    const ws = createMockWS({ userId, subscribedServers: new Set(["srv2"]) });

    const subs = new Set<any>();
    subs.add(ws);
    _testing.serverSubscribers.set("srv2", subs as any);

    await _testing.eventHandlers["presence:update"](ws, { status: "idle" });

    const presenceMsgs = ws._sentMessages.filter((m: any) => m.event === "presence:update");
    expect(presenceMsgs.length).toBe(1);
    expect(presenceMsgs[0].data.status).toBe("idle");

    _testing.serverSubscribers.delete("srv2");
  });

  test("accepts 'dnd' status", async () => {
    const { userId } = await createUserWithSession("presence6", "presence6@test.com");
    const ws = createMockWS({ userId, subscribedServers: new Set(["srv3"]) });

    const subs = new Set<any>();
    subs.add(ws);
    _testing.serverSubscribers.set("srv3", subs as any);

    await _testing.eventHandlers["presence:update"](ws, { status: "dnd" });

    const presenceMsgs = ws._sentMessages.filter((m: any) => m.event === "presence:update");
    expect(presenceMsgs.length).toBe(1);
    expect(presenceMsgs[0].data.status).toBe("dnd");

    _testing.serverSubscribers.delete("srv3");
  });

  test("accepts 'offline' status", async () => {
    const { userId } = await createUserWithSession("presence7", "presence7@test.com");
    const ws = createMockWS({ userId, subscribedServers: new Set(["srv4"]) });

    const subs = new Set<any>();
    subs.add(ws);
    _testing.serverSubscribers.set("srv4", subs as any);

    await _testing.eventHandlers["presence:update"](ws, { status: "offline" });

    const presenceMsgs = ws._sentMessages.filter((m: any) => m.event === "presence:update");
    expect(presenceMsgs.length).toBe(1);
    expect(presenceMsgs[0].data.status).toBe("offline");

    _testing.serverSubscribers.delete("srv4");
  });
});

// =============================================================================
// #18 MED-7: Voice signaling without channel check
// =============================================================================
describe("voice signaling channel check (#18)", () => {
  test("voice:offer is ignored when sender is not in any voice channel", async () => {
    const { userId: user1 } = await createUserWithSession("voice1", "voice1@test.com");
    const { userId: user2 } = await createUserWithSession("voice2", "voice2@test.com");

    // Neither user is in a voice channel
    const ws1 = createMockWS({ userId: user1 });

    // Register user2's socket so sendToUser can find it
    const ws2 = createMockWS({ userId: user2 });
    _testing.addClient(user2, ws2);

    _testing.eventHandlers["voice:offer"](ws1, { targetUserId: user2, sdp: "fake-sdp" });

    // user2 should NOT receive the offer
    const offerMsgs = ws2._sentMessages.filter((m: any) => m.event === "voice:offer");
    expect(offerMsgs.length).toBe(0);

    _testing.removeClient(user2, ws2);
  });

  test("voice:offer is ignored when users are in different voice channels", async () => {
    const { userId: user1 } = await createUserWithSession("voice3", "voice3@test.com");
    const { userId: user2 } = await createUserWithSession("voice4", "voice4@test.com");

    // Put users in different voice channels
    _testing.userVoiceChannel.set(user1, "channelA");
    _testing.userVoiceChannel.set(user2, "channelB");

    const ws1 = createMockWS({ userId: user1 });
    const ws2 = createMockWS({ userId: user2 });
    _testing.addClient(user2, ws2);

    _testing.eventHandlers["voice:offer"](ws1, { targetUserId: user2, sdp: "fake-sdp" });

    const offerMsgs = ws2._sentMessages.filter((m: any) => m.event === "voice:offer");
    expect(offerMsgs.length).toBe(0);

    _testing.removeClient(user2, ws2);
    _testing.userVoiceChannel.delete(user1);
    _testing.userVoiceChannel.delete(user2);
  });

  test("voice:answer is ignored when users are in different channels", async () => {
    const { userId: user1 } = await createUserWithSession("voice5", "voice5@test.com");
    const { userId: user2 } = await createUserWithSession("voice6", "voice6@test.com");

    _testing.userVoiceChannel.set(user1, "channelX");
    _testing.userVoiceChannel.set(user2, "channelY");

    const ws1 = createMockWS({ userId: user1 });
    const ws2 = createMockWS({ userId: user2 });
    _testing.addClient(user2, ws2);

    _testing.eventHandlers["voice:answer"](ws1, { targetUserId: user2, sdp: "fake-sdp" });

    const answerMsgs = ws2._sentMessages.filter((m: any) => m.event === "voice:answer");
    expect(answerMsgs.length).toBe(0);

    _testing.removeClient(user2, ws2);
    _testing.userVoiceChannel.delete(user1);
    _testing.userVoiceChannel.delete(user2);
  });

  test("voice:ice-candidate is ignored when users are in different channels", async () => {
    const { userId: user1 } = await createUserWithSession("voice7", "voice7@test.com");
    const { userId: user2 } = await createUserWithSession("voice8", "voice8@test.com");

    _testing.userVoiceChannel.set(user1, "channelP");
    _testing.userVoiceChannel.set(user2, "channelQ");

    const ws1 = createMockWS({ userId: user1 });
    const ws2 = createMockWS({ userId: user2 });
    _testing.addClient(user2, ws2);

    _testing.eventHandlers["voice:ice-candidate"](ws1, { targetUserId: user2, candidate: "fake-candidate" });

    const iceMsgs = ws2._sentMessages.filter((m: any) => m.event === "voice:ice-candidate");
    expect(iceMsgs.length).toBe(0);

    _testing.removeClient(user2, ws2);
    _testing.userVoiceChannel.delete(user1);
    _testing.userVoiceChannel.delete(user2);
  });

  test("voice:offer works when both users are in the same channel", async () => {
    const { userId: user1 } = await createUserWithSession("voice9", "voice9@test.com");
    const { userId: user2 } = await createUserWithSession("voice10", "voice10@test.com");

    const sharedChannel = "shared-voice-channel";
    _testing.userVoiceChannel.set(user1, sharedChannel);
    _testing.userVoiceChannel.set(user2, sharedChannel);

    const ws1 = createMockWS({ userId: user1 });
    const ws2 = createMockWS({ userId: user2 });
    _testing.addClient(user2, ws2);

    _testing.eventHandlers["voice:offer"](ws1, { targetUserId: user2, sdp: "real-sdp" });

    const offerMsgs = ws2._sentMessages.filter((m: any) => m.event === "voice:offer");
    expect(offerMsgs.length).toBe(1);
    expect(offerMsgs[0].data.fromUserId).toBe(user1);
    expect(offerMsgs[0].data.sdp).toBe("real-sdp");

    _testing.removeClient(user2, ws2);
    _testing.userVoiceChannel.delete(user1);
    _testing.userVoiceChannel.delete(user2);
  });

  test("voice:offer is ignored with missing targetUserId", async () => {
    const { userId: user1 } = await createUserWithSession("voice11", "voice11@test.com");
    _testing.userVoiceChannel.set(user1, "someChannel");

    const ws1 = createMockWS({ userId: user1 });
    _testing.eventHandlers["voice:offer"](ws1, { sdp: "fake-sdp" });

    // No crash, no messages sent
    expect(ws1._sentMessages.length).toBe(0);

    _testing.userVoiceChannel.delete(user1);
  });

  test("voice:offer is ignored with missing sdp", async () => {
    const { userId: user1 } = await createUserWithSession("voice12", "voice12@test.com");
    const { userId: user2 } = await createUserWithSession("voice13", "voice13@test.com");

    _testing.userVoiceChannel.set(user1, "ch");
    _testing.userVoiceChannel.set(user2, "ch");

    const ws1 = createMockWS({ userId: user1 });
    _testing.eventHandlers["voice:offer"](ws1, { targetUserId: user2 });

    expect(ws1._sentMessages.length).toBe(0);

    _testing.userVoiceChannel.delete(user1);
    _testing.userVoiceChannel.delete(user2);
  });
});

// =============================================================================
// General WebSocket auth enforcement
// =============================================================================
describe("WebSocket message auth enforcement", () => {
  test("unauthenticated message sends error", async () => {
    const ws = createMockWS(); // no userId set
    await websocketHandler.message(ws, JSON.stringify({
      event: "typing:start",
      data: { channelId: "test" },
    }));

    const errorMsg = ws._sentMessages.find((m: any) => m.event === "error");
    expect(errorMsg).toBeDefined();
    expect(errorMsg.data.message).toBe("Not authenticated");
  });

  test("already-authenticated ws skips re-auth on auth message", async () => {
    const { sessionId, userId } = await createUserWithSession("reauth", "reauth@test.com");
    const ws = createMockWS({ userId });

    await websocketHandler.message(ws, JSON.stringify({
      event: "auth",
      data: { token: sessionId },
    }));

    const authMsg = ws._sentMessages.find((m: any) => m.event === "auth:success");
    expect(authMsg).toBeDefined();
    expect(authMsg.data.userId).toBe(userId);
    expect(ws._closed).toBe(false);
  });

  test("invalid JSON sends error", async () => {
    const ws = createMockWS({ userId: "test" });
    await websocketHandler.message(ws, "not valid json{{{");

    const errorMsg = ws._sentMessages.find((m: any) => m.event === "error");
    expect(errorMsg).toBeDefined();
    expect(errorMsg.data.message).toBe("Invalid message format");
  });
});
