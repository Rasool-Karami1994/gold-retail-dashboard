import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";

/**
 * Compatibility stub. The customer area moved from the standalone /dashboard
 * placeholder to the /customer route group, which has the sidebar around it.
 *
 * Same reasoning as /login: the middleware lets a customer through to any
 * non-admin path, so leaving nothing here would 404 for exactly the people who
 * are signed in and following an old link.
 */
export default function LegacyDashboardPage() {
  redirect(ROUTES.customerHome);
}
