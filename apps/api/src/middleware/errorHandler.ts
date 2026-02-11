import type { Context } from "hono";
import { analytics } from "../lib/analytics";

export function captureException(
  err: unknown,
  c: Context,
  extra?: { distinctId?: string; properties?: Record<string, unknown> }
) {
  const error = err instanceof Error ? err : new Error(String(err));
  const distinctId = extra?.distinctId || "anonymous";

  analytics.capture(distinctId, "$exception", {
    $exception_message: error.message,
    $exception_type: error.name,
    $exception_stack_trace_raw: error.stack,
    method: c.req.method,
    path: c.req.path,
    route: c.req.routePath,
    ...extra?.properties,
  });
}

export function errorHandler(err: Error, c: Context) {
  console.error("Unhandled error:", err);

  captureException(err, c);

  return c.json({ error: "Internal server error" }, 500);
}
