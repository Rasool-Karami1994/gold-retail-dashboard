import { Suspense } from "react";
import CustomerLoginForm from "./login-form";

/**
 * The form reads `?next=` via useSearchParams, which forces a client bailout.
 * Wrapping it in Suspense keeps the shell prerenderable instead of failing the
 * static export.
 */
export default function CustomerLoginPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh" />}>
      <CustomerLoginForm />
    </Suspense>
  );
}
