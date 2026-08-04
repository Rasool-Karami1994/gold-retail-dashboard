import { redirect } from "next/navigation";
import { CUSTOMER_TRANSACTIONS } from "./routes";

/**
 * `/customer` has no page of its own -- transactions are the default view, and
 * sign-in sends people straight there. This exists so the bare path resolves
 * instead of 404ing.
 */
export default function CustomerIndexPage() {
  redirect(CUSTOMER_TRANSACTIONS);
}
