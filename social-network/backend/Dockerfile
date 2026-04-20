# Build stage
FROM golang:1.21-alpine AS builder
RUN apk add --no-cache gcc musl-dev sqlite-dev

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -o server ./server.go

# Final stage
FROM alpine:3.19
RUN apk add --no-cache sqlite-libs ca-certificates wget

WORKDIR /app
COPY --from=builder /app/server .
COPY --from=builder /app/pkg/db/migrations ./pkg/db/migrations

RUN mkdir -p /app/data /app/uploads

EXPOSE 8080
CMD ["./server"]
