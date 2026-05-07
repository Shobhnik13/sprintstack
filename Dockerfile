FROM oven/bun:1-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production

FROM base AS build
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile
COPY . .

FROM base AS release
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/server.ts ./
COPY --from=build /app/controllers ./controllers
COPY --from=build /app/routes ./routes
COPY --from=build /app/services ./services
COPY --from=build /app/middleware ./middleware
COPY --from=build /app/workers ./workers
COPY --from=build /app/ws ./ws
COPY --from=build /app/utils ./utils
COPY --from=build /app/types ./types
COPY --from=build /app/db ./db
COPY --from=build /app/package.json ./
COPY --from=build /app/drizzle.config.ts ./
COPY --from=build /app/tsconfig.json ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "server.ts"]
