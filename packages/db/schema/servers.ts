import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const servers = sqliteTable("servers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  iconUrl: text("icon_url"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  inviteCode: text("invite_code").unique().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
