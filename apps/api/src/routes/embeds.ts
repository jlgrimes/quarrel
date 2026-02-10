import { Hono } from "hono";
import { authMiddleware, type AuthEnv } from "../middleware/auth";
import { fetchUrlMetadata } from "../lib/urlMetadata";

export const embedRoutes = new Hono<AuthEnv>();

embedRoutes.use(authMiddleware);

const URL_REGEX = /^https?:\/\//i;

embedRoutes.post("/embeds/metadata", async (c) => {
  const body = await c.req.json();
  const { url } = body;

  if (!url || typeof url !== "string") {
    return c.json({ error: "URL is required" }, 400);
  }

  if (!URL_REGEX.test(url)) {
    return c.json({ error: "Invalid URL: must start with http:// or https://" }, 400);
  }

  // Block private/internal IPs
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname === "::1" ||
      hostname.endsWith(".local")
    ) {
      return c.json({ error: "Private URLs are not allowed" }, 400);
    }
  } catch {
    return c.json({ error: "Invalid URL" }, 400);
  }

  try {
    const metadata = await fetchUrlMetadata(url);
    return c.json({ metadata });
  } catch (err) {
    return c.json({ metadata: { url, title: null, description: null, image: null, siteName: null, type: null, favicon: null } });
  }
});
