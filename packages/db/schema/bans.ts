import { sqliteTable, text, integer, unique, index } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { servers } from "./servers";

export const bans = sqliteTable(
  "bans",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason"),
    bannedBy: text("banned_by")
      .notNull()
      .references(() => users.id),
    bannedAt: integer("banned_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => ({
    userServerUnique: unique().on(table.userId, table.serverId),
    serverIdx: index("bans_server_idx").on(table.serverId),
    userIdx: index("bans_user_idx").on(table.userId),
  })
);
