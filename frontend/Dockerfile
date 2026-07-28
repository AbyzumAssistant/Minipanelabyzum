# Usa versión específica para reproducibilidad
FROM node:20.11-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm config set fetch-retries 5 || true && \
    npm config set fetch-retry-factor 2 || true && \
    npm config set fetch-retry-mintimeout 20000 || true && \
    npm config set fetch-retry-maxtimeout 120000 || true && \
    npm config set fetch-timeout 300000 || true && \
    for attempt in 1 2 3; do \
      npm ci --no-audit --fund=false --prefer-offline --progress=false && break; \
      if [ "$attempt" -eq 3 ]; then \
        echo "npm ci failed after $attempt attempts"; \
        exit 1; \
      fi; \
      echo "npm ci failed (attempt $attempt), retrying..."; \
      sleep $((attempt * 15)); \
    done

FROM base AS landing-deps
WORKDIR /landing
COPY landing/package.json landing/package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --fund=false --prefer-offline --progress=false || npm install --no-audit --fund=false

FROM base AS landing-builder
WORKDIR /landing
COPY --from=landing-deps /landing/node_modules ./node_modules
COPY landing/ ./
RUN npm run build

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ ./
COPY --from=landing-builder /landing/dist ./public/landing

ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
ARG BACKEND_PROXY_URL="http://127.0.0.1:8091"
ENV BACKEND_PROXY_URL=$BACKEND_PROXY_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 4000
ENV PORT=4000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:4000/api/health', (r) => { let b=''; r.on('data',(c)=>b+=c); r.on('end',()=>process.exit(r.statusCode===200?0:1)); }).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
