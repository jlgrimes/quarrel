import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { servers } from "./servers";

export const timeouts = sqliteTable(
  "timeouts",
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
    timedOutBy: text("timed_out_by")
      .notNull()
      .references(() => users.id),
    reason: text("reason"),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => ({
    serverUserIdx: index("timeouts_server_user_idx").on(table.serverId, table.userId),
    expiresAtIdx: index("timeouts_expires_at_idx").on(table.expiresAt),
  })
);
