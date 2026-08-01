# g-dash

A pnpm workspace with two apps:

| App | Stack | Dev port |
| --- | --- | --- |
| [`apps/web`](apps/web) | Next.js 15 (App Router), React 19, TypeScript, Tailwind v4 | 3000 |
| [`apps/api`](apps/api) | Express 4, TypeScript (ESM), Mongoose | 4000 |

The web app is Persian/RTL by default and self-hosts the Vazir font. Its visual
language is driven by a token set in
[`apps/web/src/app/globals.css`](apps/web/src/app/globals.css) — see
[Design tokens](#design-tokens).

## Requirements

- Node.js 20+ (developed on 24)
- pnpm 9+ (`corepack enable`)
- A MongoDB instance — the bundled `docker-compose.yml` provides one

## Getting started

```bash
pnpm install
```

Create the env files from their templates:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Start MongoDB (skip if you're pointing `MONGODB_URI` at Atlas or an existing server):

```bash
pnpm db:up
```

Run both apps together:

```bash
pnpm dev
```

`concurrently` runs them in one terminal with prefixed, colour-coded output:
web on http://localhost:3000, API on http://localhost:4000. `Ctrl-C` stops both.

To run just one:

```bash
pnpm dev:web
```

```bash
pnpm dev:api
```

## Scripts

Run these from the repo root.

| Script | Does |
| --- | --- |
| `pnpm dev` | Both apps in watch mode, concurrently |
| `pnpm dev:web` / `pnpm dev:api` | One app only |
| `pnpm build` | Production build of both apps |
| `pnpm start` | Serve both production builds |
| `pnpm typecheck` | `tsc --noEmit` across the workspace |
| `pnpm lint` | Lint the web app |
| `pnpm db:up` / `pnpm db:down` | Start / stop the local Mongo container |

## apps/web

```
src/
├─ app/            App Router routes, layout.tsx, globals.css (design tokens)
├─ components/ui/  Base components: Button, Input, Select, Card, Modal
├─ config/         locale.ts — locale, direction, Jalali/Persian formatters
├─ fonts/          Self-hosted Vazir woff2 + next/font/local wiring
└─ lib/            cn() class-merge helper
```

### RTL and locale

`<html lang="fa" dir="rtl">` is set in
[`layout.tsx`](apps/web/src/app/layout.tsx) from
[`src/config/locale.ts`](apps/web/src/config/locale.ts), which is the single
source of truth for locale and direction. There is no locale switcher — the app
is Persian-only by design, and the config module exists so adding a second
locale later is a contained change.

Components use **logical** Tailwind utilities (`ps-*`/`pe-*`, `start-*`/`end-*`,
`text-start`) rather than left/right ones, so they flip correctly if an LTR
locale is ever added.

`locale.ts` also exports `formatDate()` and `formatNumber()`, which produce
Jalali dates and Persian numerals via `Intl` (`fa-IR-u-ca-persian-nu-arabext`).

### Fonts

Vazir is self-hosted, not fetched from a CDN. The woff2 files live in
[`src/fonts/`](apps/web/src/fonts) and are committed; `next/font/local` emits the
`@font-face` rules, hashes and preloads the files, and generates a size-adjusted
fallback so there is no layout shift.

We ship the **Farsi-Digits (FD)** cut, which renders ASCII digits as Persian
numerals at the font level. Numbers stay plain numbers in the DOM — copyable and
machine-readable — while rendering as `۱۴۰۵/۱/۳۱`.

To refresh the files after bumping `vazir-font`:

```bash
node apps/web/scripts/sync-fonts.mjs
```

> **Note:** the `vazir-font` package is marked deprecated on npm; upstream
> development moved to **Vazirmatn**, its successor. Vazir still works and is
> what's wired up here, as specified. Switching later means swapping the woff2
> files and the `src` array in `src/fonts/vazir.ts` — nothing else changes.

### Design tokens

All tokens live in one `@theme` block in
[`globals.css`](apps/web/src/app/globals.css). Tailwind v4 is CSS-first, so
there is no `tailwind.config.js`; the `@theme` block *is* the config, and every
entry generates matching utilities (`bg-surface`, `text-fg-muted`,
`rounded-lg`, `shadow-glow`, …).

Default Tailwind palette utilities (`bg-slate-900`, `text-gray-400`, …) are
deliberately not used anywhere — build against the semantic tokens instead.

| Group | Tokens |
| --- | --- |
| Surfaces | `bg`, `surface-sunken`, `surface`, `surface-raised`, `surface-overlay`, `border`, `border-strong` |
| Brand | `primary-50…900`, `accent` |
| Semantic | `success`, `danger`, `warning`, `info` (+ `-bg` variants) |
| Text | `fg`, `fg-secondary`, `fg-muted`, `fg-disabled`, `link` |
| Radius | `sm 6` · `md 10` · `lg 14` · `xl 20` |
| Shadow | `sm`, `md`, `lg`, `glow`, `glow-sm` |

Spacing is on a 4px base. Type runs 11 → 32px with `text-base` at 14px.

> These values were derived visually from reference screenshots, not from an
> exported design source. Replacing the hexes in the `@theme` block updates
> everything downstream.

## apps/api

```
src/
├─ config/       env.ts (Zod-validated env), database.ts (Mongoose connection)
├─ models/       Mongoose schemas
├─ routes/       Route definitions, mounted under /api/v1
├─ controllers/  Request/response handling + Zod request schemas
├─ services/     Business logic and all database access
├─ middleware/   Error handling, async wrapper, validation
├─ app.ts        Express app assembly (helmet, cors, morgan, json)
└─ server.ts     Boot, listen, graceful shutdown
```

Written as ESM (`"type": "module"`) with `NodeNext` resolution, so relative
imports carry explicit `.js` extensions and the compiled output runs under plain
`node dist/server.js` with no loader.

### Configuration

Environment variables are parsed once at boot by
[`src/config/env.ts`](apps/api/src/config/env.ts). A missing or malformed value
exits the process with a readable message instead of surfacing as `undefined`
somewhere later. Import the typed `env` object rather than reading
`process.env` directly.

See [`apps/api/.env.example`](apps/api/.env.example) for the full list.

### Endpoints

| Method | Path | |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Liveness + Mongo status (503 when the DB is down) |
| `GET` | `/api/v1/courses` | List; `?page=&limit=&published=&search=` |
| `GET` | `/api/v1/courses/:id` | One course |
| `POST` | `/api/v1/courses` | Create |
| `PATCH` | `/api/v1/courses/:id` | Update |
| `DELETE` | `/api/v1/courses/:id` | Delete |

The `courses` resource is a worked example of the layering — route → validate →
controller → service → model. Copy its shape for new resources.

Errors come back in a consistent envelope; stack traces are included in
development only:

```json
{ "error": { "message": "Validation failed", "details": [{ "path": "price", "message": "Expected number" }] } }
```
