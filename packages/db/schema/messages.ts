import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { channels } from "./channels";
import { users } from "./users";

export const messages = sqliteTable(
  "messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    content: text("content").notNull(),
    editedAt: integer("edited_at", { mode: "timestamp" }),
    attachments: text("attachments"),
    replyToId: text("reply_to_id").references((): any => messages.id),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    deleted: integer("deleted", { mode: "boolean" }).default(false),
    pinnedAt: integer("pinned_at", { mode: "timestamp" }),
    pinnedBy: text("pinned_by").references(() => users.id),
  },
  (table) => ({
    channelCreatedAtIdx: index("messages_channel_created_at_idx").on(table.channelId, table.createdAt),
    authorIdx: index("messages_author_idx").on(table.authorId),
    createdAtIdx: index("messages_created_at_idx").on(table.createdAt),
  })
);
