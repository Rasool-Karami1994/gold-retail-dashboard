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
- Chrome or Chromium, for rendering invoice PDFs — see
  [DEPLOY.md](DEPLOY.md#the-chromium-requirement)

Or skip all of it and run the whole stack in containers —
[Running everything in Docker](#running-everything-in-docker).

## Getting started

```bash
pnpm install
```

Create the env files from their templates:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Start MongoDB (skip if you're pointing `MONGO_URI` at Atlas or an existing server):

```bash
pnpm db:up
```

Run both apps together:

```bash
pnpm dev
```

`concurrently` runs them in one terminal with prefixed, colour-coded output:
web on http://localhost:3000, API on http://localhost:4000. `Ctrl-C` stops both.

> The API port comes from `PORT` in `apps/api/.env`. If something else on your
> machine already holds 4000, change it there — and change `PUBLIC_API_URL` to
> match, plus `NEXT_PUBLIC_API_URL` in `apps/web/.env.local`, or the web app
> will call the wrong origin and invoice links will point at a dead port.

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
| `pnpm db:up` / `pnpm db:down` | Start / stop **just** the Mongo container, for host development |
| `pnpm docker:up` / `pnpm docker:down` | The full three-service stack — see below |
| `pnpm docker:logs` | Follow all three services' logs |
| `pnpm docker:seed` | Seed the admin user inside the running API container |

## Running everything in Docker

`docker-compose.yml` runs all three services — Mongo, the API and the web app —
on one network. This is an alternative to `pnpm dev`, not a companion to it:
both want ports 3000 and 4100, so run one or the other.

### First run

```bash
cp .env.example .env
```

Open it and set **`JWT_SECRET`** to something at least 32 characters. Both
containers read that one file, which is what keeps the API and the web
middleware on the same signing key. Set `SEED_ADMIN_PASSWORD` too (minimum 12
characters) — you need it in a moment.

```bash
docker compose up --build
```

First build takes a few minutes: the API image installs Chromium and Vazir, and
the web image runs a full Next production build. Afterwards, web is on
http://localhost:3000 and the API on http://localhost:4100.

> **4100, not the 4000 elsewhere in this README.** Container-internal ports are
> fixed; `WEB_PORT`, `API_PORT` and `MONGO_PORT` in `.env` decide only what they
> are published as on the host, and 4100 is the default because 4000 is commonly
> taken. Change `API_PORT` and `NEXT_PUBLIC_API_URL`, `PUBLIC_API_URL` and
> `ALLOWED_ORIGIN` all follow from it automatically — that derivation lives in
> `docker-compose.yml` so the four cannot drift apart.

Then create the admin account, once, in the running API container:

```bash
pnpm docker:seed
```

That runs the TypeScript entry point through `tsx`, so it only works against the
dev container. The production image has neither `tsx` nor `src/`, and runs the
compiled copy instead:

```bash
docker compose exec api node dist/scripts/seed-admin.js
```

Either way it is idempotent — an existing username is left untouched unless you
append `--force`, which resets the password.

Sign in at http://localhost:3000/admin/login with `SEED_ADMIN_USERNAME` /
`SEED_ADMIN_PASSWORD`, then blank both out of `.env` — a running server has no
reason to hold an admin password.

With `SMS_PROVIDER=console` (the default) OTP codes are printed rather than
sent. Read them from the API's log:

```bash
docker compose logs -f api
```

### Day to day

```bash
docker compose up
```

```bash
docker compose down
```

`docker compose down -v` additionally deletes the `mongo-data` volume — every
customer and transaction with it. Rendered invoices live in Cloudinary and are
unaffected.

### Dev mode is the default

`docker-compose.override.yml` is loaded automatically, and it swaps both apps
onto bind-mounted source running `tsx watch` and `next dev`. Edit a file on the
host and the container reloads; no rebuild. To run the production images
instead, name the base file explicitly:

```bash
docker compose -f docker-compose.yml up --build
```

> **The production profile needs real SMS credentials.** Those images run
> `NODE_ENV=production`, and the mock provider refuses to load there — it would
> otherwise put one-time codes in API responses. It does not stop the server
> starting; it fails on the first OTP with a 502 and *"Could not send the
> verification code"*, with the real reason only in `docker compose logs api`.
> Set `SMS_PROVIDER=kavenegar` and the `KAVENEGAR_*` values, or stay in dev mode.

Rebuild after changing any `NEXT_PUBLIC_*` value:

```bash
docker compose up --build
```

**After changing a dependency, `--build` on its own is not enough in dev mode.**
Each app's `node_modules` is an anonymous volume — that is what stops the source
bind mount from burying the install baked into the image — and Docker only
populates one when it first creates it. A rebuilt image with new packages sits
behind the volume from the previous run. Discard them explicitly:

```bash
docker compose up --build --renew-anon-volumes
```

That touches only the anonymous volumes. `mongo-data` is named and survives it;
`down -v` is the command that would take it too.

### Things that are easy to get wrong

**Containers reach each other by service name, never `localhost`.** Inside a
container `localhost` is that container. The API talks to `mongo:27017`, and
anything server-side in the web app would talk to `api:4100` — that is what
`API_INTERNAL_URL` is for. Nothing reads it today, because `src/lib/api.ts` runs
only in the browser; it is set so the next server component that calls the API
has the right value to reach for.

**`NEXT_PUBLIC_API_URL` is the other side of that split, and must stay
`http://localhost:4100/api/v1`.** It is fetched by the *browser*, which sits
outside the compose network and cannot resolve `api`. It is also compiled into
the bundle at build time, which is why it lives under `build.args` in
`docker-compose.yml` rather than in `.env` — changing it needs `--build`, not a
restart. `JWT_SECRET` is the reverse: read at run time, so a restart is enough.

**The root `.env` is for containers only.** `apps/api/.env` and
`apps/web/.env.local` are for `pnpm dev` on the host and are not read by
Compose — they point at `127.0.0.1`, which inside a container is the container.
Values that depend on the network (`MONGO_URI`, `ALLOWED_ORIGIN`,
`PUBLIC_API_URL`) are set in `docker-compose.yml`, where they override anything
of the same name in `.env`.

**Both Dockerfiles build from the repo root**, because pnpm needs
`pnpm-lock.yaml` and `pnpm-workspace.yaml` and `COPY` cannot climb above its
context. Docker therefore reads `/.dockerignore` and *not* the per-app ones —
`apps/api/.dockerignore` and `apps/web/.dockerignore` mirror it for a
hypothetical single-app context, but Compose never consults them.

**Invoice PDFs are uploaded to Cloudinary, not written anywhere in the stack.**
Set the `CLOUDINARY_*` variables in `.env` to exercise the invoice flow; without
them the render fails and the transaction is still recorded with a null
`invoicePdfUrl`. Re-rendering uploads a new asset and leaves the old one, so
links already texted keep working — and storage grows without bound.

### Persian text in PDFs

The API image installs Chromium plus the Vazir TrueType faces into
`/usr/share/fonts/vazir`, since Alpine ships no Arabic-script font and Chromium
would otherwise render Persian as tofu.

That install is a safety net rather than the mechanism, though: invoices already
render correctly because `services/invoice.ts` inlines
`apps/api/assets/fonts/*.woff2` into the template as base64 data URIs, precisely
so a headless browser cannot print before the font arrives. The system fonts
cover anything rendered outside that template, and any glyph the three vendored
faces miss.

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

Cookies are not port-scoped, so in local dev the cookie the API sets is sent to
the web app on a different port unchanged. In production the two apps must
share a site, or sit behind one proxy.

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
| `GET` | `/api/health` | Liveness only. Always 200 `{ status: "ok" }`, touches nothing |
| `GET` | `/api/v1/health` | Liveness + Mongo status (503 when the DB is down) |

The two are not redundant. `/api/health` is mounted ahead of the body parsers
and the auth middleware and makes no database call, so it is the cheapest reply
the server can produce — that is what an external uptime pinger should hit to
keep a free-tier instance from spinning down, and it cannot turn a keep-alive
ping into a false alert. `/api/v1/health` is the real readiness check and is
what the Docker healthcheck and any orchestrator should use, because "up but
cannot reach its database" is precisely the state they need to see.
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

Dashboard stats — admin-only. The frontend resolves its today/week/month/year/
custom picker into explicit dates and sends `from`/`to`; nothing server-side
knows about presets.

| Method | Path | |
| --- | --- | --- |
| `GET` | `/api/admin/stats/volume` | `{ soldGrams, boughtGrams }` for the range |
| `GET` | `/api/admin/stats/amount` | `{ soldAmount, boughtAmount }` for the range |
| `GET` | `/api/admin/stats/debt-credit-amount` | Outstanding Toman, as of now |
| `GET` | `/api/admin/stats/debt-credit-grams` | The same balances in grams |
| `GET` | `/api/admin/stats/open-transactions` | Paginated unsettled invoices; `?type=&page=&limit=` |

**Two different time semantics live here, and confusing them produces wrong
numbers.** `/volume` and `/amount` are *flow* — what moved during the range,
filtered on `createdAt`. The two `debt-credit-*` routes are *stock* — what is
outstanding right now, deliberately **not** date-filtered, because a debt from
two years ago is still owed today and dropping it for falling outside "this
month" would understate the balance.

`/debt-credit-grams` converts each open transaction at its **own**
`dailyGoldPricePerGram` — the rate that deal was struck at — and only then
sums. Converting the aggregate total at today's rate would silently restate
historic debts at the current gold price, which is a different and wrong
number.

`remainingAmount` is a virtual, so it does not exist in the database and no
pipeline can read it. The aggregation equivalent lives in
[`transaction.model.ts`](apps/api/src/models/transaction.model.ts) as
`withRemainingFields()`, directly beneath the virtual it mirrors — change one
and you must change the other.

Capital in grams of gold — admin-only. A gold shop measures itself in metal,
not currency: the gold in the safe plus what its cash, receivables and payables
come to at the day's rate.

| Method | Path | |
| --- | --- | --- |
| `GET` | `/api/admin/shop-settings` | `{ configured, settings }` — the opening position, or `configured: false` |
| `PATCH` | `/api/admin/shop-settings` | Create or update it. All three fields required on the first write |
| `GET` | `/api/admin/gold-prices` | `{ today, latest }` — today's recorded price and the most recent of any day |
| `POST` | `/api/admin/gold-prices` | Record a price; **upserts by day**, so re-submitting corrects rather than duplicates |
| `GET` | `/api/admin/capital` | The series plus a current snapshot; `?from=&to=&granularity=day\|week\|month` |

For a point in time `T` valued at price `P`:

```
goldGrams   = openingGoldGrams − Σ(sell weight ≤ T) + Σ(buy weight ≤ T)
cash        = openingCashToman + Σ(sell payments paid ≤ T) − Σ(buy payments paid ≤ T)
receivables = Σ(remaining on sells as of T)      // owed to the shop
payables    = Σ(remaining on buys  as of T)      // owed by the shop
capital     = goldGrams + (cash + receivables − payables) / P
```

**Recomputed from the transactions on every request, never stored as a running
total.** Payments are recorded retroactively — an instalment carries its own
`paidAt`, which can be weeks before the day it is entered — so an incremental
counter would have to be revised backwards through history it has already
published, and a missed revision is undetectable: a wrong total looks exactly
like a right one.

**Gold moves on the transaction's `createdAt`; cash moves on the payment's
`paidAt`.** A deal struck in Farvardin and paid in Khordad moves metal in the
first month and money in the third. Summing payments by their transaction's
creation date — the easy mistake, since that is the one date on the parent
document — posts the money to the wrong month.

A day with no recorded price is valued at the most recent earlier one and
marked `estimated: true`, which the chart draws as a hollow point; a point with
no prior price at all is omitted rather than guessed at. Everything before
`openingDate` is excluded, because an opening balance already accounts for it.
Buckets are Jalali months and Saturday-start weeks on the Tehran clock
([`shop-calendar.ts`](apps/api/src/lib/shop-calendar.ts)), and each point
carries its bucket start twice — as an instant (`date`) and as the plain
calendar day (`day`) a client should label it with. **All gold types are summed
as fungible weight**; the deliberate simplification is documented at the
aggregation in
[`capital.service.ts`](apps/api/src/services/capital.service.ts).

The signed-in customer's own records — `requireRole('customer')`:

| Method | Path | |
| --- | --- | --- |
| `GET` | `/api/customer/me` | Own profile |
| `PATCH` | `/api/customer/me` | Own `firstName` / `lastName` only |
| `GET` | `/api/customer/transactions` | Own transactions; `?dateFrom=&dateTo=&minAmount=&maxAmount=` |
| `GET` | `/api/customer/transactions/:id` | Own transaction; 404 for anyone else's |

Invoices:

| Method | Path | |
| --- | --- | --- |
| `POST` | `/api/admin/transactions/:id/invoice` | Render (or re-render) the PDF; admin-only, synchronous |

Creating a transaction kicks off a render in the background, so the cashier
never waits on Chrome and a rendering failure cannot fail a recorded sale.
`invoicePdfUrl` is therefore `null` in the create response and populated a
second or two later; the endpoint above retries or refreshes it.

**The public route has no authentication on purpose** — a customer opens the
link from an SMS without an account, which makes the URL itself the credential.
That only holds because the filename carries 128 bits of entropy
(`INV-20260802-0007-<32 hex>.pdf`). Naming files after the invoice number alone
would let anyone walk a day's sales and read customer names, numbers and
amounts. The route matches an exact allowlist pattern before touching the
filesystem, and responses are `no-store` + `noindex` so a leaked link doesn't
end up in a proxy cache or a search index.

### SMS

[`src/services/sms.ts`](apps/api/src/services/sms.ts) exposes a provider
interface plus two implementations: a console stub for development (which
refuses to start in production) and Kavenegar. Pick one with `SMS_PROVIDER`.

Kavenegar is called over `fetch` rather than the official `kavenegar` npm
package — that SDK is on 1.1.4, last published June 2022, callback-based and
untyped, which is a stale dependency to take on for what amounts to two URL
builds.

**One-time codes and ordinary messages take different endpoints.** Iranian
gateways will not carry an OTP on a normal sending line, so a message with a
`template` goes through `verify/lookup` (positional `token`, `token2`, … — no
spaces allowed in a token) and everything else through `sms/send` with
`KAVENEGAR_SENDER`. Register a template named `otp` whose first token is the
code.

The two call sites treat failure differently, on purpose:

- **OTP** fails loudly with a 502. The whole point of the request is to put a
  code in the customer's hand; answering 201 would leave them waiting at a code
  box for a message that is never coming.
- **The invoice link** is sent with `trySend`, which never throws. The PDF
  exists and its URL is already saved, so a gateway outage must not undo real
  work — it logs and moves on, and the link stays retrievable from the
  transaction.

Only the create path texts the customer. Re-rendering an invoice does not, so
adding a payment doesn't spam them; pass `?notify=true` to
`POST /api/admin/transactions/:id/invoice` to deliberately resend.

The API key travels in Kavenegar's URL path, so that URL is never logged and
never included in an error.

PDFs are rendered with **`puppeteer-core`, not `puppeteer`** — the full package
downloads its own Chromium from `storage.googleapis.com`, which returns 403
from Iran and makes `pnpm install` fail outright. puppeteer-core is the same
library driving a browser that is already installed; set
`CHROME_EXECUTABLE_PATH` or let it auto-detect. Vazir is vendored into
`apps/api/assets/fonts` and inlined as base64 in the template, because a
headless browser will happily print before an external font loads and Persian
text in a fallback face is tofu.

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
