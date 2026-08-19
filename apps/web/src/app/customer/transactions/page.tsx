import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { MyTransactionsBrowser } from "./transactions-browser";

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

function TableFallback() {
  return (
    <div className="h-96 animate-pulse rounded-lg border border-border bg-surface" />
  );
}
