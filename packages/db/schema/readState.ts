import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { channels } from "./channels";
import { conversations } from "./dms";

export const readState = sqliteTable(
  "read_state",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    channelId: text("channel_id").references(() => channels.id),
    conversationId: text("conversation_id").references(() => conversations.id),
    lastReadMessageId: text("last_read_message_id"),
    lastReadAt: integer("last_read_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
  },
  (table) => ({
    userChannelIdx: uniqueIndex("read_state_user_channel_idx").on(
      table.userId,
      table.channelId
    ),
    userConversationIdx: uniqueIndex("read_state_user_conversation_idx").on(
      table.userId,
      table.conversationId
    ),
    userIdx: index("read_state_user_idx").on(table.userId),
  })
);
