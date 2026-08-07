# Deploying g-dash

Two processes and a database. `apps/api` is a long-running Express server;
`apps/web` is a Next.js server (not a static export — it has middleware and
server components). Both need to be reachable by the browser, and the API
additionally needs to be reachable **from a customer's phone**, because the
invoice link it texts points at itself.

---

## 0. The three run modes

The same two apps run three different ways, and most confusing failures come
from applying one mode's configuration to another. Pick the row you are in.

| | Local dev | Docker Compose | Production (split domain) |
| --- | --- | --- | --- |
| Command | `pnpm dev` | `docker compose up` | Vercel + Render deploys |
| Config read from | `apps/api/.env`, `apps/web/.env.local` | root `.env` + `docker-compose.yml` | each host's dashboard |
| Web ↔ API | `localhost:3000` → `localhost:4100` | `localhost:3000` → `localhost:4100` | browser → Vercel `/api` → Render (proxied) |
| API ↔ Mongo | `127.0.0.1:27017` | `mongo:27017` (service name) | Atlas connection string |
| Same site? | Yes — cookie just works | Yes | Yes, *because* of the proxy — see §6 |
| `NODE_ENV` | `development` | `development` | `production` |
| SMS | mock, code shown on screen | mock, code in the API log | Kavenegar (see §8) |
| Invoices | Cloudinary | Cloudinary | Cloudinary |

Three things change *behaviour*, not just values, when `NODE_ENV=production`:

- The session cookie gains `Secure`, so it stops working over plain http.
  (`SameSite` stays `Lax` in every environment — the §6 proxy is what makes that
  possible across two hosts.)
- Mock SMS refuses to run unless explicitly allowed (§8).
- Cloudinary credentials become mandatory at boot (§7).

The per-app `.env` files and the root `.env` are **not** interchangeable: the
first pair point at `127.0.0.1`, which inside a container is the container.
README.md covers the Compose mode in full; the rest of this document is about
the third column.

---

## 1. Prerequisites

| Thing | Why |
| --- | --- |
| Node 20+ and pnpm 9 | The workspace pins pnpm in `packageManager`. |
| MongoDB 6+ | Atlas or self-hosted. |
| Chrome or Chromium on the API host | Invoices are rendered by `puppeteer-core`, which drives an **already installed** browser rather than downloading one. |
| A Cloudinary account | Invoice PDFs are stored there, not on disk. Required in production — see §7. |
| A Kavenegar account | An API key, a sending line, and an approved template named `otp`. Required in production unless you deliberately opt out — see §8. |

### The Chromium requirement

`puppeteer-core` is deliberate: the full `puppeteer` package downloads its own
Chromium at install time, and Google's CDN returns 403 from some regions —
including Iran — which fails the install outright.

Install a browser and point at it if auto-detection misses:

```bash
apt-get install -y chromium            # Debian/Ubuntu
# then, in apps/api/.env
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

`PUPPETEER_EXECUTABLE_PATH` is the name to use; `CHROME_EXECUTABLE_PATH` is this
repo's older spelling and still works. Leave both unset and the resolver scans
the Puppeteer browser cache, then the usual Linux, macOS and Windows install
locations — see `resolveExecutablePath()` in `apps/api/src/services/invoice.ts`.

**Render's Node runtime ships no browser**, so this is the one part of the API
that does not work on a stock Node service. Install one during the build and
point `PUPPETEER_EXECUTABLE_PATH` at it, or deploy the API from
`apps/api/Dockerfile` instead, which already has Chromium and the Vazir fonts.

---

## 2. Configure

Copy both example files and work through them. Each lists, at the top, exactly
which values must change for production and what breaks if they don't.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Two settings are worth repeating because they fail in confusing ways:

**`JWT_SECRET` must be byte-identical in both apps.** The web middleware
verifies the API's session cookie locally instead of calling `/me` on every
navigation. A mismatch is not an error anyone sees — it just rejects every
session, and users bounce back to the login page in a loop.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**`NEXT_PUBLIC_API_URL` is baked in at build time.** Next inlines
`NEXT_PUBLIC_*` into the client bundle, so setting it only in the runtime
environment leaves the old value compiled in and every browser request goes to
`localhost`. Set it before `pnpm build`, and rebuild when it changes.

---

## 3. Build

```bash
pnpm install --frozen-lockfile
pnpm build          # runs the web build, then tsc for the API
```

That produces `apps/web/.next` and `apps/api/dist`.

---

## 4. Seed the first admin

There is no sign-up for staff — the first account is seeded from the CLI.

```bash
SEED_ADMIN_USERNAME=admin SEED_ADMIN_PASSWORD='<a real password>' \
  pnpm --filter api seed:admin
