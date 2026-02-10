import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { messages } from "./messages";
import { users } from "./users";

export const reactions = sqliteTable("reactions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  messageId: text("message_id")
    .notNull()
    .references(() => messages.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  emoji: text("emoji").notNull(),
});
