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
├─ components/ui/  The shared component kit — see below
├─ config/         locale.ts, routes.ts
├─ fonts/          Self-hosted Vazir woff2 + next/font/local wiring
├─ lib/            cn(), api client, session verify, jalali.ts, chart-theme.ts
├─ providers/      QueryProvider, StoreHydration
└─ stores/         Zustand: auth, ui, toast
```

### Component kit

| Component | |
| --- | --- |
| `Button` `Input` `Select` `Card` `Modal` | Base primitives |
| `PageHeader` | Eyebrow, title, description, breadcrumbs, actions |
| `Sidebar` | Collapsible rail, icon + label, active-state, persisted collapse |
| `DataTable<T>` | Generic columns, client sort + pagination, `manual` mode for server data |
| `DateRangeFilter` | today/week/month/year presets + Jalali custom range |
| `ChartCard` | Recharts frame with title and the filter built in |
| `Toaster` / `toast` | Zustand-backed notifications, callable outside React |

`DataTable` is generic over the row type: `T` flows from `data` through
`columns` into every `cell` and `sortValue` callback, so fields are checked and
autocompleted at each use site.

Live gallery of everything, with fixture data: **`/admin/design`**.

### Dates

Range presets are computed on the **Persian calendar**, not the Gregorian one
(`src/lib/jalali.ts`). This matters — "this month" means the current Jalali
month, which starts partway through a Gregorian one, and the week starts
Saturday. A Gregorian date library would produce ranges that look plausible and
are consistently wrong.

### Charts

Recharts has no RTL mode: left alone it runs the category axis left-to-right and
puts the value axis on the left. Spread `rtlAxisProps.x` / `.y` from
`src/lib/chart-theme.ts` onto your axes to correct that. Series colours and
tooltip styling live there too, as literal values — Recharts takes colours as
SVG attributes, not classes, so they mirror the `@theme` block rather than
reading from it.

### Client state

`zustand` for UI state, `@tanstack/react-query` for server state — they don't
overlap, so nothing is duplicated between them.

- **`useAuthStore`** — current user and role. Not persisted: the httpOnly
  session cookie is the source of truth and a cached copy can outlive it.
- **`useUiStore`** — sidebar collapse (persisted) and a modal *stack*, so a
  confirmation can open over a form without destroying it.
- **`useToastStore`** / `toast` — callable from anywhere, including a query
  `onError`, without being inside the component tree.

Query defaults: `staleTime` 60s, `gcTime` 5min, no retry on 4xx (a 401 or 404 is
a settled answer), no retry on mutations (a replayed POST can double-charge).

### Routing and the auth guard

[`src/middleware.ts`](apps/web/src/middleware.ts) gates both audiences. Paths
live in [`src/config/routes.ts`](apps/web/src/config/routes.ts).

| Path | Signed out | Customer | Admin |
| --- | --- | --- | --- |
| `/` | → `/login` | → `/dashboard` | → `/admin/overview` |
| `/admin` | → `/admin/login` | → `/admin/login` | → `/admin/overview` |
| `/admin/*` | → `/admin/login` | → `/admin/login` | allowed |
| `/login`, `/admin/login` | allowed | → `/dashboard` | → `/admin/overview` |
| everything else | → `/login` | allowed | → `/login` |

Blocked requests carry the intended path through as `?next=`, so the login page
can send the user back afterwards. A signed-in user who lands on a login page is
bounced to their own home.

The middleware verifies the API's cookie locally with `jose` rather than calling
`/me` on every navigation — Next middleware runs on the Edge runtime, which has
Web Crypto but not Node's `crypto`. That means **this app needs the same
`JWT_SECRET` as `apps/api`**; see `.env.example`.

> This is a redirect layer, not an authorisation boundary. It decides which page
> to show, not what data you can read — the API re-checks the same cookie on
> every call. Bypassing the middleware exposes empty placeholder pages, not data.

Cookies are not port-scoped, so in local dev the cookie the API sets on
`localhost:4000` is sent to `localhost:3000` unchanged. In production the two
apps must share a site, or sit behind one proxy.

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

### Auth

Two middlewares do the work, split so that "who is this?" and "are they
allowed?" stay separate concerns:

- **`authenticate`** runs app-wide. It reads and verifies every session cookie
  present and attaches `req.user` plus `req.sessions`. It **never rejects** — an
  absent or expired cookie just means anonymous, so login routes stay reachable.
- **`requireRole('admin' | 'customer')`** guards a route or a whole mount point,
  and repoints `req.user` at the role the route asked for. It answers `401` when
  nobody is signed in and `403` when someone is but as the wrong role —
  re-authenticating fixes the first and never the second.

`/api/v1/health` and the login/OTP entry points are public; everything else
under `/api/v1` is gated on `admin` at the mount point, so a new resource
inherits the guard instead of having to remember it.

Sessions are JWTs in **httpOnly cookies** — `gd_admin_token` and
`gd_customer_token`, kept separate so a staff member testing the customer view
doesn't destroy their own admin session. Tokens are never returned in a response
body. Cookies are `SameSite=Lax`, and `Secure` in production only.

Admins sign in with a password (bcrypt). Customers have no password at all —
they authenticate by OTP.

| Method | Path | |
| --- | --- | --- |
| `POST` | `/api/admin/auth/login` | `{ username, password }` → sets admin cookie |
| `POST` | `/api/admin/auth/logout` | Clears the cookie. Always 200. |
| `GET` | `/api/admin/auth/me` | Session check for the admin shell |
| `POST` | `/api/customer/auth/request-otp` | `{ mobile, purpose }` → sends a 5-digit code |
| `POST` | `/api/customer/auth/verify-otp` | `{ mobile, code, purpose }` |
| `POST` | `/api/customer/auth/logout` | Clears the customer cookie |
| `GET` | `/api/customer/auth/me` | Session check |

**Purpose rules.** `login` is public and requires the customer to already exist
(404 otherwise). `register` is **admin-only** — it is reached from the staff
"add customer" screen, never the public site — and requires the customer *not*
to exist yet (409 otherwise). Verifying a `register` code returns
`{ verified: true }` and creates nothing; the Customer document is written by
the customers controller.

Codes live 2 minutes, allow 5 wrong guesses, and a resend retires the previous
one. `POST request-otp` is rate limited to **3 per mobile per 10 minutes**
(`OTP_RATE_LIMIT_*`), keyed on the normalized number so `+98…` and `09…` share
a budget.

Seed the first admin — set `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`, run
it, then remove them from `.env`:

```bash
pnpm --filter api seed:admin
```

It's idempotent: an existing username is left untouched unless you pass
`--force`, which resets the password.

### SMS

`request-otp` sends through the `SmsProvider` interface in
[`src/services/sms/`](apps/api/src/services/sms). The default `console` provider
prints the message and **refuses to start when `NODE_ENV=production`** — a stub
that silently succeeds without delivering would make every customer login fail
in a way that looks like a client bug.

To add a real gateway: implement `SmsProvider` in
`src/services/sms/<name>.provider.ts`, add the name to the `SMS_PROVIDER` enum
in `config/env.ts`, and add a case to the factory. Callers only ever see
`getSmsProvider()`, so nothing else changes.

### Endpoints

| Method | Path | |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Liveness + Mongo status (503 when the DB is down) |
| `GET` | `/api/v1/courses` | List; `?page=&limit=&published=&search=` |
| `GET` | `/api/v1/courses/:id` | One course |
| `POST` | `/api/v1/courses` | Create |
| `PATCH` | `/api/v1/courses/:id` | Update |
| `DELETE` | `/api/v1/courses/:id` | Delete |

Customers — admin-only (`requireRole('admin')`):

| Method | Path | |
| --- | --- | --- |
| `GET` | `/api/admin/customers` | List; `?search=&page=&limit=`. Each row carries `transactionCount`, `totalPurchased`, `totalSold` |
| `GET` | `/api/admin/customers/:id` | Detail + totals + paginated transaction history |
| `POST` | `/api/admin/customers` | Create — requires a recently verified `register` OTP for the mobile |
| `PATCH` | `/api/admin/customers/:id` | Rename. `mobile` is rejected, not ignored |

Transactions — admin-only:

| Method | Path | |
| --- | --- | --- |
| `GET` | `/api/admin/transactions` | List; `?customerName=&customerMobile=&invoiceNumber=&dateFrom=&dateTo=&status=&type=&page=&limit=` |
| `GET` | `/api/admin/transactions/:id` | Detail with customer, issuing admin and payments |
| `POST` | `/api/admin/transactions` | Create; accepts an initial `payments` array (may be empty) |
| `POST` | `/api/admin/transactions/:id/payments` | Add one instalment; re-derives `status` |

`totalAmount`, `invoiceNumber` and `status` are **not accepted from the request
body** — all three are derived by the model, so a client cannot write a total
that disagrees with weight × price. `dateTo` is treated as inclusive of the
whole day when it carries no time, since a date picker sends `2026-08-02` and
`$lte` on midnight would silently exclude that day.

The signed-in customer's own records — `requireRole('customer')`:

| Method | Path | |
| --- | --- | --- |
| `GET` | `/api/customer/me` | Own profile |
| `PATCH` | `/api/customer/me` | Own `firstName` / `lastName` only |
| `GET` | `/api/customer/transactions` | Own transactions; `?dateFrom=&dateTo=&minAmount=&maxAmount=` |
| `GET` | `/api/customer/transactions/:id` | Own transaction; 404 for anyone else's |

The customer routes are read-only by design — a customer cannot ring up their
own sale or declare themselves paid. Scope always comes from `req.user`, so a
crafted query string cannot widen it, and someone else's invoice answers 404
rather than 403 so the response can't be used to probe which ids exist.

`/me` and the customer transaction routes take the id from `req.user`, never
from the URL or body, so there is no id for a caller to tamper with.

**A note on the aggregate names**, which read backwards depending on which side
of the counter you stand on. They are from the *customer's* point of view:
`totalPurchased` sums transactions of type `sell` (the shop sold to them) and
`totalSold` sums type `buy`. Both are gross deal value, not amounts settled —
what is still owed, and in which direction, is `remainingAmount` per
transaction.

The list runs one aggregation that paginates *before* the `$lookup`, so the
join touches only the current page's customers, and groups by type inside the
join so at most two rows come back per customer rather than a whole history.

The `courses` resource is a worked example of the layering — route → validate →
controller → service → model. Copy its shape for new resources.

Errors come back in a consistent envelope; stack traces are included in
development only:

```json
{ "error": { "message": "Validation failed", "details": [{ "path": "price", "message": "Expected number" }] } }
```
