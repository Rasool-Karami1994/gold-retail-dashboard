import { Suspense } from "react";
import CustomerLoginForm from "./customer-login-form";

/**
 * The front door: customer sign-in.
 *
 * The middleware only lets a signed-out visitor get this far -- customers are
 * sent to their dashboard and admins to the overview before it renders. So this
 * does not re-check the session; if it renders, there isn't one.
 *
 * The Suspense boundary is not optional: the form reads `?next=` with
 * `useSearchParams`, which opts the route into client rendering and makes Next
 * demand a boundary at build time. Same pattern as /admin/login.
 */
export default function HomePage() {
  return (
    <Suspense fallback={<main className="min-h-dvh" />}>
      <CustomerLoginForm />
    </Suspense>
  );
}
