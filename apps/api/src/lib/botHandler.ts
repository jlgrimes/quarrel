import { db, users, messages, serverBots } from "@quarrel/db";
import { eq, and, desc } from "drizzle-orm";
import { callAIProvider } from "./aiProviders";
import { broadcastToChannel } from "../ws";
import { analytics } from "./analytics";

const MENTION_REGEX = /<@([a-zA-Z0-9-]+)>/g;
const PLAIN_MENTION_REGEX = /(^|\s)@([a-zA-Z0-9_]{2,32})\b/g;

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
  const mentionedIds = new Set<string>();
  const mentionedNames = new Set<string>();

  // Parse explicit ID mentions from content: <@user-id>
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_REGEX);
  while ((match = regex.exec(content)) !== null) {
    mentionedIds.add(match[1]);
  }

  // Parse plain mentions from content: @username
  const plainRegex = new RegExp(PLAIN_MENTION_REGEX);
  while ((match = plainRegex.exec(content)) !== null) {
    const name = match[2]?.toLowerCase();
    if (!name || name === "everyone" || name === "here") continue;
    mentionedNames.add(name);
  }

  if (mentionedIds.size === 0 && mentionedNames.size === 0) return;

  const serverBotRows = await db
    .select({
      id: serverBots.id,
      botUserId: serverBots.botUserId,
      provider: serverBots.provider,
      model: serverBots.model,
      apiKey: serverBots.apiKey,
      systemPrompt: serverBots.systemPrompt,
      username: users.username,
      displayName: users.displayName,
    })
    .from(serverBots)
    .innerJoin(users, eq(serverBots.botUserId, users.id))
    .where(
      and(
        eq(serverBots.serverId, serverId),
        eq(serverBots.enabled, true)
      )
    );

  if (serverBotRows.length === 0) return;

  const botConfigById = new Map(serverBotRows.map((row) => [row.botUserId, row]));
  const botsToRespond = new Set<string>();

  // Match <@id> mentions
  for (const mentionedId of mentionedIds) {
    if (botConfigById.has(mentionedId)) {
      botsToRespond.add(mentionedId);
    }
  }

  // Match @username / @displayname mentions
  for (const row of serverBotRows) {
    const username = row.username.toLowerCase();
    const displayName = row.displayName.toLowerCase();
    if (mentionedNames.has(username) || mentionedNames.has(displayName)) {
      botsToRespond.add(row.botUserId);
    }
  }

  if (botsToRespond.size === 0) return;

  for (const mentionedId of botsToRespond) {
    const botConfig = botConfigById.get(mentionedId);
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
    broadcastToChannel(channelId, "typing:update", {
      userId: mentionedId,
      username: botConfig.displayName ?? botConfig.username ?? "Bot",
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
        username: botConfig.username ?? "Bot",
        displayName: botConfig.displayName ?? "Bot",
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
