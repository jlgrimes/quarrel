import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const conversations = sqliteTable("conversations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const conversationMembers = sqliteTable(
  "conversation_members",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.conversationId, table.userId] }),
    userIdx: index("conversation_members_user_idx").on(table.userId),
  })
);

export const directMessages = sqliteTable(
  "direct_messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    content: text("content").notNull(),
    attachments: text("attachments"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    editedAt: integer("edited_at", { mode: "timestamp" }),
    deleted: integer("deleted", { mode: "boolean" }).default(false),
  },
  (table) => ({
    conversationCreatedAtIdx: index("direct_messages_conversation_created_at_idx").on(table.conversationId, table.createdAt),
    authorIdx: index("direct_messages_author_idx").on(table.authorId),
  })
);
