import { sqliteTable, text, integer, unique, index } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { servers } from "./servers";

export const serverBots = sqliteTable(
  "server_bots",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id),
    botUserId: text("bot_user_id")
      .notNull()
      .references(() => users.id),
    provider: text("provider", { enum: ["anthropic", "openai", "google"] }).notNull(),
    model: text("model").notNull(),
    apiKey: text("api_key").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).default(true),
    systemPrompt: text("system_prompt"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => ({
    serverBotUnique: unique().on(table.serverId, table.botUserId),
    serverIdx: index("server_bots_server_idx").on(table.serverId),
  })
);
