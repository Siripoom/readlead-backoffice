# Stage 1: deps — install all dependencies (including prisma generate via postinstall)
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci

# Stage 2: builder — build Next.js app
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/lib/generated ./lib/generated
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Compile prisma config to JS so runner can load it without a TypeScript runtime
RUN node_modules/.bin/esbuild \
  prisma.config.ts \
  --platform=node \
  --target=node22 \
  --outfile=prisma.config.js

# Stage 3: runner — minimal production image
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The standalone output only contains dependencies traced by the Next.js app.
# Copy the lockfile-installed dependency tree so the Prisma CLI used at startup
# also has all of its transitive dependencies (for example @prisma/debug).
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Prisma CLI inputs for migrate deploy at startup
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/lib/generated ./lib/generated
COPY --from=builder --chown=nextjs:nodejs /app/lib/password.ts ./lib/password.ts

# prisma.config.js is required by prisma migrate deploy to find DATABASE_URL
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.js ./

COPY --chown=nextjs:nodejs entrypoint.sh ./
RUN chmod +x entrypoint.sh

USER nextjs
EXPOSE 3000

CMD ["sh", "entrypoint.sh"]
