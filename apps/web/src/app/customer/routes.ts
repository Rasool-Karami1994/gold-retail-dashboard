/**
 * Paths inside the customer area.
 *
 * Same reasoning as the admin sections' own route files: config/routes.ts is
 * the middleware's map of which areas need which session, not an index of every
 * screen. These live here so the sidebar, the table's detail links and the
 * redirects cannot drift apart.
 */

export const CUSTOMER_ROOT = "/customer";
export const CUSTOMER_TRANSACTIONS = `${CUSTOMER_ROOT}/transactions`;
export const CUSTOMER_PROFILE = `${CUSTOMER_ROOT}/profile`;

export const customerTransaction = (id: string) =>
  `${CUSTOMER_TRANSACTIONS}/${id}`;
