FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Create data directory for SQLite database
RUN mkdir -p /data && chown -R node:node /data

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV SQLITE_DATA_DIR=/data

USER node

EXPOSE 8080

CMD ["node", "dist/server.js"]
