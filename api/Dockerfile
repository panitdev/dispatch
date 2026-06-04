# syntax=docker/dockerfile:1.7

FROM rust:1-trixie AS chef
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        clang \
        libpq-dev \
        libssl-dev \
        pkg-config \
    && rm -rf /var/lib/apt/lists/* \
    && cargo install cargo-chef --locked

FROM oven/bun:1-debian AS ui-builder
WORKDIR /app/ui

COPY ui/package.json ui/bun.lock ./

RUN --mount=type=cache,id=dispatch-ui-bun-install,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile

COPY ui .

RUN bun run build

FROM chef AS planner

COPY Cargo.toml Cargo.lock ./
COPY api/Cargo.toml api/Cargo.toml
COPY crates/issue-body-markdown/Cargo.toml crates/issue-body-markdown/Cargo.toml

RUN mkdir -p api/src \
    && printf 'fn main() {}\n' > api/src/main.rs \
    && mkdir -p crates/issue-body-markdown/src \
    && printf '' > crates/issue-body-markdown/src/lib.rs

RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS cacher

COPY --from=planner /app/recipe.json recipe.json

RUN --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo chef cook --release --locked --recipe-path recipe.json

FROM cacher AS builder

COPY Cargo.toml Cargo.lock ./
COPY api ./api
COPY crates ./crates

RUN --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release --locked -p api \
    && cp target/release/api /usr/local/bin/dispatch

FROM debian:trixie-slim AS runtime
WORKDIR /app

ENV RUST_LOG=info
ENV API_PORT=3000
ENV FRONTEND_DIST_DIR=/app/dist

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 api \
    && useradd --system --uid 1001 --gid api --home-dir /app api

COPY --from=builder /usr/local/bin/dispatch /usr/local/bin/dispatch
COPY --from=ui-builder /app/ui/dist /app/dist

USER api

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS http://127.0.0.1:3000/health >/dev/null || exit 1

CMD ["/usr/local/bin/dispatch"]
