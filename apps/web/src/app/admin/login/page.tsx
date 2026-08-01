import { Suspense } from "react";
import AdminLoginForm from "./login-form";

/** See the note in app/login/page.tsx -- same useSearchParams bailout. */
export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh" />}>
      <AdminLoginForm />
    </Suspense>
  );
}
