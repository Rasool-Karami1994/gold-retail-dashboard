"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Card, CardContent, buttonStyles, toast } from "@/components/ui";
import { formatNumber, formatToman } from "@/lib/format";
import {
  fetchTransaction,
  regenerateInvoice,
  transactionKeys,
  type TransactionDetail,
} from "@/lib/transactions-api";

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 15_000;
const REDIRECT_SECONDS = 8;

export function SuccessPanel({ transaction }: { transaction: TransactionDetail }) {
  const router = useRouter();
  const detailHref = `/admin/transactions/${transaction.id}`;

  const [gaveUp, setGaveUp] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(REDIRECT_SECONDS);
  const [redirecting, setRedirecting] = React.useState(true);

  const { data } = useQuery({
    queryKey: transactionKeys.detail(transaction.id),
    queryFn: () => fetchTransaction(transaction.id),
    refetchInterval: (query) =>
      query.state.data?.invoicePdfUrl || gaveUp ? false : POLL_INTERVAL_MS,
    enabled: !gaveUp,
  });

  const retry = useMutation({
    mutationFn: () => regenerateInvoice(transaction.id),
    onSuccess: () => setGaveUp(false),
  });

  const pdfUrl = retry.data?.url ?? data?.invoicePdfUrl ?? null;

  React.useEffect(() => {
    if (pdfUrl) return;
    const timer = setTimeout(() => setGaveUp(true), POLL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pdfUrl]);

  React.useEffect(() => {
    if (!redirecting) return;

    if (secondsLeft <= 0) {
      router.push(detailHref);
      return;
    }

    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [redirecting, secondsLeft, router, detailHref]);

  return (
    <Card className="w-full max-w-2xl">
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-success/12 text-success"
          >
            <CheckIcon />
          </span>

          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-fg">معامله ثبت شد</h2>
            <p className="text-sm text-fg-muted">
              فاکتور{" "}
              <span className="font-mono text-fg-secondary" dir="ltr">
                {transaction.invoiceNumber}
              </span>{" "}
              به مبلغ {formatToman(transaction.totalAmount)} تومان
              {transaction.status === "settled" ? " (تسویه‌شده)" : " (باز)"}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface-sunken px-4 py-3">
          {pdfUrl ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-fg-secondary">فاکتور PDF آماده است.</span>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setRedirecting(false)}
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                <DownloadIcon />
                مشاهده فاکتور
              </a>
            </div>
          ) : gaveUp ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-warning">
                ساخت فاکتور PDF کامل نشد. معامله ثبت شده است.
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={retry.isPending}
                onClick={() => retry.mutate()}
              >
                ساخت دوباره‌ی فاکتور
              </Button>
            </div>
          ) : (
            <span className="flex items-center gap-2 text-sm text-fg-muted">
              <Spinner />
              در حال آماده‌سازی فاکتور PDF…
            </span>
          )}
        </div>

        {data?.devInvoiceMessage && (
          <DevInvoiceMessage message={data.devInvoiceMessage} />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Link href={detailHref} className={buttonStyles()}>
            مشاهده‌ی معامله
          </Link>

          {redirecting ? (
            <span className="flex items-center gap-2 text-xs text-fg-muted">
              تا {formatNumber(secondsLeft)} ثانیه دیگر به صفحه‌ی معامله می‌روید.
              <button
                type="button"
                onClick={() => setRedirecting(false)}
                className="text-link hover:underline"
              >
                لغو
              </button>
            </span>
          ) : (
            <Link
              href="/admin/transactions/new"
              className={buttonStyles({ variant: "ghost" })}
            >
              ثبت معامله‌ی بعدی
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DevInvoiceMessage({ message }: { message: string }) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("کپی خودکار ممکن نشد", {
        description: "متن را به صورت دستی انتخاب و کپی کنید.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning/8 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-warning">
          پیامکی ارسال نشد (حالت آزمایشی)
        </span>
        <Button type="button" variant="secondary" size="sm" onClick={copy}>
          {copied ? "کپی شد" : "کپی پیام"}
        </Button>
      </div>

      <p className="text-xs text-fg-muted">
        این متن را برای مشتری بفرستید تا فاکتورش را ببیند.
      </p>

      <pre className="overflow-x-auto whitespace-pre-line rounded-md bg-surface-sunken p-3 text-2xs leading-relaxed text-fg-secondary">
        {message}
      </pre>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      className="size-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
