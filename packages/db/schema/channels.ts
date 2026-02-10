import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { servers } from "./servers";

export const channels = sqliteTable("channels", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  serverId: text("server_id")
    .notNull()
    .references(() => servers.id),
  name: text("name").notNull(),
  type: text("type", { enum: ["text", "voice", "category"] }).notNull().default("text"),
  topic: text("topic"),
  categoryId: text("category_id").references((): any => channels.id),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
