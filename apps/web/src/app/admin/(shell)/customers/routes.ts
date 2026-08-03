/**
 * Paths inside the customers section.
 *
 * Kept out of config/routes.ts on purpose -- that file is the middleware's map
 * of which areas need which session, not an index of every screen. These are
 * here so the list, the header's "add" link and the form's redirect can't drift
 * apart, the same way admin-sidebar.tsx keeps its own transaction constants.
 */

export const CUSTOMERS = "/admin/customers";
export const CUSTOMERS_NEW = `${CUSTOMERS}/new`;

export const customerProfile = (id: string) => `${CUSTOMERS}/${id}`;
