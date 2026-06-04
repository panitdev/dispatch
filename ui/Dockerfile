# syntax=docker/dockerfile:1.7

FROM oven/bun:1-debian AS deps
WORKDIR /app

COPY package.json bun.lock ./

RUN --mount=type=cache,id=dispatch-ui-bun-install,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile

FROM deps AS builder
WORKDIR /app

ARG GIT_COMMIT_HASH=unknown

COPY . .

RUN VITE_COMMIT_HASH=$GIT_COMMIT_HASH bun run build

FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:80/ >/dev/null || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
