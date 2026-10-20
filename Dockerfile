FROM golang:1.27.3-alpine AS backend
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/office-server ./cmd/server

FROM backend AS backend-test
RUN go test ./...

FROM oven/bun:1.4.0-alpine AS web
WORKDIR /src
COPY package.json bun.lock bunfig.toml tsconfig.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY packages/model/package.json packages/model/package.json
COPY packages/collaboration/package.json packages/collaboration/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/spreadsheet/package.json packages/spreadsheet/package.json
RUN bun install --frozen-lockfile --ignore-scripts
COPY apps/web/ apps/web/
COPY packages/ packages/
RUN bun run build:web

FROM web AS frontend-test
COPY tests/ tests/
COPY scripts/ scripts/
COPY apps/desktop/ apps/desktop/
RUN bun run typecheck && bun test

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S -g 10001 office \
    && adduser -S -D -H -u 10001 -G office office \
    && mkdir /data && chown office:office /data
COPY --from=backend /out/office-server /usr/local/bin/office-server
COPY --from=web /src/apps/web/dist /app/web
USER 10001:10001
VOLUME ["/data"]
EXPOSE 4317
ENTRYPOINT ["/usr/local/bin/office-server"]
CMD ["-listen", "0.0.0.0:4317", "-data", "/data", "-web", "/app/web"]
