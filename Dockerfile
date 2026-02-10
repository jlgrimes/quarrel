FROM oven/bun:1 AS builder
WORKDIR /app

ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

COPY . .
RUN bun install
RUN cd apps/web && bun run build

FROM oven/bun:1
WORKDIR /app
RUN bun add serve
COPY --from=builder /app/apps/web/dist ./dist
EXPOSE 3000
CMD ["bunx", "serve", "dist", "-s", "-l", "3000"]
