import { Suspense } from "react";
import Link from "next/link";
import { PageHeader, buttonStyles } from "@/components/ui";
import { TransactionsBrowser } from "./transactions-browser";

/**
 * Every invoice, filterable.
 *
 * The Suspense boundary is not optional: TransactionsBrowser reads the filters
 * with `useSearchParams`, which opts the route into client rendering and makes
 * Next demand a boundary at build time. Same pattern as the login pages.
 */
export default function TransactionsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        eyebrow="پنل مدیریت"
        title="فاکتورها"
        description="همه‌ی معاملات، با فیلتر بر اساس مشتری، شماره فاکتور و تاریخ."
        actions={
          <Link href="/admin/transactions/new" className={buttonStyles()}>
            <PlusIcon />
            ثبت معامله
          </Link>
        }
      />

      <Suspense fallback={<TableFallback />}>
        <TransactionsBrowser />
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

function PlusIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
