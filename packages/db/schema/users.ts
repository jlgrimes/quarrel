import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  username: text("username").unique().notNull(),
  displayName: text("display_name"),
  email: text("email").unique().notNull(),
  hashedPassword: text("hashed_password").notNull(),
  avatarUrl: text("avatar_url"),
  status: text("status", { enum: ["online", "offline", "idle", "dnd"] }).default("offline"),
  customStatus: text("custom_status"),
  bio: text("bio"),
  bannerUrl: text("banner_url"),
  pronouns: text("pronouns"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
