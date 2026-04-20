# Build stage
FROM node:20-alpine AS builder

ARG BACKEND_URL=http://backend:8080
ENV BACKEND_URL=$BACKEND_URL

WORKDIR /app
COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Final stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
