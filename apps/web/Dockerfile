# Build context is the repository root (npm workspaces share one lockfile).
FROM node:24.22.3-bookworm-slim AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @plp/web
COPY apps/web apps/web
RUN npm run build --workspace @plp/web

FROM node:24.22.3-bookworm-slim
WORKDIR /repo
# HOSTNAME must be set: Docker sets it to the container ID, and Next binds to it.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
