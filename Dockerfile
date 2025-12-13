# =============================================================================
# Fairfield Nostr - Single Container Deployment
# =============================================================================
# Combines SvelteKit static site + strfry Nostr relay
# Designed for cloudflared tunnel (HTTP -> HTTPS)
# =============================================================================

# ===========================================
# Stage 1: Build SvelteKit Application
# ===========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (for caching)
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build the static site (no base path for root deployment)
ENV NODE_ENV=production
RUN npm run build

# ===========================================
# Stage 2: Build strfry Nostr Relay
# ===========================================
FROM alpine:3.19 AS relay-builder

RUN apk add --no-cache \
    git \
    build-base \
    cmake \
    openssl-dev \
    zlib-dev \
    libuv-dev \
    lmdb-dev \
    flatbuffers-dev \
    linux-headers

WORKDIR /build

# Clone and build strfry
RUN git clone https://github.com/hoytech/strfry.git && \
    cd strfry && \
    git submodule update --init && \
    make setup-golpe && \
    make -j$(nproc)

# ===========================================
# Stage 3: Production Runtime
# ===========================================
FROM alpine:3.19 AS production

# Install runtime dependencies
RUN apk add --no-cache \
    nginx \
    supervisor \
    openssl \
    zlib \
    libuv \
    lmdb \
    curl \
    ca-certificates

# Create necessary directories
RUN mkdir -p /var/www/html \
    /app/strfry-db \
    /app/plugins \
    /var/log/nginx \
    /var/log/supervisor \
    /run/nginx

# Copy built website from builder stage
COPY --from=builder /app/build /var/www/html

# Copy strfry binary from relay builder
COPY --from=relay-builder /build/strfry/strfry /usr/local/bin/strfry

# Copy configuration files
COPY relay/strfry.conf /etc/strfry/strfry.conf
COPY relay/whitelist.json /etc/strfry/whitelist.json
COPY nginx.conf /etc/nginx/nginx.conf

# Create auth-whitelist plugin for strfry
RUN cat > /app/plugins/auth-whitelist.js << 'EOF'
// NIP-42 Authentication Plugin for strfry
// Allows all authenticated users to write

const fs = require('fs');

// Load whitelist (optional - for extra restrictions)
let whitelist = [];
try {
    whitelist = JSON.parse(fs.readFileSync('/etc/strfry/whitelist.json', 'utf8')).pubkeys || [];
} catch (e) {
    console.error('Whitelist not found, allowing all authenticated users');
}

module.exports = {
    name: 'auth-whitelist',
    description: 'Requires NIP-42 authentication',

    async event(event, relay) {
        // For private relay - require authentication
        if (!relay.authed) {
            return { reject: 'auth-required: please authenticate' };
        }

        // If whitelist is defined and not empty, check membership
        if (whitelist.length > 0 && !whitelist.includes(relay.authedPubkey)) {
            return { reject: 'blocked: not on whitelist' };
        }

        return { accept: true };
    }
};
EOF

# Create supervisord configuration
RUN cat > /etc/supervisord.conf << 'EOF'
[supervisord]
nodaemon=true
logfile=/var/log/supervisor/supervisord.log
pidfile=/var/run/supervisord.pid
childlogdir=/var/log/supervisor
user=root

[program:nginx]
command=/usr/sbin/nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/var/log/nginx/access.log
stderr_logfile=/var/log/nginx/error.log
priority=10

[program:strfry]
command=/usr/local/bin/strfry --config=/etc/strfry/strfry.conf relay
autostart=true
autorestart=true
stdout_logfile=/var/log/supervisor/strfry.log
stderr_logfile=/var/log/supervisor/strfry_error.log
priority=20

[eventlistener:exit]
command=/bin/sh -c "kill -SIGQUIT $(cat /var/run/supervisord.pid)"
events=PROCESS_STATE_FATAL,PROCESS_STATE_EXITED
EOF

# Create health check script
RUN cat > /usr/local/bin/healthcheck.sh << 'EOF'
#!/bin/sh
# Check nginx
curl -sf http://localhost/health || exit 1
# Check strfry WebSocket (basic TCP check)
nc -z localhost 7777 || exit 1
exit 0
EOF
RUN chmod +x /usr/local/bin/healthcheck.sh

# Create entrypoint script
RUN cat > /entrypoint.sh << 'EOF'
#!/bin/sh
set -e

# Initialize strfry database if needed
if [ ! -f /app/strfry-db/data.mdb ]; then
    echo "Initializing strfry database..."
    mkdir -p /app/strfry-db
fi

# Start supervisor
exec /usr/bin/supervisord -c /etc/supervisord.conf
EOF
RUN chmod +x /entrypoint.sh

# Expose single port (nginx handles both web and relay proxying)
EXPOSE 80

# Volume for persistent relay data
VOLUME ["/app/strfry-db"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh

# Run entrypoint
ENTRYPOINT ["/entrypoint.sh"]
