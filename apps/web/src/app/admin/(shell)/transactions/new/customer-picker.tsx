"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Input, Modal } from "@/components/ui";
import { NewCustomerWizard } from "@/components/customers/new-customer-wizard";
import { customerKeys, findCustomerByMobile } from "@/lib/customers-api";
import { isValidMobile, normalizeMobile } from "@/lib/mobile";

const LOOKUP_DEBOUNCE_MS = 400;

export interface SelectedCustomer {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
}

export function CustomerPicker({
  value,
  onChange,
}: {
  value: SelectedCustomer | null;
  onChange: (customer: SelectedCustomer | null) => void;
}) {
  const [mobile, setMobile] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [wizardOpen, setWizardOpen] = React.useState(false);

  const [offeredFor, setOfferedFor] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(mobile.trim()), LOOKUP_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [mobile]);

  const ready = isValidMobile(debounced);
  const normalized = ready ? normalizeMobile(debounced) : "";

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: customerKeys.byMobile(normalized),
    queryFn: () => findCustomerByMobile(normalized),
    enabled: ready && !value,
  });

  const settled = ready && !isFetching && !isError;
  const found = settled ? data : undefined;
  const missing = settled && data === null;

  React.useEffect(() => {
    if (found) onChange(found);
  }, [found, onChange]);

  React.useEffect(() => {
    if (missing && offeredFor !== normalized) {
      setWizardOpen(true);
      setOfferedFor(normalized);
    }
  }, [missing, offeredFor, normalized]);

  if (value) {
    return (
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-success/40 bg-success/8 px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-fg-muted">مشتری</span>
          <span className="text-sm font-medium text-fg">
            {`${value.firstName} ${value.lastName}`.trim()}
          </span>
          <span className="font-mono text-xs text-fg-secondary" dir="ltr">
            {value.mobile}
          </span>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange(null);
            setMobile("");
            setDebounced("");
            setOfferedFor(null);
          }}
        >
          تغییر مشتری
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="شماره موبایل مشتری"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        dir="ltr"
        placeholder="09123456789"
        value={mobile}
        onChange={(event) => setMobile(event.target.value)}
        hint={
          !mobile || ready
            ? "با شماره موبایل، مشتری پیدا یا ثبت می‌شود."
            : "شماره موبایل ۱۱ رقمی را کامل وارد کنید."
        }
      />

      <div aria-live="polite" className="min-h-5 text-xs">
        {ready && isFetching && (
          <span className="text-fg-muted">در حال جست‌وجو…</span>
        )}

        {isError && (
          <span className="flex items-center gap-2 text-danger">
            جست‌وجوی مشتری انجام نشد.
            <button
              type="button"
              onClick={() => refetch()}
              className="text-link hover:underline"
            >
              تلاش دوباره
            </button>
          </span>
        )}

        {missing && (
          <span className="flex flex-wrap items-center gap-2 text-fg-secondary">
            مشتری‌ای با این شماره ثبت نشده است.
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="text-link hover:underline"
            >
              ثبت مشتری جدید
            </button>
          </span>
        )}
      </div>

      <Modal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        size="lg"
        title="ثبت مشتری جدید"
        description="پس از تأیید شماره با کد پیامکی، مشتری به این معامله اضافه می‌شود."
      >
        <NewCustomerWizard
          key={normalized}
          initialMobile={normalized}
          onCreated={(customer) => {
            onChange({
              id: customer.id,
              firstName: customer.firstName,
              lastName: customer.lastName,
              mobile: customer.mobile,
            });
            setWizardOpen(false);
          }}
          secondaryAction={
            <Button
              type="button"
              variant="ghost"
              onClick={() => setWizardOpen(false)}
            >
              انصراف
            </Button>
          }
        />
      </Modal>
    </div>
  );
}
