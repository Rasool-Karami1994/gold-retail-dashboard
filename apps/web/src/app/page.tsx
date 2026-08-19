import { Suspense } from "react";
import CustomerLoginForm from "./customer-login-form";

export default function HomePage() {
  return (
    <Suspense fallback={<main className="min-h-dvh" />}>
      <CustomerLoginForm />
    </Suspense>
  );
}
