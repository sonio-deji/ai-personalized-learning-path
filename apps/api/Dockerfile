# Build context is the repository root (npm workspaces share one lockfile).
FROM node:24.22.3-bookworm-slim AS base
# Prisma's schema engine needs OpenSSL, which the slim image lacks.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

FROM base AS build
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @plp/api
COPY apps/api apps/api
RUN npm run build --workspace @plp/api
RUN npm prune --omit=dev --workspace @plp/api && mkdir -p apps/api/node_modules

FROM base
ENV NODE_ENV=production
COPY --from=build /repo/package.json ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api ./apps/api
WORKDIR /repo/apps/api
USER node
EXPOSE 4000
CMD ["sh", "-c", "/repo/node_modules/.bin/prisma migrate deploy && node dist/prisma/seed.js && exec node dist/src/server.js"]
