import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";

/**
 * Compatibility stub. Customer sign-in moved from /login to the site root.
 *
 * It is not merely tidiness: without this, an old link would 404 for anyone who
 * is signed in. The middleware lets a customer through to any non-admin path,
 * so `/login` would resolve to nothing at all -- and a returning visitor who
 * signed in via `/?next=/login` would land on that 404 the moment it worked.
 *
 * Listed in PUBLIC_PATHS so a signed-out visitor reaches this redirect directly
 * instead of bouncing through `/?next=/login`.
 */
export default function LegacyLoginPage() {
  redirect(ROUTES.customerLogin);
}