```

Pass them on the command line rather than leaving them in `.env`: the running
server has no reason to hold an admin password. Re-running is safe; it reports
that the admin exists and changes nothing unless you pass `--force`.

---

## 5. Run

```bash
pnpm --filter api start     # node dist/server.js
pnpm --filter web start     # next start
```

### Process manager

Anything that restarts on exit and starts on boot. With pm2:

```bash
pm2 start "pnpm --filter api start" --name g-dash-api
pm2 start "pnpm --filter web start" --name g-dash-web
pm2 save && pm2 startup
```

systemd units work equally well. Two things to get right whichever you use:

- **Set the working directory to the repo root.** `.env` is read from
  `apps/api/`, and the Vazir font files the invoice template inlines are
  resolved relative to the API package root.
- **Restart on failure.** The API exits deliberately when it cannot reach Mongo
  or when a required variable is missing — that is a crash you want retried
  while the database comes up, not a silent stop.

---

## 6. Reverse proxy

Same site for both apps, or the session cookies will not be sent. Cookies
ignore port but not origin, so a scheme like this works:

```nginx
server {
  server_name shop.example.com;

  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

The API already sets `trust proxy`, so `X-Forwarded-*` is what makes rate
limiting and logs see the real client address rather than the proxy's.

### Different hosts (Vercel + Render): the /api proxy

**The frontend proxies the API instead of the browser calling it directly.**
`apps/web/next.config.mjs` rewrites `/api/:path*` to `API_PROXY_TARGET`, so
every request the browser makes goes to the Vercel origin and Vercel forwards
it to Render.

#### The problem it solves

A cookie is stored against the host that set it. Point the browser straight at
`g-dash-api.onrender.com` and the session cookie belongs to *that* host —
`SameSite=None` will make the browser attach it to cross-site XHRs, but the
Vercel origin still cannot see it.

`apps/web/src/middleware.ts` reads the cookie directly to decide which page to
render. It would find nothing, treat every signed-in visitor as signed out, and
bounce them to the login page in a loop, while the API cheerfully authenticated
the same person's fetches. A confusing failure: the network tab shows 200s and
the screen shows a login form.

The proxy removes the split rather than working around it. One origin, cookie
first-party, middleware works untouched.

#### Configuration

| Where | Variable | Value |
| --- | --- | --- |
| Vercel | `API_PROXY_TARGET` | `https://g-dash-api.onrender.com` |
| Vercel | `NEXT_PUBLIC_API_URL` | `/api` |
| Vercel | `JWT_SECRET` | same as the API's |
| Render | `ALLOWED_ORIGIN` | `https://g-dash.vercel.app` |
| Render | `COOKIE_DOMAIN` | **leave unset** |

Four things about this are easy to get wrong:

- **`API_PROXY_TARGET` has no `NEXT_PUBLIC_` prefix, deliberately.** The browser
  must never learn the backend's origin; if it does, someone will call it
  directly and the cookie goes back on a third-party domain.
- **It is read at build time.** Next compiles rewrites into
  `.next/routes-manifest.json`, so changing it needs a redeploy, not a restart —
  the same as any `NEXT_PUBLIC_*` value.
- **`NEXT_PUBLIC_API_URL` is relative.** Put the backend's absolute origin there
  and the browser bypasses the proxy, which is exactly the state this avoids.
  Both `/api` and `/api/v1` work; `src/lib/api.ts` strips either.
- **Leave `COOKIE_DOMAIN` unset.** The API sets the cookie with no `Domain`, the
  proxy passes it through, and the browser files it under the Vercel origin.
  Setting it scopes the cookie to a domain the browser is not on, and the cookie
  is dropped.

The session cookie is `SameSite=Lax; Secure; HttpOnly` — `Lax` is correct now
that everything is same-site, and it keeps the browser's built-in CSRF
protection, which `None` switches off.

CORS stops being load-bearing under this arrangement: requests reach the API
from Vercel's server, with no `Origin` header, so the allowlist is never
consulted. Set `ALLOWED_ORIGIN` anyway — it still governs anyone reaching the
API directly, and it costs nothing.

#### Cost, and the alternative

Every API call takes an extra hop: browser → Vercel edge → Render. On the free
tier that lands on top of the cold start in §7a rather than replacing it.

**Custom domains on a shared parent remove the hop.** Give both apps a name
under one registrable domain and the cookie is visible to both with no proxy:

| | |
| --- | --- |
| `api.example.com` (Render) | `COOKIE_DOMAIN=.example.com` |
| `app.example.com` (Vercel) | `ALLOWED_ORIGIN=https://app.example.com` |

Then unset `API_PROXY_TARGET`, set `NEXT_PUBLIC_API_URL` to
`https://api.example.com/api/v1`, and the rewrite disappears on the next build.
The cookie stays `Lax`, because the two are now the same site.

This needs a domain you own; the free `*.onrender.com` and `*.vercel.app`
hostnames cannot do it, since the public suffix list forbids a cookie scoped to
`.vercel.app`. **The proxy is what makes the free hostnames workable** — which
is why it is the documented default.

Vercel gives each branch its own hostname, but preview deployments need no extra
configuration under the proxy: they proxy to the same backend from their own
origin, and the cookie follows whichever origin the browser is on.

If you must ship on the free hostnames, the middleware has to stop gating on
the cookie and let the API's 401s drive redirects from the client instead. No
data is exposed either way — the middleware is a redirect layer and the API
re-checks every request — but the guard has to be rewritten rather than
configured.

---

## 7. Invoice PDFs

Puppeteer renders the PDF, the API uploads it to **Cloudinary** as a `raw`
resource, and the returned `secure_url` is stored on the transaction's
`invoicePdfUrl`. The API serves no PDF bytes at all — there is no
`/api/invoices/:filename` route and nothing is written to local disk.

That is deliberate: Render's filesystem is ephemeral, so anything written
locally disappears on the next deploy while `invoicePdfUrl` goes on pointing at
it — links already texted to customers start answering 404 and nothing in the
app notices.

Set all three `CLOUDINARY_*` variables. The API refuses to boot in production
without them, rather than recording sales whose invoices silently never appear.

**The delivery URL is public, by design.** Customers open the link from an SMS
with no account, so the URL is the credential. That holds because the public_id
carries 128 bits of entropy:

```
g-dash/invoices/INV-20260807-0001-<32 hex>.pdf
```

Naming an invoice after its number alone would let anyone walk a day's sales and
read customer names, numbers and amounts.

Two things changed with the move off local disk, and both are worth knowing:

- **The `no-store` and `noindex` headers are gone.** Cloudinary's CDN serves
  these, not the API, so a leaked link can be cached or crawled in a way it
  could not before. If that matters for your threat model, switch the upload to
  `type: "authenticated"` and issue signed, expiring URLs.
- **Nothing prunes old assets.** Every re-render uploads under a new public_id
  and leaves the previous one in place, so links already sent keep working.
  Storage grows without bound — the same outstanding cleanup job as before, now
  against Cloudinary rather than a directory.

`POST /api/admin/transactions/:id/invoice` re-renders one invoice and repoints
the record without re-texting the customer.

---

## 7a. Render's free tier

512 MB of RAM, and the instance spins down after 15 minutes with no traffic.
Three things follow.

**Tell your early testers about the cold start, before they hit it.** The first
request after an idle period waits for the container to be recreated: expect
**30–60 seconds**, occasionally more when Chromium has to warm up too. Nothing
in the UI distinguishes that from a hang — the login button spins, the overview
skeletons sit there, and the honest reading is "it's broken". Testers who have
not been warned will report it as a bug, once each. It is worth a sentence in
whatever message ships the link:

> First load after a quiet spell takes up to a minute while the server wakes
> up. After that it's normal speed.

An uptime pinger (below) mostly removes this, but not entirely — free instances
can still be recycled, and a pinger frequent enough to prevent every spin-down
is against the spirit of the tier.

**Point an uptime pinger at `GET /api/health`.** It always answers 200
`{ "status": "ok" }`, makes no database call, and is mounted ahead of the body
parsers and the auth middleware, so a ping costs a route match and nothing else.
Do not use `/api/v1/health` for this: it reports Mongo's state, so a cold or
briefly unreachable database turns a keep-alive ping into a 503 and pages you
about a service that is fine.

**Chromium is the memory risk, not the app.** A resident browser is roughly
100–200 MB of the 512, and a render peaks well above idle. If invoices start
failing, the log will say which of the three shapes it was — failed to launch,
died mid-render, or stopped responding — and `services/invoice.ts` classifies
them explicitly so the answer is in the first line of the entry rather than
buried in a stack trace.

`--single-process` looks like the obvious fix and is not: it breaks
`Page.printToPDF` outright, so every invoice fails with `Target closed`. See the
comment on `LAUNCH_ARGS`. The lever that does work is not keeping the browser
resident between renders.

---

## 8. SMS, and going live before the gateway is ready

Customer sign-in is OTP-only. There is no password to fall back on, so an API
that cannot send a text cannot authenticate a single customer.

**In production the API refuses to boot without a gateway.** Not a warning at
startup and a 502 later — it exits, at deploy time, with the fix in the log.
That is deliberate: the mock is chosen automatically whenever no Kavenegar key
is present, so the easiest deployment to create by accident is one that looks
healthy, passes its health check, and fails every login days later.

```
NODE_ENV=production but no SMS gateway is configured.
Customer sign-in is OTP-only, so the API would start, pass its health
check, and then fail every login. Refusing to start instead.
```

### The one-line switch, when credentials arrive

```
SMS_PROVIDER=kavenegar
KAVENEGAR_API_KEY=<key>
KAVENEGAR_SENDER=<line>
```

Strictly, `SMS_PROVIDER` is optional: the presence of `KAVENEGAR_API_KEY` is
itself the signal, so adding the key alone flips it. Set it anyway — an explicit
value is what stops a later "why is this mocked?" investigation.

Restart the API. Nothing else changes: no rebuild, no frontend deploy. The
admin banner disappears on the next `/me`, and `devOtpCode` stops appearing in
responses because it is derived from what the mock returns, not from an env
read at the call site.

One-time codes need an **approved Kavenegar template** named `otp` whose first
token is the code, delivered through `verify/lookup`. Iranian gateways will not
carry an OTP on an ordinary sending line, so `KAVENEGAR_SENDER` is used for the
invoice link and not for codes.

### Launching without it, deliberately

If the demo has to go up before the template is approved:

```
ALLOW_MOCK_SMS_IN_PRODUCTION=true
```

**Understand what this buys and costs.** No texts are sent. The one-time code
comes back in the API response and the sign-in form displays it — so anyone who
knows a customer's mobile number can request a code, read it off their own
screen, and sign in as that customer. OTP stops being authentication.

It is survivable for a closed demo with fake data. It is not survivable the
moment a real customer's transaction history is in the database.

Two things make the state hard to forget: the API prints a boxed warning on
every boot, and the admin shell shows a red banner across the top of every page
(amber in development, where mocking is unremarkable). Both come from the same
`insecureOtp` flag on `/api/admin/auth/me`.

---

## 9. Limits to watch

Free tiers fail by filling up quietly rather than by breaking loudly. Two
ceilings are worth a calendar reminder rather than an alert.

**Atlas free tier: 512 MB.** Transactions and customers are small documents, so
the ceiling is months or years away at a single shop's volume — but it is a hard
stop, not a throttle: writes start failing once it is reached. Check it
occasionally rather than waiting to be surprised.

```bash
mongosh "$MONGO_URI" --quiet --eval 'const s=db.stats(); print((s.dataSize/1048576).toFixed(1)+" MB data, "+(s.storageSize/1048576).toFixed(1)+" MB storage")'
```

The two things that actually grow are `transactions` (one document per sale,
with its payments embedded) and `otprequests`. The latter is self-limiting —
the model carries a TTL index, so codes expire out on their own.

**Cloudinary free tier: 25 GB storage / 25 GB monthly bandwidth.** Every render
uploads a *new* asset and the superseded one is left in place on purpose, so a
transaction re-rendered after each of four payments leaves five PDFs. At a few
hundred KB each this is not a near-term problem, but nothing prunes it. If it
ever matters, the old assets are identifiable: `invoicePdfUrl` on the
transaction names the current one, and everything else under
`g-dash/invoices/` with the same `INV-` prefix is superseded.

---

## 10. Verify

```bash
curl -fsS https://shop.example.com/api/v1/health
```

Then, in a browser: sign in at `/admin/login`, open `/admin/overview`, and
record a transaction. The last one exercises the whole chain — Mongo write,
Chromium render, SMS send — and is the fastest way to catch a missing browser or
a bad gateway key. The invoice link in the success panel should open a PDF.

---

## Backups

The database is the only thing that matters; everything else is rebuildable.
Invoices live in Cloudinary and every one of them can be re-rendered from its
transaction, so they need no separate backup — losing them costs the *old* SMS
links, not the records.

```bash
mongodump --uri "$MONGO_URI" --archive=g-dash-$(date +%F).gz --gzip
```
