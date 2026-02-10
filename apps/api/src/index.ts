import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth";
import { serverRoutes } from "./routes/servers";
import { channelRoutes } from "./routes/channels";
import { messageRoutes } from "./routes/messages";
import { memberRoutes } from "./routes/members";
import { friendRoutes } from "./routes/friends";
import { dmRoutes } from "./routes/dms";
import { userRoutes } from "./routes/users";
import { websocketHandler } from "./ws";

const app = new Hono();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);
app.use(logger());

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

const port = parseInt(process.env.PORT || "3001");

const server = Bun.serve({
  port,
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req, {
        data: {
          userId: "",
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

console.log(`Quarrel API running on http://localhost:${server.port}`);
