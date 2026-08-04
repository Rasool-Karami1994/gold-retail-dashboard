"use client";

import * as React from "react";
import {
  Button,
  DateRangeFilter,
  Input,
  Modal,
  formatJalaliRange,
  rangeForPreset,
  type DateRange,
} from "@/components/ui";
import type { TransactionFilters } from "@/lib/transactions-api";

/**
 * The filter form behind the toolbar's "فیلتر" button.
 *
 * It edits a DRAFT and only reports it on submit. Filtering as you type would
 * fire a request per keystroke against an endpoint that resolves customer names
 * to ids before it can even start querying transactions -- and would make
 * "clear the mobile, type a different one" run a search for every intermediate
 * state.
 *
 * The draft is re-seeded from `value` each time the dialog opens, so abandoning
 * an edit with Esc leaves the applied filters untouched rather than carrying a
 * half-typed field into the next visit.
 */
export function TransactionFiltersModal({
  open,
  onClose,
  value,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  value: TransactionFilters;
  onApply: (filters: TransactionFilters) => void;
}) {
  const [customerName, setCustomerName] = React.useState("");
  const [customerMobile, setCustomerMobile] = React.useState("");
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  /** null means "every date", which is the default and NOT what a preset says. */
  const [range, setRange] = React.useState<DateRange | null>(null);

  React.useEffect(() => {
    if (!open) return;

    setCustomerName(value.customerName ?? "");
    setCustomerMobile(value.customerMobile ?? "");
    setInvoiceNumber(value.invoiceNumber ?? "");
    setRange(
      value.dateFrom && value.dateTo
        ? { from: value.dateFrom, to: value.dateTo, preset: "custom" }
        : null,
    );
  }, [open, value]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    onApply({
      // Trimmed, and empty means absent: `transactionQuery` drops falsy values,
      // so a cleared field removes its parameter instead of sending "".
      customerName: customerName.trim() || undefined,
      customerMobile: customerMobile.trim() || undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      dateFrom: range?.from,
      dateTo: range?.to,
    });
    onClose();
  };

  const clear = () => {
    setCustomerName("");
    setCustomerMobile("");
    setInvoiceNumber("");
    setRange(null);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="فیلتر معاملات"
      description="فیلترهای خالی اعمال نمی‌شوند."
    >
      {/* The form owns the footer buttons rather than Modal's `footer` slot, so
          the submit button stays inside the form and Enter still submits. */}
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="نام مشتری"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="بخشی از نام یا نام خانوادگی"
            autoFocus
          />

          <Input
            label="شماره موبایل"
            value={customerMobile}
            onChange={(event) => setCustomerMobile(event.target.value)}
            placeholder="09123456789"
            inputMode="numeric"
            dir="ltr"
          />
        </div>

        <Input
          label="شماره فاکتور"
          value={invoiceNumber}
          onChange={(event) => setInvoiceNumber(event.target.value)}
          // The API matches this as a substring, which is the whole point --
          // staff read the trailing sequence off a printed invoice.
          hint="بخشی از شماره هم کافی است، مثلاً ۰۰۰۷"
          placeholder="INV-…"
          dir="ltr"
        />

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium text-fg-secondary">
            بازه‌ی زمانی
          </legend>

          <div className="flex flex-wrap items-center gap-3">
            {/*
              DateRangeFilter always holds a range -- it has no "off". The
              default here is no date filter at all, so the toggle owns that
              state and the picker only appears once a range is wanted.
            */}
            <label className="flex items-center gap-2 text-sm text-fg-secondary">
              <input
                type="checkbox"
                checked={range !== null}
                onChange={(event) =>
                  setRange(event.target.checked ? rangeForPreset("month") : null)
                }
                className="size-4 accent-primary-500"
              />
              محدود کردن به بازه‌ی زمانی
            </label>

            {range === null && (
              <span className="text-xs text-fg-muted">
                در حال حاضر: همه‌ی تاریخ‌ها
              </span>
            )}
          </div>

          {range !== null && (
            <div className="flex flex-col gap-2">
              <DateRangeFilter value={range} onChange={setRange} size="sm" />
              <p className="text-xs text-fg-muted">
                {formatJalaliRange(range.from, range.to)}
              </p>
            </div>
          )}
        </fieldset>

        <div className="flex items-center gap-3 border-t border-border pt-4">
          <Button type="submit">اعمال فیلتر</Button>
          <Button type="button" variant="ghost" onClick={clear}>
            پاک کردن همه
          </Button>
        </div>
      </form>
    </Modal>
  );
}
