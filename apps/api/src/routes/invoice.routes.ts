import { Router } from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { asyncHandler } from "../middleware/async-handler.js";
import { HttpError } from "../middleware/error-handler.js";
import { INVOICE_DIR, INVOICE_FILENAME_PATTERN } from "../services/invoice.js";

/**
 * Mounted at /api/invoices -- deliberately PUBLIC, no authentication.
 *
 * Customers receive a link by SMS and must be able to open it without an
 * account. That makes the URL itself the credential, which is only sound
 * because the filename carries 128 bits of entropy (see buildFilename in
 * services/invoice.ts). Two things follow, and both matter:
 *
 *   1. The filename is matched against an exact pattern before it touches the
 *      filesystem. Express already decodes %2e%2e and rejects paths that
 *      escape the route, but an allowlist that only admits our own generated
 *      names is the check that does not depend on that behaviour holding.
 *
 *   2. Responses are marked no-store and noindex. A shared cache or a crawler
 *      that reached one of these links would turn a per-customer capability
 *      URL into a public document.
 */
export const invoiceRouter: Router = Router();

invoiceRouter.get(
  "/:filename",
  asyncHandler(async (req, res) => {
    const { filename } = req.params;

    // Allowlist, not a denylist: anything that is not exactly a name we
    // generated is a 404, including "..", absolute paths and null bytes.
    if (!filename || !INVOICE_FILENAME_PATTERN.test(filename)) {
      throw new HttpError(404, "Invoice not found");
    }

    const path = join(INVOICE_DIR, filename);
    if (!existsSync(path)) {
      throw new HttpError(404, "Invoice not found");
    }

    res.type("application/pdf");
    // Guessing filenames is infeasible, but a leaked link should not outlive
    // itself in a proxy cache or a search index.
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    // inline so a phone opens it in the browser's viewer rather than
    // downloading a file the customer then has to find.
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    res.sendFile(path, (error) => {
      // sendFile reports post-header failures here; the response is already
      // committed, so all we can do is log and stop.
      if (error && !res.headersSent) {
        res.status(404).end();
      }
    });
  }),
);
