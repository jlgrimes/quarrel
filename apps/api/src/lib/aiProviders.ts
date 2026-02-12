import { generateText, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful AI assistant in a chat server called Quarrel. Keep responses concise and conversational.";

type AIMessage = {
  role: "user" | "assistant";
  content: string;
};

type AIProviderOptions = {
  maxTokens?: number;
};

type AIStreamHandlers = {
  onDelta?: (delta: string) => void;
};

function getProviderLabel(provider: string): string {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
    case "google":
      return "Google AI";
    default:
      return provider;
  }
}

function getModel(provider: string, model: string, apiKey: string) {
  switch (provider) {
    case "openai": {
      const openai = createOpenAI({ apiKey });
      return openai(model);
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(model);
    }
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(model);
    }
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export async function callAIProvider(
  provider: string,
  model: string,
  apiKey: string,
  messages: AIMessage[],
  systemPrompt?: string | null,
  options?: AIProviderOptions
): Promise<string> {
  const system = systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const maxTokens = options?.maxTokens ?? 1024;
  const providerLabel = getProviderLabel(provider);

  try {
    const { text } = await generateText({
      model: getModel(provider, model, apiKey),
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      maxTokens,
    });
    return text ?? "";
  } catch (err) {
    throw new Error(`${providerLabel} API error: ${String(err)}`);
  }
}

export async function callAIProviderStream(
  provider: string,
  model: string,
  apiKey: string,
  messages: AIMessage[],
  systemPrompt?: string | null,
  options?: AIProviderOptions & AIStreamHandlers
): Promise<string> {
  const system = systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const maxTokens = options?.maxTokens ?? 1024;
  const onDelta = options?.onDelta;
  const providerLabel = getProviderLabel(provider);

  try {
    const result = streamText({
      model: getModel(provider, model, apiKey),
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      maxTokens,
    });

    let fullText = "";
    for await (const delta of result.textStream) {
      if (!delta) continue;
      fullText += delta;
      onDelta?.(delta);
    }

    return fullText;
  } catch (err) {
    throw new Error(`${providerLabel} API error: ${String(err)}`);
  }
}
