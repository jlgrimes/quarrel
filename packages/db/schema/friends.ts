import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const friends = sqliteTable(
  "friends",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    friendId: text("friend_id")
      .notNull()
      .references(() => users.id),
    status: text("status", { enum: ["pending", "accepted", "blocked"] }).notNull().default("pending"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdx: index("friends_user_idx").on(table.userId),
    friendIdx: index("friends_friend_idx").on(table.friendId),
    userStatusIdx: index("friends_user_status_idx").on(table.userId, table.status),
  })
);
