import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { MyTransactionsBrowser } from "./transactions-browser";

/**
 * The customer's default view: their own invoices.
 *
 * The Suspense boundary is not optional -- the browser reads its filters with
 * `useSearchParams`, which opts the route into client rendering and makes Next
 * demand a boundary at build time.
 */
export default function MyTransactionsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        eyebrow="حساب کاربری"
        title="معاملات من"
        description="فهرست خرید و فروش‌های شما، به همراه مانده‌ی هر فاکتور."
      />

      <Suspense fallback={<TableFallback />}>
        <MyTransactionsBrowser />
      </Suspense>
    </div>
  );
}

/** Holds the table's space so the header doesn't jump when the browser mounts. */
function TableFallback() {
  return (
    <div className="h-96 animate-pulse rounded-lg border border-border bg-surface" />
  );
}
