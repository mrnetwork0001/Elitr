# Production image for a Node agent in this pnpm workspace.
#   docker build -f docker/agent.Dockerfile --build-arg APP=analyst-agent   -t elitr-analyst .
#   docker build -f docker/agent.Dockerfile --build-arg APP=execution-agent -t elitr-execution .
# Build context is the repo root. Secrets are NEVER baked in: pass them at runtime (env_file / platform secrets).
#
# The monorepo layout is kept inside the image (/app/apps/<APP>/dist) because the agents resolve the
# repo root as ../../.. from dist/ and keep their state in <repo>/data - so /app/data is the volume.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# ---- build: full install for the app and its workspace deps, compile TypeScript, then prune to prod deps
FROM base AS build
ARG APP
RUN test -n "$APP" || (echo "--build-arg APP=<analyst-agent|execution-agent> is required" && false)
COPY . .
RUN pnpm install --frozen-lockfile --filter "@elitr/${APP}..."
RUN pnpm --filter "@elitr/${APP}..." build
# Drop dev dependencies (tsx, typescript, @types) and re-link production deps only.
RUN find . -name node_modules -type d -prune -exec rm -rf {} + && \
    pnpm install --frozen-lockfile --prod --offline --filter "@elitr/${APP}..." && \
    find apps -mindepth 1 -maxdepth 1 ! -name "$APP" -exec rm -rf {} +

# ---- runtime
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ARG APP
ARG HEALTH_PORT=4001
# Platforms that mount volumes root-owned (Railway, Fly.io) can build/run with RUNTIME_USER=root:
# the entrypoint then fixes ownership of /app/data and drops to the unprivileged `node` user.
ARG RUNTIME_USER=node
ENV NODE_ENV=production \
    APP=${APP} \
    HEALTH_PORT=${HEALTH_PORT}
WORKDIR /app
COPY --from=build --chown=node:node /app /app
# data/ = persisted state + event logs (mount a volume here); docs/ = runtime DX evidence log target.
RUN mkdir -p /app/data /app/docs && chown node:node /app/data /app/docs && \
    printf '%s\n' '#!/bin/sh' 'set -e' \
      'if [ "$(id -u)" = "0" ]; then' \
      '  chown -R node:node /app/data /app/docs' \
      '  exec setpriv --reuid=node --regid=node --init-groups "$@"' \
      'fi' \
      'exec "$@"' > /usr/local/bin/elitr-entrypoint && chmod 755 /usr/local/bin/elitr-entrypoint
USER ${RUNTIME_USER}
VOLUME ["/app/data"]
EXPOSE 4001 4002 4003
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.HEALTH_PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/local/bin/elitr-entrypoint"]
CMD ["sh", "-c", "exec node apps/${APP}/dist/index.js"]
