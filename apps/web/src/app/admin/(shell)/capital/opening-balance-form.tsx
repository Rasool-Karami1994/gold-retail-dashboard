"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  CardContent,
  CurrencyInput,
  toast,
} from "@/components/ui";
import { ApiError } from "@/lib/api";
import {
  capitalKeys,
  saveShopSettings,
  type ShopSettings,
} from "@/lib/capital-api";
import { formatGrams, formatToman, formatTomanInWords } from "@/lib/format";
import { toApiDate } from "@/lib/jalali";
import { toNumber } from "@/lib/numbers";
import { JalaliDateField } from "./jalali-date-field";

interface Fields {
  openingGoldGrams: string;
  openingCashToman: string;
  openingDate: Date | null;
}

interface Errors {
  openingGoldGrams?: string;
  openingCashToman?: string;
  openingDate?: string;
}

export function OpeningBalanceForm({
  settings,
  onSaved,
  onCancel,
  submitLabel,
}: {
  settings: ShopSettings | null;
  onSaved?: (settings: ShopSettings) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const queryClient = useQueryClient();

  const [fields, setFields] = React.useState<Fields>(() => ({
    openingGoldGrams: settings ? String(settings.openingGoldGrams) : "",
    openingCashToman: settings ? String(settings.openingCashToman) : "",
    openingDate: settings ? new Date(settings.openingDate) : null,
  }));
  const [errors, setErrors] = React.useState<Errors>({});

  const mutation = useMutation({
    mutationFn: saveShopSettings,
    onSuccess: (saved) => {
      queryClient.setQueryData(capitalKeys.settings(), {
        configured: true,
        settings: saved,
      });
      queryClient.invalidateQueries({ queryKey: capitalKeys.all });

      toast.success(
        settings ? "موجودی اولیه به‌روزرسانی شد." : "موجودی اولیه ثبت شد.",
        { description: "همه‌ی ارقام بر اساس مقدار تازه محاسبه شدند." },
      );
      onSaved?.(saved);
    },
    onError: (error) => {
      const status = error instanceof ApiError ? error.status : 0;
      toast.error(
        status === 400
          ? "مقادیر واردشده معتبر نیست."
          : status === 401 || status === 403
            ? "دسترسی شما منقضی شده است. دوباره وارد شوید."
            : "ثبت موجودی اولیه انجام نشد. دوباره تلاش کنید.",
      );
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const grams = toNumber(fields.openingGoldGrams);
    const cash = toNumber(fields.openingCashToman);
    const next: Errors = {};

    if (!Number.isFinite(grams)) next.openingGoldGrams = "وزن طلای اولیه را وارد کنید.";
    else if (grams < 0) next.openingGoldGrams = "وزن نمی‌تواند منفی باشد.";

    if (!Number.isFinite(cash)) next.openingCashToman = "موجودی نقدی اولیه را وارد کنید.";
    else if (cash < 0) next.openingCashToman = "موجودی نمی‌تواند منفی باشد.";

    if (!fields.openingDate) next.openingDate = "تاریخ شروع را انتخاب کنید.";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    mutation.mutate({
      openingGoldGrams: grams,
      openingCashToman: cash,
      openingDate: toApiDate(fields.openingDate!),
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {settings && <RecalculationWarning settings={settings} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <CurrencyInput
          label="موجودی طلای اولیه (گرم)"
          value={fields.openingGoldGrams}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, openingGoldGrams: value }))
          }
          showWords={false}
          decimal
          error={errors.openingGoldGrams}
          placeholder="۱۰۰۰"
          hint="وزن طلای فیزیکی موجود در روز شروع"
        />

        <CurrencyInput
          label="موجودی نقدی اولیه (تومان)"
          value={fields.openingCashToman}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, openingCashToman: value }))
          }
          error={errors.openingCashToman}
          placeholder="۰"
        />

        <JalaliDateField
          label="تاریخ شروع"
          value={fields.openingDate}
          onChange={(value) =>
            setFields((previous) => ({ ...previous, openingDate: value }))
          }
          error={errors.openingDate}
          maxDate={new Date()}
          hint="معاملات پیش از این تاریخ در محاسبه لحاظ نمی‌شوند."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={mutation.isPending}>
          {submitLabel ?? (settings ? "ذخیره تغییرات" : "ثبت موجودی اولیه")}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            انصراف
          </Button>
        )}
      </div>
    </form>
  );
}

function RecalculationWarning({ settings }: { settings: ShopSettings }) {
  return (
    <div className="flex gap-3 rounded-md border border-warning/40 bg-warning/8 p-4">
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-warning">
        <svg
          className="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M12 9v4m0 4h.01" />
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </span>
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-medium text-fg">
          تغییر موجودی اولیه، همه‌ی ارقام گذشته را دوباره محاسبه می‌کند.
        </p>
        <p className="text-fg-secondary">
          سرمایه در هر لحظه از روی همین اعداد و معاملات ثبت‌شده حساب می‌شود؛
          بنابراین ویرایش آن نمودار و آمار همه‌ی بازه‌های گذشته را هم تغییر
          می‌دهد. مقدار فعلی:{" "}
          <span className="font-medium text-fg">
            {formatGrams(settings.openingGoldGrams)} گرم
          </span>{" "}
          و{" "}
          <span className="font-medium text-fg">
            {formatToman(settings.openingCashToman)} تومان
          </span>
          {formatTomanInWords(settings.openingCashToman)
            ? ` (${formatTomanInWords(settings.openingCashToman)})`
            : ""}
          .
        </p>
      </div>
    </div>
  );
}

export function OpeningBalanceSetup() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-fg">
            نقطه‌ی شروع سرمایه را مشخص کنید
          </h2>
          <p className="text-sm text-fg-secondary">
            سرمایه بر مبنای طلا یعنی «الان چند گرم می‌ارزم» — و این عدد بدون
            دانستن نقطه‌ی شروع معنایی ندارد. موجودی طلا و نقد شما در روزی که
            حساب‌ها از آن روز به بعد در این سامانه ثبت شده‌اند را وارد کنید.
          </p>
        </div>

        <OpeningBalanceForm settings={null} />
      </CardContent>
    </Card>
  );
}
