# Production image for the Next.js dashboard (apps/web), served with `next start`.
#   docker build -f docker/web.Dockerfile \
#     --build-arg NEXT_PUBLIC_ANALYST_URL=https://analyst.example.com \
#     --build-arg NEXT_PUBLIC_FLOW_ANALYST_URL=https://flow.example.com \
#     --build-arg NEXT_PUBLIC_EXECUTION_URL=https://execution.example.com \
#     -t elitr-web .
# NEXT_PUBLIC_* are inlined into the browser bundle at BUILD time — changing them needs a rebuild.
# (A smaller image is possible with `output: "standalone"` in apps/web/next.config.ts; see docs/deploy.md.)

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS build
ARG NEXT_PUBLIC_ANALYST_URL=http://localhost:4001
ARG NEXT_PUBLIC_FLOW_ANALYST_URL=http://localhost:4003
ARG NEXT_PUBLIC_EXECUTION_URL=http://localhost:4002
ENV NEXT_PUBLIC_ANALYST_URL=${NEXT_PUBLIC_ANALYST_URL} \
    NEXT_PUBLIC_FLOW_ANALYST_URL=${NEXT_PUBLIC_FLOW_ANALYST_URL} \
    NEXT_PUBLIC_EXECUTION_URL=${NEXT_PUBLIC_EXECUTION_URL}
COPY . .
RUN pnpm install --frozen-lockfile --filter "@elitr/web..."
RUN pnpm --filter "@elitr/web..." build
RUN find . -name node_modules -type d -prune -exec rm -rf {} + && \
    pnpm install --frozen-lockfile --prod --offline --filter "@elitr/web..." && \
    rm -rf apps/web/.next/cache apps/analyst-agent apps/execution-agent

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app/apps/web
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
