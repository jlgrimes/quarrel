import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import { Hono } from "hono";
import { setupDatabase, clearDatabase, analyticsMock } from "./helpers";

// Import errorHandler after mocks are set up in helpers
const { errorHandler, captureException } = await import(
  "../middleware/errorHandler"
);

let app: Hono;

beforeAll(async () => {
  await setupDatabase();
});

beforeEach(async () => {
  await clearDatabase();
  analyticsMock.clear();

  app = new Hono();
  app.onError(errorHandler);
});

describe("errorHandler middleware", () => {
  test("returns 500 with generic error message", async () => {
    app.get("/throw", () => {
      throw new Error("something broke");
    });

    const res = await app.request("/throw");
    expect(res.status).toBe(500);
    const data = (await res.json()) as any;
    expect(data.error).toBe("Internal server error");
  });

  test("captures $exception event with error details", async () => {
    app.get("/throw", () => {
      throw new Error("something broke");
    });

    await app.request("/throw");

    const exceptionEvents = analyticsMock.events.filter(
      (e) => e.event === "$exception"
    );
    expect(exceptionEvents.length).toBe(1);

    const props = exceptionEvents[0].properties!;
    expect(props.$exception_message).toBe("something broke");
    expect(props.$exception_type).toBe("Error");
    expect(props.$exception_stack_trace_raw).toBeDefined();
    expect(props.method).toBe("GET");
    expect(props.path).toBe("/throw");
  });

  test("captures stack trace in $exception_stack_trace_raw", async () => {
    app.get("/throw", () => {
      throw new Error("with stack");
    });

    await app.request("/throw");

    const props = analyticsMock.events[0].properties!;
    expect(props.$exception_stack_trace_raw).toContain("with stack");
  });

  test("uses anonymous distinctId when none provided", async () => {
    app.get("/throw-anon", () => {
      throw new Error("anon error");
    });

    await app.request("/throw-anon");

    expect(analyticsMock.events[0].distinctId).toBe("anonymous");
  });
});

describe("captureException", () => {
  test("uses provided distinctId", async () => {
    app.get("/manual", (c) => {
      try {
        throw new Error("manual error");
      } catch (err) {
        captureException(err, c, { distinctId: "user-123" });
        return c.json({ ok: true });
      }
    });

    await app.request("/manual");

    expect(analyticsMock.events.length).toBe(1);
    expect(analyticsMock.events[0].distinctId).toBe("user-123");
    expect(analyticsMock.events[0].properties?.$exception_message).toBe(
      "manual error"
    );
  });

  test("includes extra properties", async () => {
    app.get("/extra", (c) => {
      try {
        throw new Error("with extras");
      } catch (err) {
        captureException(err, c, {
          distinctId: "user-456",
          properties: { endpoint: "avatar_presign" },
        });
        return c.json({ ok: true });
      }
    });

    await app.request("/extra");

    const props = analyticsMock.events[0].properties!;
    expect(props.endpoint).toBe("avatar_presign");
    expect(props.$exception_message).toBe("with extras");
  });
});
