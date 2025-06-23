# High Bred Bullies - Production Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Build the application
FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the React frontend
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 hbb

# Copy built application
COPY --from=builder --chown=hbb:nodejs /app/dist ./dist
COPY --from=builder --chown=hbb:nodejs /app/public ./public
COPY --from=deps --chown=hbb:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=hbb:nodejs /app/package.json ./package.json
COPY --from=builder --chown=hbb:nodejs /app/auth-server.cjs ./auth-server.cjs
COPY --from=builder --chown=hbb:nodejs /app/start-server.js ./start-server.js
COPY --from=builder --chown=hbb:nodejs /app/server ./server
COPY --from=builder --chown=hbb:nodejs /app/shared ./shared

# Set proper permissions
RUN chown -R hbb:nodejs /app
USER hbb

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Set environment
ENV NODE_ENV=production
ENV PORT=5000

# Start the application
CMD ["node", "start-server.js"]