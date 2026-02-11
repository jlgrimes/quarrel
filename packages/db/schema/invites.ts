import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { servers } from "./servers";

export const invites = sqliteTable(
  "invites",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id),
    code: text("code").unique().notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    maxUses: integer("max_uses"),
    uses: integer("uses").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => ({
    serverIdx: index("invites_server_idx").on(table.serverId),
    codeIdx: index("invites_code_idx").on(table.code),
  })
);
