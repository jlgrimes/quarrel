import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { servers } from "./servers";
import { members } from "./members";

export const roles = sqliteTable(
  "roles",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id),
    name: text("name").notNull(),
    color: text("color"),
    permissions: integer("permissions").notNull().default(0),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => ({
    serverIdx: index("roles_server_idx").on(table.serverId),
  })
);

export const memberRoles = sqliteTable(
  "member_roles",
  {
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.memberId, table.roleId] }),
  })
);
