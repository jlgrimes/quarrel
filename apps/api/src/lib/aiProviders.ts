const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful AI assistant in a chat server called Quarrel. Keep responses concise and conversational.";

type AIMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function callAIProvider(
  provider: string,
  model: string,
  apiKey: string,
  messages: AIMessage[],
  systemPrompt?: string | null
): Promise<string> {
  const system = systemPrompt || DEFAULT_SYSTEM_PROMPT;

  switch (provider) {
    case "anthropic":
      return callAnthropic(model, apiKey, messages, system);
    case "openai":
      return callOpenAI(model, apiKey, messages, system);
    case "google":
      return callGoogle(model, apiKey, messages, system);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

async function callAnthropic(
  model: string,
  apiKey: string,
  messages: AIMessage[],
  system: string
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
      max_tokens: 1024,
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
  system: string
): Promise<string> {
  const openaiMessages = [
    { role: "system" as const, content: system },
    ...messages,
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: openaiMessages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGoogle(
  model: string,
  apiKey: string,
  messages: AIMessage[],
  system: string
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
