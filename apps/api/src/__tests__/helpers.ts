import { Hono } from "hono";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@quarrel/db/schema/index";

// Create an in-memory libsql client and drizzle instance for testing
const client = createClient({ url: "file::memory:" });
export const testDb = drizzle(client, { schema });

// SQL to create all tables
const createTablesSql = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    avatar_url TEXT,
    status TEXT DEFAULT 'offline',
    custom_status TEXT,
    bio TEXT,
    banner_url TEXT,
    pronouns TEXT,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon_url TEXT,
    description TEXT,
    owner_id TEXT NOT NULL REFERENCES users(id),
    invite_code TEXT UNIQUE NOT NULL,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL REFERENCES servers(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    topic TEXT,
    category_id TEXT REFERENCES channels(id),
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    server_id TEXT NOT NULL REFERENCES servers(id),
    nickname TEXT,
    joined_at INTEGER,
    UNIQUE(user_id, server_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL REFERENCES channels(id),
    author_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    edited_at INTEGER,
    attachments TEXT,
    reply_to_id TEXT REFERENCES messages(id),
    created_at INTEGER,
    deleted INTEGER DEFAULT 0,
    pinned_at INTEGER,
    pinned_by TEXT REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS friends (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    friend_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    is_group INTEGER DEFAULT 0,
    name TEXT,
    icon_url TEXT,
    owner_id TEXT REFERENCES users(id),
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    PRIMARY KEY (conversation_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS direct_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    author_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    attachments TEXT,
    created_at INTEGER,
    edited_at INTEGER,
    deleted INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL REFERENCES servers(id),
    name TEXT NOT NULL,
    color TEXT,
    permissions INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS member_roles (
    member_id TEXT NOT NULL REFERENCES members(id),
    role_id TEXT NOT NULL REFERENCES roles(id),
    PRIMARY KEY (member_id, role_id)
  );

  CREATE TABLE IF NOT EXISTS reactions (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    emoji TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bans (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL REFERENCES servers(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    reason TEXT,
    banned_by TEXT NOT NULL REFERENCES users(id),
    banned_at INTEGER,
    UNIQUE(user_id, server_id)
  );
  CREATE INDEX IF NOT EXISTS bans_server_idx ON bans(server_id);
  CREATE INDEX IF NOT EXISTS bans_user_idx ON bans(user_id);

  CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    parent_message_id TEXT NOT NULL UNIQUE REFERENCES messages(id),
    channel_id TEXT NOT NULL REFERENCES channels(id),
    creator_id TEXT NOT NULL REFERENCES users(id),
    last_message_at INTEGER,
    archived_at INTEGER,
    created_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS threads_channel_idx ON threads(channel_id);
  CREATE INDEX IF NOT EXISTS threads_channel_archived_idx ON threads(channel_id, archived_at);

  CREATE TABLE IF NOT EXISTS thread_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES threads(id),
    author_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    edited_at INTEGER,
    attachments TEXT,
    created_at INTEGER,
    deleted INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS thread_messages_thread_created_at_idx ON thread_messages(thread_id, created_at);
  CREATE INDEX IF NOT EXISTS thread_messages_author_idx ON thread_messages(author_id);

  CREATE TABLE IF NOT EXISTS thread_members (
    thread_id TEXT NOT NULL REFERENCES threads(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    notify_preference TEXT DEFAULT 'all',
    last_read_at INTEGER,
    PRIMARY KEY (thread_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS thread_members_user_idx ON thread_members(user_id);

  CREATE TABLE IF NOT EXISTS user_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    theme TEXT NOT NULL DEFAULT 'dark',
    font_size TEXT NOT NULL DEFAULT 'normal',
    compact_mode INTEGER NOT NULL DEFAULT 0,
    notifications_enabled INTEGER NOT NULL DEFAULT 1,
    notification_sounds INTEGER NOT NULL DEFAULT 1,
    allow_dms TEXT NOT NULL DEFAULT 'everyone',
    created_at INTEGER,
    updated_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS user_settings_user_idx ON user_settings(user_id);

  CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL REFERENCES servers(id),
    code TEXT UNIQUE NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    expires_at INTEGER,
    max_uses INTEGER,
    uses INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS invites_server_idx ON invites(server_id);
  CREATE INDEX IF NOT EXISTS invites_code_idx ON invites(code);

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL REFERENCES servers(id),
    actor_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    target_id TEXT,
    target_type TEXT,
    reason TEXT,
    metadata TEXT,
    created_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS audit_log_server_created_at_idx ON audit_log(server_id, created_at);
  CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log(actor_id);

  CREATE TABLE IF NOT EXISTS timeouts (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL REFERENCES servers(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    timed_out_by TEXT NOT NULL REFERENCES users(id),
    reason TEXT,
    expires_at INTEGER NOT NULL,
    created_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS timeouts_server_user_idx ON timeouts(server_id, user_id);
  CREATE INDEX IF NOT EXISTS timeouts_expires_at_idx ON timeouts(expires_at);

  CREATE TABLE IF NOT EXISTS read_state (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    channel_id TEXT REFERENCES channels(id),
    conversation_id TEXT REFERENCES conversations(id),
    last_read_message_id TEXT,
    last_read_at INTEGER
  );
  CREATE UNIQUE INDEX IF NOT EXISTS read_state_user_channel_idx ON read_state(user_id, channel_id);
  CREATE UNIQUE INDEX IF NOT EXISTS read_state_user_conversation_idx ON read_state(user_id, conversation_id);
  CREATE INDEX IF NOT EXISTS read_state_user_idx ON read_state(user_id);
`;

export async function setupDatabase() {
  // Disable FK enforcement so cascading deletes work like Turso in production
  await client.execute("PRAGMA foreign_keys = OFF");
  const statements = createTablesSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const sql of statements) {
    await client.execute(sql);
  }
}

export async function clearDatabase() {
  const tables = [
    "timeouts",
    "audit_log",
    "invites",
    "user_settings",
    "read_state",
    "thread_members",
    "thread_messages",
    "threads",
    "reactions",
    "member_roles",
    "roles",
    "bans",
    "direct_messages",
    "conversation_members",
    "conversations",
    "friends",
    "messages",
    "members",
    "channels",
    "servers",
    "sessions",
    "users",
  ];
  for (const table of tables) {
    await client.execute(`DELETE FROM ${table}`);
  }
  await resetRateLimiters();
}

// Build the Hono app the same way index.ts does, but importing routes fresh
// The routes import `db` from "@quarrel/db" — we mock that module below.
import { mock } from "bun:test";

// Mock @quarrel/db to use our test database
mock.module("@quarrel/db", () => ({
  db: testDb,
  ...schema,
}));

// Mock analytics for testing — capture calls are recorded in analyticsMock.events
export const analyticsMock = {
  events: [] as Array<{ distinctId: string; event: string; properties?: Record<string, unknown> }>,
  clear() {
    this.events.length = 0;
  },
};

mock.module("../lib/analytics", () => ({
  analytics: {
    capture(distinctId: string, event: string, properties?: Record<string, unknown>) {
      analyticsMock.events.push({ distinctId, event, properties });
    },
    async shutdown() {},
  },
  isEnabled: () => false,
}));

// Mock R2 client for testing — override via r2MockOverride for error tests
export let r2MockOverride: { createPresignedUploadUrl?: Function } = {};

mock.module("../lib/r2", () => ({
  createPresignedUploadUrl: async (key: string, contentType: string, contentLength: number) => {
    if (r2MockOverride.createPresignedUploadUrl) {
      return r2MockOverride.createPresignedUploadUrl(key, contentType, contentLength);
    }
    return {
      presignedUrl: `https://r2-mock.example.com/upload/${key}?presigned=true`,
      publicUrl: `https://cdn.example.com/${key}`,
    };
  },
  deleteR2Object: async (key: string) => {},
  R2_PUBLIC_URL: "https://cdn.example.com",
}));

// Import rate limiter reset after mocks so it shares the same module instance as routes
const { resetRateLimiters } = await import("../middleware/rateLimit");
export { resetRateLimiters };

// Now import route constructors — they'll get the mocked db
const { authRoutes } = await import("../routes/auth");
const { serverRoutes } = await import("../routes/servers");
const { channelRoutes } = await import("../routes/channels");
const { messageRoutes } = await import("../routes/messages");
const { memberRoutes } = await import("../routes/members");
const { friendRoutes } = await import("../routes/friends");
const { dmRoutes } = await import("../routes/dms");
const { userRoutes } = await import("../routes/users");
const { roleRoutes } = await import("../routes/roles");
const { banRoutes } = await import("../routes/bans");
const { embedRoutes } = await import("../routes/embeds");
const { threadRoutes } = await import("../routes/threads");
const { inviteRoutes } = await import("../routes/invites");
const { auditLogRoutes } = await import("../routes/auditLog");
const { timeoutRoutes } = await import("../routes/timeouts");

const { secureHeaders } = await import("hono/secure-headers");
const { errorHandler } = await import("../middleware/errorHandler");

export function createApp() {
  const app = new Hono();
  app.use(secureHeaders());
  app.onError(errorHandler);
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.route("/auth", authRoutes);
  app.route("/servers", serverRoutes);
  app.route("/", channelRoutes);
  app.route("/", messageRoutes);
  app.route("/", memberRoutes);
  app.route("/friends", friendRoutes);
  app.route("/dms", dmRoutes);
  app.route("/users", userRoutes);
  app.route("/", roleRoutes);
  app.route("/", banRoutes);
  app.route("/", embedRoutes);
  app.route("/", threadRoutes);
  app.route("/", inviteRoutes);
  app.route("/", auditLogRoutes);
  app.route("/", timeoutRoutes);
  return app;
}

// Helper to register a user and return the token + user
export async function createTestUser(
  app: Hono,
  username = "testuser",
  email = "test@example.com",
  password = "password123"
) {
  const res = await app.request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
    headers: { "Content-Type": "application/json" },
  });
  const data = (await res.json()) as any;
  return { token: data.token, user: data.user, status: res.status };
}

// Helper to log in and return the token + user
export async function loginTestUser(
  app: Hono,
  email = "test@example.com",
  password = "password123"
) {
  const res = await app.request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    headers: { "Content-Type": "application/json" },
  });
  const data = (await res.json()) as any;
  return { token: data.token, user: data.user, status: res.status };
}

// Helper to build auth headers from a token
export function getAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}
