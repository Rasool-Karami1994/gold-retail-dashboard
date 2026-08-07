import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Origin the /api proxy forwards to, e.g. https://g-dash-api.onrender.com.
 *
 * NOT prefixed with NEXT_PUBLIC_, deliberately. The browser must never learn
 * the backend's real origin -- the whole point of the proxy is that every
 * request the browser makes is same-origin, so the session cookie is
 * first-party. A NEXT_PUBLIC_ value would be compiled into the bundle and
 * invite calling the backend directly, which puts the cookie back on a
 * third-party domain and undoes the fix.
 *
 * Read where `rewrites()` is evaluated, which is BUILD time -- Next compiles
 * the result into .next/routes-manifest.json. Changing it needs a rebuild, not
 * a restart.
 */
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Proxy /api/* to the backend so it is same-origin from the browser.
   *
   * WHY. The frontend is on Vercel and the API on Render: different registrable
   * domains. The API can set a cross-site cookie with `SameSite=None` and the
   * browser will attach it to XHRs, but the browser files that cookie under the
   * API's host -- so the Vercel origin never sees it. `src/middleware.ts` reads
   * the cookie directly to decide which page to render, so it would treat every
   * signed-in visitor as signed out and bounce them to login in a loop, while
   * the API happily authenticated the same person's fetches.
   *
   * Routing through this origin removes the problem instead of working around
   * it: the cookie is first-party, `SameSite=Lax` is enough, and the middleware
   * needs no changes.
   *
   * The cost is a hop -- browser to Vercel's edge to Render -- on every call.
   * Custom domains on a shared parent (app.example.com + api.example.com with
   * COOKIE_DOMAIN=.example.com) reach the same place without it; see DEPLOY.md
   * section 6.
   *
   * Returns nothing when the variable is unset, which is local dev and Docker
   * Compose: there the browser reaches the API directly and both are already
   * the same site.
   */
  async rewrites() {
    if (!apiProxyTarget) return [];

    return [
      {
        // Everything the Express app serves already lives under /api --
        // /api/admin/*, /api/customer/*, /api/v1/* and /api/health -- so one
        // rule covers all of it and the path passes through untouched.
        //
        // This app has no route handlers of its own, so nothing is shadowed.
        // Adding an app/api/**/route.ts later would need a narrower source
        // here, because a rewrite takes precedence over a route handler.
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },

  /**
   * Standalone output, for the Docker image only.
   *
   * `output: "standalone"` emits a self-contained server plus the traced subset
   * of node_modules, which is what keeps apps/web/Dockerfile small -- the
   * alternative is shipping the whole pnpm store. It is gated on an env var
   * rather than set unconditionally because `next start` refuses to serve a
   * standalone build, and `pnpm start` at the repo root runs exactly that. A
   * hard-coded value here would break the host workflow to suit the container.
   */
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,

  /**
   * Trace from the repo root, not apps/web.
   *
   * In a pnpm workspace the real files live in the root `node_modules/.pnpm`
   * store and are symlinked into apps/web/node_modules. Left to itself Next
   * infers the tracing root from the lockfile it finds, and anything resolved
   * above apps/web is dropped from the standalone bundle -- the image then
   * builds cleanly and dies at boot on a missing module. Setting it explicitly
   * also fixes the output layout: server.js lands at apps/web/server.js inside
   * .next/standalone, which is the path the Dockerfile's CMD uses.
   */
  outputFileTracingRoot: join(here, "../.."),
};

export default nextConfig;
