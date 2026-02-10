import { createMiddleware } from "hono/factory";
import { RateLimiterMemory } from "rate-limiter-flexible";

const globalLimiter = new RateLimiterMemory({
  points: 100,
  duration: 60,
});

const authLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60,
});

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export const globalRateLimit = createMiddleware(async (c, next) => {
  const key = getClientIp(c);
  try {
    await globalLimiter.consume(key);
    await next();
  } catch (rlRes: any) {
    const retryAfter = Math.ceil(rlRes.msBeforeNext / 1000) || 1;
    c.header("Retry-After", String(retryAfter));
    return c.json({ error: "Too many requests, please try again later" }, 429);
  }
});

export const authRateLimit = createMiddleware(async (c, next) => {
  const key = getClientIp(c);
  try {
    await authLimiter.consume(key);
    await next();
  } catch (rlRes: any) {
    const retryAfter = Math.ceil(rlRes.msBeforeNext / 1000) || 1;
    c.header("Retry-After", String(retryAfter));
    return c.json({ error: "Too many requests, please try again later" }, 429);
  }
});

export async function resetRateLimiters() {
  await globalLimiter.delete("unknown");
  await authLimiter.delete("unknown");
}
