FROM node:24-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @dscims/shared build

FROM base AS web
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3001
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN pnpm --filter web build
WORKDIR /app/apps/web
ENV NODE_ENV=production
USER node
EXPOSE 3001
CMD ["pnpm", "start"]

FROM base AS api
RUN pnpm --filter api build
WORKDIR /app/apps/api
ENV NODE_ENV=production
USER node
EXPOSE 3006
# Forward-only SQL migrations run first, then the server starts. Hosts with a pre-deploy step can skip the first half.
CMD ["sh", "-c", "node dist/database/migrate-cli.js && node dist/main.js"]
