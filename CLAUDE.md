# g-dash

Gold-shop ledger. pnpm workspace: `apps/web` (Next.js 15, App Router, Tailwind
v4, React 19) and `apps/api` (Express 4, TypeScript ESM, Mongoose).
Persian/RTL throughout. [README.md](README.md) documents every endpoint and the
design tokens.

## Design reference
Original UI screenshots for style matching: /design-reference/
Consult when building new components to stay visually consistent.

## Where the project is

Built and verified against live Mongo:

- **API** — Admin/Customer/OtpRequest/Transaction models; admin password auth
  and customer OTP auth; customer CRUD with aggregates; transaction CRUD with
  payments; five dashboard stats endpoints; PDF invoices with a public link;
  Kavenegar SMS.
- **Web** — design tokens + base UI kit (Button, Input, Select, Card, Modal,
  DataTable, DateRangeFilter, ChartCard, Sidebar, PageHeader, Toast); Zustand
  stores; TanStack Query; RTL middleware guard; admin login; admin shell
  (sidebar + top bar + logout); `/admin/overview` sections 1–3;
  `/admin/customers` (debounced server-side search + aggregates table),
  `/admin/customers/new` (the two-step OTP registration wizard),
  `/admin/customers/[id]` (profile + lifetime totals + paginated history),
  `/admin/transactions` (URL-driven filters + filter modal) and
  `/admin/transactions/new` (mobile lookup → deal → payments builder).

Not built yet: `/admin/transactions/[id]` is a **placeholder screen** naming the
endpoint it will consume. The customer-facing app is `/login` + a placeholder
`/dashboard`.

`components/transactions/transactions-table.tsx` is the shared transaction list
— it owns every column's rendering and each screen passes the ids it wants.
All three consumers go through it (the overview modal, the customer history and
`/admin/transactions`); add a column there rather than a fourth copy.
`lib/transactions-api.ts` is the matching client — `transactionQuery()` builds
both the request and the query key, so the two cannot drift.

