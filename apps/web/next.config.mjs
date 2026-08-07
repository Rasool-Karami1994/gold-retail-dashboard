import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

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
