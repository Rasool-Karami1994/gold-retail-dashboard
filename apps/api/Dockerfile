# syntax=docker/dockerfile:1.7
#
# THE BUILD CONTEXT IS THE REPO ROOT, not apps/api.
#
# pnpm resolves nothing without pnpm-lock.yaml and pnpm-workspace.yaml, and both
# live at the root -- a context of apps/api cannot reach them, since COPY refuses
# to climb above the context. docker-compose.yml sets `context: .` with
# `dockerfile: apps/api/Dockerfile` for that reason; a bare `docker build apps/api`
# will fail on the very first COPY.
#
# Stages: base -> deps -> build -> prod-deps -> runtime, plus `dev` off deps.

# ---------------------------------------------------------------------------
# base -- Node + pnpm, shared by every other stage
# ---------------------------------------------------------------------------
FROM node:20-alpine AS base

# COREPACK_ENABLE_DOWNLOAD_PROMPT: corepack asks for confirmation before
# fetching the pnpm version pinned in package.json, and a prompt in a
# non-interactive build just hangs until it times out.
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable

WORKDIR /repo

# ---------------------------------------------------------------------------
# deps -- manifests only, so editing source doesn't reinstall the world
# ---------------------------------------------------------------------------
FROM base AS deps

# puppeteer-core never downloads a browser, so this is belt and braces: it stops
# any transitive `puppeteer` that appears later from trying, which on Alpine
# fails anyway (no glibc build) after a slow 130 MB fetch.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Every workspace manifest, not just the api one. --frozen-lockfile validates
# the lockfile against all of them and aborts if one is missing, even when the
# filter means its dependencies are never installed.
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter api...

# ---------------------------------------------------------------------------
# fonts -- Vazir TTFs, staged for the system font directory
# ---------------------------------------------------------------------------
# Chromium on Alpine ships no Arabic-script face at all, so anything it renders
# in a fallback font comes out as tofu. The invoice template dodges that by
# inlining apps/api/assets/fonts/*.woff2 as base64 data URIs, which is what
# actually makes invoices render -- this install is the safety net underneath
# it, covering any glyph outside those files and any page rendered without the
# template.
#
# The TTFs come from the `vazir-font` package rather than assets/fonts because
# fontconfig indexes TrueType reliably and woff2 support depends on how FreeType
# was built. Same upstream font, same Farsi-Digits cut.
FROM deps AS fonts

RUN mkdir -p /staged-fonts && \
    cp apps/api/node_modules/vazir-font/dist/Farsi-Digits/Vazir-Regular-FD.ttf \
       apps/api/node_modules/vazir-font/dist/Farsi-Digits/Vazir-Medium-FD.ttf \
       apps/api/node_modules/vazir-font/dist/Farsi-Digits/Vazir-Bold-FD.ttf \
       /staged-fonts/

# ---------------------------------------------------------------------------
# build -- tsc to dist/
# ---------------------------------------------------------------------------
FROM deps AS build

COPY apps/api/tsconfig.json apps/api/
COPY apps/api/src apps/api/src

RUN pnpm --filter api build

# ---------------------------------------------------------------------------
# prod-deps -- the same install with devDependencies dropped
# ---------------------------------------------------------------------------
# Built from `deps` rather than from scratch so the cache mount is already warm.
# pnpm's symlinks into node_modules/.pnpm are relative, which is what lets the
# tree survive a COPY --from into the runtime stage.
FROM deps AS prod-deps

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter api --prod

# ---------------------------------------------------------------------------
# dev -- tsx watch against a bind-mounted source tree
# ---------------------------------------------------------------------------
# Used by docker-compose.override.yml. It keeps devDependencies (tsx lives
# there) and carries no source of its own: the override bind-mounts ./apps/api
# over this path and restores node_modules from the image with an anonymous
# volume.
FROM deps AS dev

RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      fontconfig \
      ttf-freefont \
      ca-certificates \
    && test -x /usr/bin/chromium

COPY --from=fonts /staged-fonts/ /usr/share/fonts/vazir/
RUN fc-cache -f

ENV NODE_ENV=development \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROME_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 4100
CMD ["pnpm", "--filter", "api", "dev"]

# ---------------------------------------------------------------------------
# runtime
# ---------------------------------------------------------------------------
FROM base AS runtime

# chromium + the font stack puppeteer-core needs to render a page. nss, freetype
# and harfbuzz are Chromium's own runtime dependencies; ttf-freefont covers
# Latin, and the Vazir copy below covers Persian.
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      fontconfig \
      ttf-freefont \
      ca-certificates \
      tini \
    && test -x /usr/bin/chromium

COPY --from=fonts /staged-fonts/ /usr/share/fonts/vazir/
RUN fc-cache -f

# CHROME_EXECUTABLE_PATH is the one findChrome() in services/invoice.ts reads,
# and it THROWS if the path does not exist rather than falling back to its
# probe -- which is why the apk layer above asserts the binary is really there.
ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROME_EXECUTABLE_PATH=/usr/bin/chromium

COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY apps/api/package.json ./apps/api/package.json
# The woff2 faces the invoice template inlines. PACKAGE_ROOT in invoice.ts
# resolves from dist/services/ to /repo/apps/api, so this is the path it reads.
COPY apps/api/assets ./apps/api/assets

# INVOICE_STORAGE_DIR defaults to uploads/invoices, relative to the api package
# root. Created here so it exists and is writable before the named volume that
# compose mounts over it inherits the ownership.
RUN mkdir -p /repo/apps/api/uploads/invoices && chown -R node:node /repo/apps/api/uploads

USER node
WORKDIR /repo/apps/api
EXPOSE 4100

# Chromium is a child process and orphans renderers when the parent dies without
# reaping. PID 1 in a container does no reaping by default, so tini does it.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
