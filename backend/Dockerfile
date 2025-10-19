FROM rust:1-slim-bullseye AS base

RUN apt-get update && apt-get upgrade -y --no-install-recommends && \
    apt-get install curl build-essential libssl-dev pkg-config -y --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

RUN rustup update && rustup default stable

RUN cargo install sccache --version ^0.7 && \
    cargo install cargo-chef --version ^0.1.5
ENV RUSTC_WRAPPER=sccache SCCACHE_DIR=/sccache

FROM base AS planner
WORKDIR /app
COPY . .
RUN --mount=type=cache,target=$SCCACHE_DIR,sharing=locked \
    cargo chef prepare --recipe-path recipe.json

FROM base AS builder
WORKDIR /app
COPY --from=planner /app/recipe.json recipe.json
RUN --mount=type=cache,target=$SCCACHE_DIR,sharing=locked \
    cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN --mount=type=cache,target=$SCCACHE_DIR,sharing=locked \
    cargo build --release

# Runtime stage
FROM rust:1-slim-bullseye AS runner

COPY --from=builder /app/target/release/api-build /opt/api-build
COPY --from=builder /app/config /opt/config

# Expose port
EXPOSE 6500

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:6500/api/health || exit 1

WORKDIR /opt
CMD ["./api-build"]
