FROM oven/bun:1 AS builder
WORKDIR /app
COPY . .
RUN bun install
RUN cd apps/web && bun run build

FROM oven/bun:1
WORKDIR /app
RUN bun add serve
COPY --from=builder /app/apps/web/dist ./dist
EXPOSE 3000
CMD ["bunx", "serve", "dist", "-s", "-l", "3000"]
