# syntax=docker/dockerfile:1.7
#
# THE BUILD CONTEXT IS THE REPO ROOT, not apps/web -- same reason as
# apps/api/Dockerfile: pnpm-lock.yaml and pnpm-workspace.yaml live there and
# COPY cannot climb above the context.
#
# Stages: base -> deps -> build -> runtime, plus `dev` off deps.

# ---------------------------------------------------------------------------
# base
# ---------------------------------------------------------------------------
FROM node:20-alpine AS base

# COREPACK_ENABLE_DOWNLOAD_PROMPT: a confirmation prompt in a non-interactive
# build hangs until it times out.
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

WORKDIR /repo

# ---------------------------------------------------------------------------
# deps
# ---------------------------------------------------------------------------
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Both manifests: --frozen-lockfile checks the lockfile against every workspace
# package and aborts if one is missing, filter or no filter.
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter web...

# ---------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------
FROM deps AS build

# EVERY NEXT_PUBLIC_* VALUE IS BAKED INTO THE BUNDLE HERE, not read at boot.
# Setting them only under `environment:` in compose leaves the build-time value
# in the JavaScript the browser downloads, and every API call goes to whatever
# was compiled in.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL

# JWT_SECRET is deliberately NOT a build arg, which is worth stating because the
# opposite is the usual assumption for anything src/middleware.ts touches.
# Checked against a real build of this app: Next leaves `process.env.JWT_SECRET`
# as a runtime lookup in .next/server/src/middleware.js and captures nothing in
# middleware-manifest.json's `env` map -- the Edge sandbox reads it from the
# server process. So it arrives through env_file at run time and never enters
# this image's layer history. Only the NEXT_PUBLIC_* pair above is baked in.

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_OUTPUT=standalone

# The whole app directory: src, next.config.mjs, postcss.config.mjs, tsconfig.
# node_modules and .next are excluded by the root .dockerignore, so this cannot
# clobber the install from the deps stage.
COPY apps/web/ apps/web/

RUN pnpm --filter web build

# ---------------------------------------------------------------------------
# dev -- next dev against a bind-mounted source tree
# ---------------------------------------------------------------------------
# Used by docker-compose.override.yml. NEXT_OUTPUT is deliberately unset here:
# `next dev` ignores standalone output, and the override mounts ./apps/web over
# this path anyway.
FROM deps AS dev

ENV NODE_ENV=development

EXPOSE 3000
CMD ["pnpm", "--filter", "web", "dev"]

# ---------------------------------------------------------------------------
# runtime -- the standalone server only
# ---------------------------------------------------------------------------
FROM base AS runtime

# HOSTNAME: Next's standalone server binds it, and a default of localhost inside
# a container means nothing outside can reach the process. The port mapping then
# looks broken while the server logs that it started fine.
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# outputFileTracingRoot is the repo root (see next.config.mjs), so the
# standalone tree mirrors the workspace: server.js sits at apps/web/server.js
# and the traced node_modules at the top.
#
# Owned by `node` because the server writes into .next/cache at runtime.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./

# Static assets are NOT part of the traced output and have to come across
# separately, or the app serves its HTML with every stylesheet and chunk 404ing.
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static

# There is no apps/web/public directory today. Add a COPY for it here if one
# appears -- standalone output does not include it either.

USER node
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
