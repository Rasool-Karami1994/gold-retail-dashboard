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
          hint="بخشی از شماره هم کافی است، مثلاً ۰۰۰۷"
          placeholder="INV-…"
          dir="ltr"
        />

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium text-fg-secondary">
            بازه‌ی زمانی
          </legend>

          <div className="flex flex-wrap items-center gap-3">
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
