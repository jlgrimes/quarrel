import { db, users, messages, serverBots } from "@quarrel/db";
import { eq, and, desc } from "drizzle-orm";
import { callAIProviderStream } from "./aiProviders";
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

function extractProviderReason(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    const maybeJson = trimmed.slice(jsonStart, jsonEnd + 1);
    try {
      const parsed = JSON.parse(maybeJson);
      const reason =
        parsed?.error?.message ??
        parsed?.message ??
        parsed?.candidates?.[0]?.finishReason;
      if (typeof reason === "string" && reason.trim()) {
        return reason.trim();
      }
    } catch {
      // ignore parse errors, fall back below
    }
  }

  const compact = trimmed.replace(/\s+/g, " ");
  if (!compact) return null;
  return compact.slice(0, 160);
}

function buildBotErrorMessage(provider: string, err?: unknown): string {
  const raw = String(err ?? "");
  const lower = raw.toLowerCase();
  const reason = extractProviderReason(raw);

  let hint = "Check API key, model, and provider settings in Server Settings -> AI.";
  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("invalid api key") || lower.includes("invalid_api_key")) {
    hint = "My API key appears invalid. Update it in Server Settings -> AI.";
  } else if (lower.includes("model") && (lower.includes("not found") || lower.includes("does not exist") || lower.includes("unsupported"))) {
    hint = "The configured model looks unavailable. Choose a different model in Server Settings -> AI.";
  } else if (lower.includes("429") || lower.includes("rate limit")) {
    hint = "Provider rate limit reached. Try again in a moment.";
  } else if (lower.includes("credit balance is too low") || lower.includes("insufficient_quota") || lower.includes("billing")) {
    hint = "This provider account has no available credits/billing. Add credits, then try again.";
  }

  let detail = "";
  const statusMatch = raw.match(/\b(4\d{2}|5\d{2})\b/);
  if (statusMatch) {
    detail = ` (HTTP ${statusMatch[1]})`;
  } else if (raw.trim()) {
    const compact = raw.replace(/\s+/g, " ").trim();
    detail = ` (${compact.slice(0, 80)})`;
  }

  const reasonText = reason ? ` Reason: ${reason}` : "";
  return `I couldn't respond right now (${provider} error${detail}). ${hint}${reasonText}`;
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
      avatarUrl: users.avatarUrl,
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
    let streamingMessageId: string | null = null;

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

      const author = {
        id: mentionedId,
        username: botConfig.username ?? "Bot",
        displayName: botConfig.displayName ?? "Bot",
        avatarUrl: botConfig.avatarUrl,
        isBot: true,
      };

      // Insert placeholder bot message so clients can stream incremental content.
      const [streamingMessage] = await db
        .insert(messages)
        .values({
          channelId,
          authorId: mentionedId,
          content: "",
        })
        .returning();
      streamingMessageId = streamingMessage.id;

      broadcastToChannel(channelId, "message:new", {
        ...streamingMessage,
        author,
      });

      let response = "";
      response = await callAIProviderStream(
        botConfig.provider,
        botConfig.model,
        botConfig.apiKey,
        aiMessages,
        botConfig.systemPrompt,
        {
          onDelta: (delta) => {
            if (!delta) return;
            broadcastToChannel(channelId, "message:stream", {
              channelId,
              messageId: streamingMessage.id,
              delta,
            });
          },
        }
      );

      if (!response) {
        const [fallbackMessage] = await db
          .update(messages)
          .set({
            content: buildBotErrorMessage(botConfig.provider),
          })
          .where(eq(messages.id, streamingMessage.id))
          .returning();
        broadcastToChannel(channelId, "message:updated", {
          ...fallbackMessage,
          author,
        });
        continue;
      }

      // Persist final message content and broadcast final canonical state.
      const [updatedMessage] = await db
        .update(messages)
        .set({ content: response })
        .where(eq(messages.id, streamingMessage.id))
        .returning();

      broadcastToChannel(channelId, "message:updated", {
        ...updatedMessage,
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

      const errorAuthor = {
        id: mentionedId,
        username: botConfig.username ?? "Bot",
        displayName: botConfig.displayName ?? "Bot",
        avatarUrl: botConfig.avatarUrl,
        isBot: true,
      };

      const errorContent = buildBotErrorMessage(botConfig.provider, err);
      if (streamingMessageId) {
        const [errorUpdate] = await db
          .update(messages)
          .set({ content: errorContent })
          .where(eq(messages.id, streamingMessageId))
          .returning();

        broadcastToChannel(channelId, "message:updated", {
          ...errorUpdate,
          author: errorAuthor,
        });
      } else {
        const [errorMessage] = await db
          .insert(messages)
          .values({
            channelId,
            authorId: mentionedId,
            content: errorContent,
          })
          .returning();

        broadcastToChannel(channelId, "message:new", {
          ...errorMessage,
          author: errorAuthor,
        });
      }

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
