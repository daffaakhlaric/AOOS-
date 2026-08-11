# AAOS API — production image.
#
# Deviates from the spec's literal Dockerfile in one respect: the spec's runner stage only
# copies the workspace ROOT `/app/node_modules`, which is correct for a flat/hoisted
# node_modules layout but NOT for pnpm's default (strict, non-flat) layout — pnpm gives every
# workspace package its OWN `node_modules` (mostly symlinks into the root `.pnpm` store), so
# `apps/aaos-api/node_modules` must also be copied or `node dist/main` cannot resolve
# `@nestjs/*`/`@aos/*`/etc. from `dist/main.js`'s actual location. Build/start commands
# themselves match the spec (`pnpm --filter aaos-api build`, `node dist/main`) — only the
# runner stage's COPY set changed, to actually work under this monorepo's real package manager.
FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN corepack enable pnpm && pnpm install --frozen-lockfile
RUN pnpm --filter aaos-api... build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/aaos-api/node_modules ./apps/aaos-api/node_modules
COPY --from=builder /app/apps/aaos-api/dist ./apps/aaos-api/dist
COPY --from=builder /app/apps/aaos-api/package.json ./apps/aaos-api/package.json
WORKDIR /app/apps/aaos-api
EXPOSE 3000
CMD ["node", "dist/main.js"]
