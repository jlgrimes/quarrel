import { PostHog } from "posthog-node";

const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;
const POSTHOG_HOST = process.env.POSTHOG_HOST || "https://us.i.posthog.com";

let client: PostHog | null = null;

if (POSTHOG_API_KEY) {
  client = new PostHog(POSTHOG_API_KEY, { host: POSTHOG_HOST });
} else {
  console.warn("[analytics] POSTHOG_API_KEY not set, server analytics disabled");
}

export const analytics = {
  capture(
    distinctId: string,
    event: string,
    properties?: Record<string, unknown>
  ) {
    if (!client) return;
    client.capture({ distinctId, event, properties });
  },

  async shutdown() {
    if (!client) return;
    await client.shutdown();
  },
};

export function isEnabled() {
  return client !== null;
}
