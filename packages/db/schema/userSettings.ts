import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const userSettings = sqliteTable(
  "user_settings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id),
    theme: text("theme", { enum: ["dark", "light"] }).notNull().default("dark"),
    fontSize: text("font_size", { enum: ["small", "normal", "large"] }).notNull().default("normal"),
    compactMode: integer("compact_mode", { mode: "boolean" }).notNull().default(false),
    notificationsEnabled: integer("notifications_enabled", { mode: "boolean" }).notNull().default(true),
    notificationSounds: integer("notification_sounds", { mode: "boolean" }).notNull().default(true),
    allowDms: text("allow_dms", { enum: ["everyone", "friends", "none"] }).notNull().default("everyone"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdx: index("user_settings_user_idx").on(table.userId),
  })
);
