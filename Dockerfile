# syntax=docker/dockerfile:1
# Multi-stage build producing a small runtime image around the Next.js standalone server.
# See docs/design.md and README.md#docker for usage.

FROM node:22-slim AS deps
WORKDIR /app
# better-sqlite3 needs to compile its native binding when no prebuilt one matches.
RUN apt-get update && apt-get install --no-install-recommends -y python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 dashboard \
  && useradd --system --uid 1001 --gid dashboard dashboard
# The standalone output already has .next/static copied in by the postbuild script that runs
# as part of `npm run build` (see scripts/postbuild.mjs).
COPY --from=builder --chown=dashboard:dashboard /app/.next/standalone ./
USER dashboard
EXPOSE 3000
ENV PORT=3000
# Point TOOLKIT_DATA_DIR (or TOOLKIT_REPOS) at a volume mounted into the container, for
# example: docker run -p 3000:3000 -v "$PWD":/data -e TOOLKIT_DATA_DIR=/data <image>
CMD ["node", "server.js"]
