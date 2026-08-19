# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable

WORKDIR /repo

FROM base AS deps

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter api...

FROM deps AS fonts

RUN mkdir -p /staged-fonts && \
    cp apps/api/node_modules/vazir-font/dist/Farsi-Digits/Vazir-Regular-FD.ttf \
       apps/api/node_modules/vazir-font/dist/Farsi-Digits/Vazir-Medium-FD.ttf \
       apps/api/node_modules/vazir-font/dist/Farsi-Digits/Vazir-Bold-FD.ttf \
       /staged-fonts/

FROM deps AS build

COPY apps/api/tsconfig.json apps/api/
COPY apps/api/src apps/api/src

RUN pnpm --filter api build

FROM deps AS prod-deps

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter api --prod

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

FROM base AS runtime

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

ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROME_EXECUTABLE_PATH=/usr/bin/chromium

COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/assets ./apps/api/assets

USER node
WORKDIR /repo/apps/api
EXPOSE 4100

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
