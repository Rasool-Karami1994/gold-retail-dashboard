# Deploying g-dash

Two processes and a database. `apps/api` is a long-running Express server;
`apps/web` is a Next.js server (not a static export — it has middleware and
server components). Both need to be reachable by the browser, and the API
additionally needs to be reachable **from a customer's phone**, because the
invoice link it texts points at itself.

---

## 1. Prerequisites

| Thing | Why |
| --- | --- |
| Node 20+ and pnpm 9 | The workspace pins pnpm in `packageManager`. |
| MongoDB 6+ | Atlas or self-hosted. |
| Chrome or Chromium on the API host | Invoices are rendered by `puppeteer-core`, which drives an **already installed** browser rather than downloading one. |
| A Kavenegar account | An API key, a sending line, and an approved template named `otp`. |

### The Chromium requirement

`puppeteer-core` is deliberate: the full `puppeteer` package downloads its own
Chromium at install time, and Google's CDN returns 403 from some regions —
including Iran — which fails the install outright.

Install a browser and point at it if auto-detection misses:

```bash
apt-get install -y chromium            # Debian/Ubuntu
# then, in apps/api/.env
CHROME_EXECUTABLE_PATH=/usr/bin/chromium
```

Auto-detection covers the usual Linux, macOS and Windows locations — see
`findChrome()` in `apps/api/src/services/invoice.ts`.

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

- **Set the working directory to the repo root.** `INVOICE_STORAGE_DIR` is
  resolved relative to the API's own root, and `.env` is read from
  `apps/api/`.
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

### Different hosts (Vercel + Render)

Set `ALLOWED_ORIGIN` to the web app's exact origin — scheme, host, port, no
trailing slash — and `NODE_ENV=production` on the API. That combination makes
CORS echo the origin back with `Access-Control-Allow-Credentials: true` and
switches the session cookie to `SameSite=None; Secure`, which is what lets the
browser attach it to a cross-site request at all. Both sides must be HTTPS;
`SameSite=None` without `Secure` is rejected outright.

Vercel gives each branch its own hostname, so preview deployments are separate
origins. `ALLOWED_ORIGIN` takes a comma-separated list:

```
ALLOWED_ORIGIN=https://app.example.com,https://app-git-dev-you.vercel.app
```

**That is not sufficient on its own.** CORS governs whether the browser will
send the cookie *to the API* and hand your code the response. It does nothing
about which origin can *read* the cookie: the browser files it under the API's
host, so `app.vercel.app` never sees it.

`apps/web/src/middleware.ts` reads that cookie directly to decide which page to
render. On unrelated domains it sees nothing, treats every visitor as signed
out, and bounces them back to the login page in a loop — while the API happily
authenticates the same user's XHRs.

So the two apps need a shared registrable domain:

| | |
| --- | --- |
| `api.example.com` (Render) | `COOKIE_DOMAIN=.example.com` |
| `app.example.com` (Vercel) | `ALLOWED_ORIGIN=https://app.example.com` |

Both are custom domains; the free `*.onrender.com` and `*.vercel.app`
hostnames cannot work this way, because they are different registrable domains
and the public suffix list forbids a cookie scoped to `.vercel.app`.

If you must ship on the free hostnames, the middleware has to stop gating on
the cookie and let the API's 401s drive redirects from the client instead. No
data is exposed either way — the middleware is a redirect layer and the API
re-checks every request — but the guard has to be rewritten rather than
configured.

---

## 7. Invoice PDFs

Invoices are written to `INVOICE_STORAGE_DIR` (default `uploads/invoices`) and
served by the API itself at `/api/invoices/:filename`.

> **On Render, this directory does not survive a deploy.** The default
> filesystem is ephemeral and is rebuilt on every deploy and restart. The PDFs
> disappear; the links already texted to customers start answering 404; and
> nothing in the app notices, because `invoicePdfUrl` is still recorded on the
> transaction. Attach a Render disk and point `INVOICE_STORAGE_DIR` at its
> mount path before going live. `POST /api/admin/transactions/:id/invoice`
> re-renders one invoice at a time, which is a recovery tool, not a migration.
>
> The `CLOUDINARY_*` variables in `.env.example` are reserved for moving this
> to an object store. Nothing reads them yet — `services/invoice.ts` still
> writes to disk.

**They are served by the API on purpose, not by the proxy.** The route sets
`Content-Disposition`, checks the filename against a strict pattern, and
resolves the path so `..` cannot escape the directory. Pointing nginx straight
at the folder would skip all three.

That route is **public** by design: customers open these links from an SMS with
no account, so the unguessable filename is the credential. If you front it with
a CDN, do not cache aggressively — the same invoice is re-rendered under a new
filename when a payment is recorded.

Two operational notes:

- **Put the directory on a volume that survives deploys.** The URL is stored on
  the transaction; wiping the folder breaks links already sent by SMS. If a file
  does go missing, `POST /api/admin/transactions/:id/invoice` re-renders it and
  repoints the record without re-texting the customer.
- **Nothing prunes it.** Every render writes a new file and keeps the old one so
  already-sent links keep working. It grows without bound — see the note in
  CLAUDE.md; a cleanup job is still outstanding.

---

## 8. Verify

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
`uploads/invoices` is worth backing up too, but only to keep old SMS links alive
— every invoice can be re-rendered from its transaction.

```bash
mongodump --uri "$MONGO_URI" --archive=g-dash-$(date +%F).gz --gzip
```
