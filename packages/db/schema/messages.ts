import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { channels } from "./channels";
import { users } from "./users";

export const messages = sqliteTable("messages", {
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
});
