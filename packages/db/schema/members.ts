import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { servers } from "./servers";

export const members = sqliteTable(
  "members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id),
    nickname: text("nickname"),
    joinedAt: integer("joined_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => ({
    userServerUnique: unique().on(table.userId, table.serverId),
  })
);
