# ==============================================================================
# Stage 1: Build the Vite frontend
# ==============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Copy source code and build
COPY . .
RUN npm run build

# ==============================================================================
# Stage 2: Build the Rust backend
# ==============================================================================
FROM rust:alpine AS backend-builder
WORKDIR /app

# Install dependencies for sqlx and compilation
RUN apk add --no-cache musl-dev sqlite-dev pkgconfig

# Copy Cargo files and source
COPY Cargo.toml Cargo.lock* ./
COPY src-rust ./src-rust
COPY schema.sql ./

# Build release binary
RUN cargo build --release

# ==============================================================================
# Stage 3: Final runtime image
# ==============================================================================
FROM alpine:3.19
WORKDIR /app

RUN apk add --no-cache sqlite-libs libgcc

# Create directory for sqlite database
RUN mkdir -p /app/data && chown -R 1000:1000 /app/data

# Copy the built backend binary
COPY --from=backend-builder /app/target/release/pastebin-server /app/pastebin-server

# Copy the built frontend static files
COPY --from=frontend-builder /app/dist /app/dist

# Ensure the executable has permissions
RUN chmod +x /app/pastebin-server

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=8788
ENV DATABASE_URL=sqlite://data/pastebin.sqlite
ENV RUST_LOG=info

# Default AUTH_KEY if not provided via docker-compose (should be overridden)
ENV AUTH_KEY=default_secure_key

EXPOSE 8788

# Switch to a non-root user for security
USER 1000:1000

CMD ["/app/pastebin-server"]
