import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { servers } from "./servers";

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    serverId: text("server_id").notNull().references(() => servers.id),
    actorId: text("actor_id").notNull().references(() => users.id),
    action: text("action").notNull(),
    targetId: text("target_id"),
    targetType: text("target_type", { enum: ["user", "channel", "role", "invite"] }),
    reason: text("reason"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => ({
    serverCreatedAtIdx: index("audit_log_server_created_at_idx").on(table.serverId, table.createdAt),
    actorIdx: index("audit_log_actor_idx").on(table.actorId),
  })
);
