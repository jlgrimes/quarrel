const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful AI assistant in a chat server called Quarrel. Keep responses concise and conversational.";

type AIMessage = {
  role: "user" | "assistant";
  content: string;
};

type AIProviderOptions = {
  maxTokens?: number;
};

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

  switch (provider) {
    case "anthropic":
      return callAnthropic(model, apiKey, messages, system, maxTokens);
    case "openai":
      return callOpenAI(model, apiKey, messages, system, maxTokens);
    case "google":
      return callGoogle(model, apiKey, messages, system, maxTokens);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

async function callAnthropic(
  model: string,
  apiKey: string,
  messages: AIMessage[],
  system: string,
  maxTokens: number
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

async function callOpenAI(
  model: string,
  apiKey: string,
  messages: AIMessage[],
  system: string,
  maxTokens: number
): Promise<string> {
  const openaiMessages = [
    { role: "system" as const, content: system },
    ...messages,
  ];

  const callWithTokenParam = async (
    tokenParam: "max_tokens" | "max_completion_tokens"
  ) => {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        [tokenParam]: maxTokens,
        messages: openaiMessages,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      return { ok: false as const, status: res.status, errorText: text };
    }

    const data = JSON.parse(text);
    return { ok: true as const, data };
  };

  // Newer OpenAI models (e.g. GPT-5 family) require max_completion_tokens.
  const first = await callWithTokenParam("max_completion_tokens");
  if (first.ok) {
    return first.data.choices?.[0]?.message?.content ?? "";
  }

  // Backward compatibility for models that still require max_tokens.
  const lowerErr = first.errorText.toLowerCase();
  const shouldFallback =
    lowerErr.includes("unsupported parameter") &&
    lowerErr.includes("max_completion_tokens");

  if (shouldFallback) {
    const second = await callWithTokenParam("max_tokens");
    if (second.ok) {
      return second.data.choices?.[0]?.message?.content ?? "";
    }
    throw new Error(`OpenAI API error (${second.status}): ${second.errorText}`);
  }

  throw new Error(`OpenAI API error (${first.status}): ${first.errorText}`);
}

async function callGoogle(
  model: string,
  apiKey: string,
  messages: AIMessage[],
  system: string,
  maxTokens: number
): Promise<string> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google AI API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
