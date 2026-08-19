"use client";

import * as React from "react";
import {
  Button,
  CurrencyInput,
  DateRangeFilter,
  Modal,
  formatJalaliRange,
  rangeForPreset,
  type DateRange,
} from "@/components/ui";
import { toNumber } from "@/lib/numbers";
import type { CustomerTransactionFilters } from "@/lib/transactions-api";

export function CustomerFiltersModal({
  open,
  onClose,
  value,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  value: CustomerTransactionFilters;
  onApply: (filters: CustomerTransactionFilters) => void;
}) {
  const [range, setRange] = React.useState<DateRange | null>(null);
  const [minAmount, setMinAmount] = React.useState("");
  const [maxAmount, setMaxAmount] = React.useState("");

  React.useEffect(() => {
    if (!open) return;

    setRange(
      value.dateFrom && value.dateTo
        ? { from: value.dateFrom, to: value.dateTo, preset: "custom" }
        : null,
    );
    setMinAmount(value.minAmount !== undefined ? String(value.minAmount) : "");
    setMaxAmount(value.maxAmount !== undefined ? String(value.maxAmount) : "");
  }, [open, value]);

  const min = toNumber(minAmount);
  const max = toNumber(maxAmount);

  const minInvalid = minAmount !== "" && (!Number.isFinite(min) || min < 0);
  const maxInvalid = maxAmount !== "" && (!Number.isFinite(max) || max < 0);
  const reversed =
    !minInvalid && !maxInvalid && Number.isFinite(min) && Number.isFinite(max) && min > max;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (minInvalid || maxInvalid || reversed) return;

    onApply({
      dateFrom: range?.from,
      dateTo: range?.to,
      minAmount: minAmount === "" ? undefined : min,
      maxAmount: maxAmount === "" ? undefined : max,
    });
    onClose();
  };

  const clear = () => {
    setRange(null);
    setMinAmount("");
    setMaxAmount("");
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

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium text-fg-secondary">
            مبلغ کل (تومان)
          </legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <CurrencyInput
              label="از"
              placeholder="0"
              value={minAmount}
              onChange={setMinAmount}
              error={minInvalid ? "عدد معتبر وارد کنید" : undefined}
            />
            <CurrencyInput
              label="تا"
              placeholder="بدون سقف"
              value={maxAmount}
              onChange={setMaxAmount}
              error={
                maxInvalid
                  ? "عدد معتبر وارد کنید"
                  : reversed
                    ? "سقف نباید از کف کمتر باشد"
                    : undefined
              }
            />
          </div>
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
