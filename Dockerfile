# Dockerfile for Minimoonoir PWA
# Builds static PWA and serves via nginx
# Note: For full stack with relay, use docker-compose.yml

# ===========================================
# Stage 1: Build PWA
# ===========================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --frozen-lockfile || npm install

COPY . .

ENV NODE_ENV=production
RUN npm run build

# ===========================================
# Stage 2: Production (PWA only)
# ===========================================
FROM nginx:alpine AS production

# Copy built PWA files
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create health check endpoint
RUN echo "OK" > /usr/share/nginx/html/health

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

# Run nginx
CMD ["nginx", "-g", "daemon off;"]