Branch `feat/transactions-stats-invoices` has an open PR (#1) against `main`.
Local commits run ahead of the pushed branch — check `git status -sb` before
assuming the PR reflects current work.

## Running it locally

```bash
pnpm dev          # both apps
pnpm --filter api seed:admin
```

- Web on **3000**, API on **4100**.
- **The API port is 4100 on this machine, not the 4000 in `.env.example`** —
  another project (`D:\projects\ftp\backend`) holds 4000. The local
  `apps/api/.env`, `apps/web/.env.local` and `.claude/launch.json` are all set
  to 4100 and agree with each other. `.env.example` keeps 4000 as the project
  default on purpose; don't "fix" it.
- `apps/web/.env.local` must carry the **same `JWT_SECRET`** as
  `apps/api/.env` — the web middleware verifies the API's cookie locally.
- Admin sign-in is at `/admin/login`; the seeded username and password are
  `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` in `apps/api/.env`.
- `SMS_PROVIDER=console` prints OTP codes to the API terminal instead of
  sending them.

## Environment traps that will cost you an hour

- **Next's dev cache corrupts, and it looks like a code bug.** The symptom is
  that pages *render* but are completely inert — clicks do nothing, skeletons
  never resolve, queries never fire. The tell is `main-app.js` and
  `app-pages-internals.js` returning **404**, or `Cannot find module './944.js'`
  / `__webpack_modules__[moduleId] is not a function` in the dev server log.
  React never hydrates. Fix: stop the dev server, `rm -rf apps/web/.next`,
  restart. This happened three times in one session after many rapid edits —
  check it before debugging the component.
- **`tsx watch` doesn't reload if you started the API without `watch`.** An API
  change that "isn't taking effect" is usually this.
- **`MONGODB_URI` must say `127.0.0.1`, not `localhost`, on this machine.** The
  native `mongod` service here binds the IPv4 loopback only, and Node resolves
  `localhost` to `::1` first — so the API hangs at boot with no error and never
  binds its port, which reads exactly like a dead dev server. `apps/api/.env` is
  set to `127.0.0.1`; `.env.example` keeps `localhost` because the
  docker-compose Mongo (`pnpm db:up`) binds both. Don't "fix" the example.
- **Verification is real HTTP against local Mongo**, not isolated unit tests.
  Scratch scripts go in the session scratchpad, never the repo. Seed data,
  assert, then delete what you seeded — the dev database should be left as you
  found it.

## Conventions that are easy to get wrong here

- **Amounts are Toman**, stored as JS numbers. `totalAmount` is rounded to whole
  Toman on write and settlement comparisons use a tolerance — never `=== 0`.
- **`totalAmount`, `invoiceNumber` and `status` on a transaction are derived**
  by the model's pre-validate hook. Never accept them from a request body, and
  never add payments with `$push` — query updates skip document middleware and
  leave `status` stale. Use `addPayment()`.
- **`remainingAmount` is a virtual, so no aggregation pipeline can read it.**
  The pipeline equivalent is `withRemainingFields()` in `transaction.model.ts`,
  placed directly under the virtual it mirrors. Change one, change the other.
- **Flow vs stock.** `/stats/volume` and `/stats/amount` are flow — filtered by
  date range. `/stats/debt-credit-*` are stock — running totals as of now, and
  deliberately reject a range, because a debt raised last year is still owed.
- **A customer's `mobile` is immutable.** It is their login identity, so
  changing it hands the account and its history to a different phone.
- **`populate()` is not a join.** You cannot filter or index on a populated
  field. Resolve ids first, then query — see `resolveCustomerIds` in
  `transaction.service.ts`.
- **Escape user input before it reaches `$regex`** (`lib/regex.ts`).
- **The web middleware is a redirect layer, not an authorisation boundary.**
  The API re-checks every cookie itself.
- **OTP codes need an approved Kavenegar template** (`verify/lookup`), not the
  ordinary send endpoint — Iranian gateways will not carry an OTP on a normal
  line. A message with `template` takes that path automatically.
- **Failed SMS must not roll back real work.** The invoice link uses `trySend`,
  which never throws. OTP requests are the exception and fail loudly with 502,
  because the whole point of the request is delivering a code.
- Web components use logical Tailwind utilities (`ps-*`, `end-*`), never
  left/right, and only semantic design tokens — no default palette classes like
  `bg-slate-900`.
- **User-facing strings are Persian.** Map API errors by HTTP status rather than
  forwarding `error.message`; the API answers in English.
- **Send dates to the API with `toApiDate()`** (`lib/jalali.ts`), never
  `toISOString().slice(0,10)`. Ranges are local-midnight boundaries, and
  `toISOString` reports them in UTC — east of Greenwich that is still the
  previous day, so every range silently started 24 hours early.
- **A server component cannot call anything exported from a `"use client"`
  module.** That is why `buttonStyles` lives in `ui/button-styles.ts` rather than
  beside `Button`. Anything a server page needs — class builders, formatters,
  constants — belongs in a module without the directive.
- **Registering a customer is three calls, in order**: request-otp → verify-otp
  → `POST /api/admin/customers`, all with `purpose: 'register'`. A verified code
  is spent, so a retry after a failed *create* must not verify again — see the
  `verified` ref in `components/customers/new-customer-wizard.tsx`. That wizard
  is shared: `/admin/customers/new` renders it in a card, and the new-transaction
  form opens it in a modal when a mobile matches no customer.
- **Numbers typed into a form go through `toNumber()`** (the new-transaction
  `form-schema.ts`), never `Number(value)`. A Persian keyboard produces `۲٫۵`,
  and `Intl` prints every weight in this app with `٫` (U+066B) and every amount
  with `٬` (U+066C) — so what the screen shows is exactly what gets typed back.
  Raw `Number()` returns NaN for all of it.
- **A `<select>` bound to a zod enum needs `""` preprocessed to `undefined`.**
  An untouched select holds `""`, which is not an enum member, so the user sees
  "Invalid enum value" instead of "choose one" — and the resolver's input type
  stops matching what react-hook-form holds. `requiredEnum()` does both.

## Commits

Every turn that changes files is committed automatically by the Stop hook. The
message comes from `.claude/commit-msg` if that file exists, and falls back to a
generic `chore(scope): update N files` if it doesn't.

**Before finishing any turn that changed files, write `.claude/commit-msg`.**
Conventional Commits, imperative subject, scoped `web` / `api` / omitted. Add a
body explaining *why* whenever the reasoning isn't obvious from the diff.
`.claude/skills/commit/SKILL.md` has the full standard and examples.

Never push unless asked.

## Known gaps, deliberately left

- **No retention policy on `apps/api/uploads/`.** Every invoice render writes a
  new file and regenerating keeps the old one so already-sent SMS links keep
  working. Gitignored, but it grows without bound — needs a cleanup job before
  production.
- **Inconsistent range params.** `/stats/*` takes `from`/`to`;
  `/admin/transactions` takes `dateFrom`/`dateTo`. Both were specified that way.
  `lib/stats-api.ts` and `lib/transactions-api.ts` hide the difference from
  components. Worth unifying.
- **`/admin/transactions` filters on name, mobile, invoice number and date
  only.** The endpoint also accepts `status` and `type`, and the table already
  shows both as badges — wiring them into the filter modal is a small addition
  to `TransactionFilters` and the form.
- **Shop details on the invoice are a placeholder** (`SHOP_INFO` in
  `invoice-template.ts`).
- **Kavenegar credentials are only in `apps/api/.env.example`**, not the web
  one — the web app never sends SMS, and a gateway key in a Next env file
  invites a `NEXT_PUBLIC_` prefix.
- **`/stats/volume` and `/stats/amount` return one pair of totals, not a time
  series**, so the overview charts are two-bar comparisons. A trend line needs
  a grouped-by-day variant of those endpoints.
- **The `courses` resource is leftover scaffolding** from the initial setup and
  is unrelated to the gold-shop domain. Safe to delete.
- **A customer's net balance is not on the detail screen**, because
  `GET /api/admin/customers/:id` doesn't return one — its `totals` are count,
  purchased and sold, all gross. It cannot be summed from the transactions in
  the response either: that is one page of history, and the two directions have
  to be netted with the sign applied. `netBalanceForCustomer()` already exists
  in `transaction.model.ts`; exposing it in that endpoint's `totals` is the fix.
