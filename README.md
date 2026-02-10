# Quarrel

A real-time chat and server communication platform built with modern web technologies.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Zustand, TanStack Query |
| **Backend** | Bun, Hono, WebSockets |
| **Database** | Turso (LibSQL), Drizzle ORM |
| **Storage** | Cloudflare R2 / S3 |
| **Analytics** | PostHog |
| **Monorepo** | Bun Workspaces, Turborepo |

## Features

- **Servers & Channels** — Create servers with invite codes, text/voice/category channels
- **Real-time Messaging** — WebSocket-powered chat with typing indicators, reactions, pins, replies, and attachments
- **Direct Messages** — 1-on-1 and group conversations
- **Friends System** — Send/accept/block friend requests
- **Voice Channels** — Join voice channels with mute/deafen controls
- **Roles & Permissions** — Custom roles with bitfield-based permissions
- **User Profiles** — Avatars (R2 upload), display names, status, custom status
- **Mobile Responsive** — Optimized sidebar navigation for small screens

## Project Structure

```
quarrel/
├── apps/
│   ├── api/          # Bun + Hono backend (port 3001)
│   └── web/          # React SPA (port 5173 dev / 3000 prod)
├── packages/
│   ├── db/           # Drizzle ORM schema & Turso client
│   └── shared/       # Zod validators, types, constants
├── turbo.json
└── package.json
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.2+
- [Turso](https://turso.tech) database
- Cloudflare R2 or S3 bucket (for avatars)

### Install

```bash
bun install
```

### Environment Variables

**`packages/db/.env`**
```
DATABASE_URL="libsql://your-db.turso.io"
DATABASE_AUTH_TOKEN="your-token"
```

**`apps/api/.env`**
```
DATABASE_URL="libsql://your-db.turso.io"
DATABASE_AUTH_TOKEN="your-token"
PORT=3001
```

**`apps/web/.env`**
```
VITE_API_URL="/api"
VITE_POSTHOG_KEY="phc_..."
VITE_POSTHOG_HOST="https://us.i.posthog.com"
```

### Database Setup

```bash
bun run db:push
```

### Development

```bash
bun run dev
```

This starts both the API server (`localhost:3001`) and the web app (`localhost:5173`) with hot reload. The Vite dev server proxies `/api` and `/ws` to the backend.

## Testing

```bash
# API integration tests (bun:test + in-memory SQLite)
cd apps/api && bun test

# Web component tests (vitest + testing-library)
cd apps/web && npx vitest run

# E2E tests (Playwright)
cd apps/web && npx playwright test
```

## Build

```bash
bun run build
```

## License

MIT
