import { db, users, messages, serverBots } from "@quarrel/db";
import { eq, and, desc } from "drizzle-orm";
import { callAIProvider } from "./aiProviders";
import { broadcastToChannel } from "../ws";
import { analytics } from "./analytics";

const MENTION_REGEX = /<@([a-zA-Z0-9-]+)>/g;

// Rate limit: max 1 bot response per 5s per channel
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 5000;

function isRateLimited(channelId: string): boolean {
  const lastTime = rateLimitMap.get(channelId);
  if (lastTime && Date.now() - lastTime < RATE_LIMIT_MS) {
    return true;
  }
  rateLimitMap.set(channelId, Date.now());
  return false;
}

export async function handleBotMentions(
  channelId: string,
  serverId: string,
  content: string,
  authorId: string
) {
  // Parse mentions from content
  const mentionedIds = new Set<string>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_REGEX);
  while ((match = regex.exec(content)) !== null) {
    mentionedIds.add(match[1]);
  }

  if (mentionedIds.size === 0) return;

  // Check which mentions are bots
  for (const mentionedId of mentionedIds) {
    const [mentionedUser] = await db
      .select({ id: users.id, isBot: users.isBot })
      .from(users)
      .where(eq(users.id, mentionedId))
      .limit(1);

    if (!mentionedUser || !mentionedUser.isBot) continue;

    // Look up server bot config
    const [botConfig] = await db
      .select()
      .from(serverBots)
      .where(
        and(
          eq(serverBots.serverId, serverId),
          eq(serverBots.botUserId, mentionedId),
          eq(serverBots.enabled, true)
        )
      )
      .limit(1);

    if (!botConfig) continue;

    // Rate limit check
    if (isRateLimited(channelId)) continue;

    analytics.capture(authorId, "bot:mention", {
      serverId,
      channelId,
      botUserId: mentionedId,
      provider: botConfig.provider,
    });

    // Broadcast typing indicator
    const [botUser] = await db
      .select({ username: users.username, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, mentionedId))
      .limit(1);

    broadcastToChannel(channelId, "typing:update", {
      userId: mentionedId,
      username: botUser?.displayName ?? botUser?.username ?? "Bot",
      channelId,
    });

    try {
      // Fetch last 20 messages for context
      const recentMessages = await db
        .select({
          content: messages.content,
          authorId: messages.authorId,
        })
        .from(messages)
        .where(eq(messages.channelId, channelId))
        .orderBy(desc(messages.createdAt))
        .limit(20);

      // Build conversation history (chronological order)
      const aiMessages = recentMessages.reverse().map((m) => ({
        role: (m.authorId === mentionedId ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      }));

      const response = await callAIProvider(
        botConfig.provider,
        botConfig.model,
        botConfig.apiKey,
        aiMessages,
        botConfig.systemPrompt
      );

      if (!response) continue;

      // Insert AI response as a message
      const [newMessage] = await db
        .insert(messages)
        .values({
          channelId,
          authorId: mentionedId,
          content: response,
        })
        .returning();

      const author = {
        id: mentionedId,
        username: botUser?.username ?? "Bot",
        displayName: botUser?.displayName ?? "Bot",
        avatarUrl: null as string | null,
        isBot: true,
      };

      broadcastToChannel(channelId, "message:new", {
        ...newMessage,
        author,
      });

      analytics.capture(authorId, "bot:response_sent", {
        serverId,
        channelId,
        botUserId: mentionedId,
        provider: botConfig.provider,
      });
    } catch (err) {
      console.error(`Bot response error (${botConfig.provider}):`, err);
      analytics.capture(authorId, "bot:response_error", {
        serverId,
        channelId,
        botUserId: mentionedId,
        provider: botConfig.provider,
        error: String(err),
      });
    }
  }
}

// Expose for testing
export const _testing = {
  rateLimitMap,
  RATE_LIMIT_MS,
};
