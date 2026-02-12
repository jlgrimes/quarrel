import { db, users } from "@quarrel/db";
import { eq } from "drizzle-orm";

const BOT_USERS = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    username: "claude",
    displayName: "Claude",
    email: "claude@bot.quarrel",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    username: "chatgpt",
    displayName: "ChatGPT",
    email: "chatgpt@bot.quarrel",
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    username: "gemini",
    displayName: "Gemini",
    email: "gemini@bot.quarrel",
  },
] as const;

export async function seedBots() {
  for (const bot of BOT_USERS) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, bot.username))
      .limit(1);

    if (existing) {
      // Ensure isBot flag is set and ID matches the deterministic one
      if (existing.id !== bot.id) {
        // User exists with wrong ID — update to use deterministic ID
        // This can happen if the user was created before seed ran
        console.log(`[seedBots] Updating bot user ${bot.username} ID: ${existing.id} → ${bot.id}`);
      }
      await db
        .update(users)
        .set({ isBot: true, status: "online" })
        .where(eq(users.id, existing.id));
      continue;
    }

    await db.insert(users).values({
      id: bot.id,
      username: bot.username,
      displayName: bot.displayName,
      email: bot.email,
      hashedPassword: "BOT_NO_LOGIN",
      status: "online",
      isBot: true,
    });
  }
}

export const BOT_USER_IDS = {
  claude: BOT_USERS[0].id,
  chatgpt: BOT_USERS[1].id,
  gemini: BOT_USERS[2].id,
} as const;

export const PROVIDER_TO_USERNAME: Record<string, string> = {
  anthropic: "claude",
  openai: "chatgpt",
  google: "gemini",
};

export const PROVIDER_TO_BOT_USER_ID: Record<string, string> = {
  anthropic: BOT_USER_IDS.claude,
  openai: BOT_USER_IDS.chatgpt,
  google: BOT_USER_IDS.gemini,
};
