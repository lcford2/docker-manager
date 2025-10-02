FROM rust:1-slim-bullseye AS builder

RUN apt-get update && apt-get upgrade -y --no-install-recommends && \
    apt-get install curl build-essential -y --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

RUN rustup update && rustup default stable

COPY . /app
WORKDIR /app

RUN cargo build --release

# Runtime stage
FROM rust:1-slim-bullseye AS runner

COPY --from=builder /app/target/release/api-build /opt/api-build
COPY --from=builder /app/config /opt/config

WORKDIR /opt

# Expose port
EXPOSE 6500

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:6500/api/health || exit 1

CMD ["./api-build"]
