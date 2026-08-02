# g-dash

pnpm workspace: `apps/web` (Next.js 15, App Router, Tailwind v4) and `apps/api`
(Express 4, TypeScript ESM, Mongoose). Persian/RTL throughout. See
[README.md](README.md) for how to run things.

## Commits

Every turn that changes files is committed automatically by the Stop hook. The
message comes from `.claude/commit-msg` if that file exists, and falls back to a
generic `chore(scope): update N files` if it doesn't.

**Before finishing any turn that changed files, write `.claude/commit-msg`.**
Conventional Commits, imperative subject, scoped `web` / `api` / omitted. Add a
body explaining *why* whenever the reasoning isn't obvious from the diff.
`.claude/skills/commit/SKILL.md` has the full standard and examples.

Never push unless asked.

## Conventions that are easy to get wrong here

- **Amounts are Toman**, stored as JS numbers. `totalAmount` is rounded to whole
  Toman on write and settlement comparisons use a tolerance — never `=== 0`.
- **`totalAmount`, `invoiceNumber` and `status` on a transaction are derived**
  by the model's pre-validate hook. Never accept them from a request body, and
  never add payments with `$push` — query updates skip document middleware and
  leave `status` stale. Use `addPayment()`.
- **A customer's `mobile` is immutable.** It is their login identity, so
  changing it hands the account and its history to a different phone.
- **`populate()` is not a join.** You cannot filter or index on a populated
  field. Resolve ids first, then query — see `resolveCustomerIds` in
  `transaction.service.ts`.
- **Escape user input before it reaches `$regex`** (`lib/regex.ts`).
- **The web middleware is a redirect layer, not an authorisation boundary.**
  The API re-checks every cookie itself.
- Web components use logical Tailwind utilities (`ps-*`, `end-*`), never
  left/right, and only semantic design tokens — no default palette classes like
  `bg-slate-900`.

## Verification

The API is verified by running it against the local Mongo and exercising real
HTTP, not by unit-testing services in isolation. Scratch scripts for that go in
the session scratchpad, not the repo.
