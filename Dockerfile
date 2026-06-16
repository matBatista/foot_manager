# Production build — context is the repo root.
# Local: docker build -t brassfoot-api .
# Fly.io: fly deploy (uses fly.toml at repo root)

# ── Build stage ────────────────────────────────────────────────
FROM golang:1.25-alpine AS builder
WORKDIR /app

COPY api/go.mod api/go.sum ./
RUN go mod download

COPY api/ .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/server ./cmd/server

# ── Run stage ─────────────────────────────────────────────────
FROM alpine:3.21
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /bin/server ./server
EXPOSE 8080
CMD ["./server"]
