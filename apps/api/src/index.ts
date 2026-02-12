import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth";
import { serverRoutes } from "./routes/servers";
import { channelRoutes } from "./routes/channels";
import { messageRoutes } from "./routes/messages";
import { memberRoutes } from "./routes/members";
import { friendRoutes } from "./routes/friends";
import { dmRoutes } from "./routes/dms";
import { userRoutes } from "./routes/users";
import { roleRoutes } from "./routes/roles";
import { banRoutes } from "./routes/bans";
import { embedRoutes } from "./routes/embeds";
import { threadRoutes } from "./routes/threads";
import { inviteRoutes } from "./routes/invites";
import { auditLogRoutes } from "./routes/auditLog";
import { timeoutRoutes } from "./routes/timeouts";
import { websocketHandler, authenticateWS } from "./ws";
import { globalRateLimit } from "./middleware/rateLimit";
import { errorHandler } from "./middleware/errorHandler";
import { analytics } from "./lib/analytics";
import { seedBots } from "./lib/seedBots";
import { botRoutes } from "./routes/bots";

const app = new Hono();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://quarrel.app",
      "https://www.quarrel.app",
      "tauri://localhost",
      "https://tauri.localhost",
    ],
    credentials: true,
  })
);
app.use(logger());
app.use(secureHeaders());
app.use(globalRateLimit);
app.onError(errorHandler);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Routes
app.route("/auth", authRoutes);
app.route("/servers", serverRoutes);
app.route("/", channelRoutes);
app.route("/", messageRoutes);
app.route("/", memberRoutes);
app.route("/friends", friendRoutes);
app.route("/dms", dmRoutes);
app.route("/users", userRoutes);
app.route("/", roleRoutes);
app.route("/", banRoutes);
app.route("/", embedRoutes);
app.route("/", threadRoutes);
app.route("/", inviteRoutes);
app.route("/", auditLogRoutes);
app.route("/", timeoutRoutes);
app.route("/", botRoutes);

const port = parseInt(process.env.PORT || "3001");

const server = Bun.serve({
  port,
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      // Require token at HTTP upgrade phase; reject immediately without one
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response("Authentication required", { status: 401 });
      }
      // Pass token to WebSocket open handler for async validation
      const upgraded = server.upgrade(req, {
        data: {
          userId: "",
          token,
          subscribedChannels: new Set<string>(),
          subscribedServers: new Set<string>(),
        },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    return app.fetch(req);
  },
  websocket: websocketHandler,
});

const shutdown = async () => {
  await analytics.shutdown();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

seedBots().catch((err) => console.error("Failed to seed bots:", err));

console.log(`Quarrel API running on http://localhost:${server.port}`);
