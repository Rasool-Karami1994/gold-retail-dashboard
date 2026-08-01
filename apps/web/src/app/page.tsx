import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";

/**
 * The middleware redirects `/` before this ever renders -- signed-out visitors
 * to the customer login, customers to their dashboard, admins to the admin
 * overview.
 *
 * This exists as a fallback so that if the middleware is ever bypassed or its
 * matcher changes, `/` still lands somewhere sensible instead of 404ing.
 */
export default function RootPage() {
  redirect(ROUTES.customerLogin);
}
