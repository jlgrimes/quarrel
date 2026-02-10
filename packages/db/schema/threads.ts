import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { messages } from "./messages";
import { channels } from "./channels";
import { users } from "./users";

export const threads = sqliteTable(
  "threads",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    parentMessageId: text("parent_message_id")
      .notNull()
      .unique()
      .references(() => messages.id),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id),
    creatorId: text("creator_id")
      .notNull()
      .references(() => users.id),
    lastMessageAt: integer("last_message_at", { mode: "timestamp" }),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => ({
    channelIdx: index("threads_channel_idx").on(table.channelId),
    parentMessageIdx: uniqueIndex("threads_parent_message_idx").on(table.parentMessageId),
    channelArchivedIdx: index("threads_channel_archived_idx").on(table.channelId, table.archivedAt),
  })
);

export const threadMessages = sqliteTable(
  "thread_messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    threadId: text("thread_id")
      .notNull()
      .references(() => threads.id),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    content: text("content").notNull(),
    editedAt: integer("edited_at", { mode: "timestamp" }),
    attachments: text("attachments"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    deleted: integer("deleted", { mode: "boolean" }).default(false),
  },
  (table) => ({
    threadCreatedAtIdx: index("thread_messages_thread_created_at_idx").on(table.threadId, table.createdAt),
    authorIdx: index("thread_messages_author_idx").on(table.authorId),
  })
);

export const threadMembers = sqliteTable(
  "thread_members",
  {
    threadId: text("thread_id")
      .notNull()
      .references(() => threads.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    notifyPreference: text("notify_preference").default("all"),
    lastReadAt: integer("last_read_at", { mode: "timestamp" }),
  },
  (table) => ({
    pk: uniqueIndex("thread_members_pk").on(table.threadId, table.userId),
    userIdx: index("thread_members_user_idx").on(table.userId),
  })
);
