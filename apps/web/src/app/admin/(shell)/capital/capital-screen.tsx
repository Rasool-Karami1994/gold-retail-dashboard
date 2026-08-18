"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  CardContent,
  ChartCard,
  ErrorState,
  Modal,
  StatCard,
  formatJalali,
  rangeForPreset,
  type DateRange,
} from "@/components/ui";
import { ApiError } from "@/lib/api";
import {
  capitalKeys,
  fetchCapital,
  fetchShopSettings,
  granularityForRange,
  type CapitalResponse,
} from "@/lib/capital-api";
import {
  formatGrams,
  formatPercent,
  formatToman,
  formatTomanInWords,
} from "@/lib/format";
import { CapitalLine, EstimatedLegend, toChartData } from "./capital-chart";
import { GoldPriceForm } from "./gold-price-form";
import { OpeningBalanceForm, OpeningBalanceSetup } from "./opening-balance-form";

/**
 * Capital measured in grams of gold.
 *
 * Two queries, in sequence rather than in parallel: the series is only asked
 * for once the shop is known to be configured. The API answers 409 for an
 * unconfigured shop, and firing that request anyway would put a failed query
 * behind a screen whose correct state is a setup form, not an error.
 */
export function CapitalScreen() {
  const [range, setRange] = React.useState<DateRange>(() =>
    rangeForPreset("month"),
  );
  const [editing, setEditing] = React.useState(false);

  const settings = useQuery({
    queryKey: capitalKeys.settings(),
    queryFn: fetchShopSettings,
  });

  const configured = settings.data?.configured === true;
  const granularity = granularityForRange(range);

  const capital = useQuery({
    queryKey: capitalKeys.series(range, granularity),
    queryFn: () => fetchCapital(range, granularity),
    enabled: configured,
    /**
     * The range moves as the user clicks through presets; without this the
     * cards and the chart blank out on every click and the page flickers
     * between skeletons instead of updating in place.
     */
    placeholderData: (previous) => previous,
  });

  if (settings.isPending) return <ScreenSkeleton />;

  if (settings.isError) {
    return (
      <Card>
        <CardContent className="py-12">
          <ErrorState
            variant="bare"
            message="اطلاعات سرمایه بارگذاری نشد."
            onRetry={() => settings.refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  // First run: the setup form IS the screen. There is nothing to plot, and a
  // chart of a capital measured from an unknown starting point would be a
  // confident wrong answer rather than a missing one.
  if (!configured) {
    return (
      <>
        <GoldPriceForm />
        <OpeningBalanceSetup />
      </>
    );
  }

  const data = capital.data;

  return (
    <>
      <GoldPriceForm />

      <OpeningPosition
        settings={settings.data!.settings!}
        onEdit={() => setEditing(true)}
      />

      <Figures
        data={data}
        loading={capital.isPending}
        error={capital.isError ? capital.error : null}
        onRetry={() => capital.refetch()}
      />

      <ChartCard
        title="روند سرمایه (گرم)"
        description="ارزش کل مغازه بر حسب گرم طلا در بازه‌ی انتخاب‌شده"
        actions={<EstimatedLegend />}
        range={range}
        onRangeChange={setRange}
        loading={capital.isPending}
        empty={capital.isSuccess && (data?.series.length ?? 0) === 0}
        emptyMessage="برای این بازه داده‌ای نیست. اگر قیمت طلا برای روزهای گذشته ثبت نشده باشد، نقطه‌ای برای رسم وجود ندارد."
        error={capital.isError}
        errorMessage="نمودار سرمایه بارگذاری نشد."
        onRetry={() => capital.refetch()}
        height={320}
      >
        <CapitalLine
          data={toChartData(data?.series ?? [], data?.range.granularity ?? "day")}
        />
      </ChartCard>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="ویرایش موجودی اولیه"
        size="lg"
      >
        <OpeningBalanceForm
          settings={settings.data!.settings!}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    </>
  );
}

/* -------------------------------------------------------------------------- */

/** The starting position every figure on the page is measured from. */
function OpeningPosition({
  settings,
  onEdit,
}: {
  settings: NonNullable<
    NonNullable<Awaited<ReturnType<typeof fetchShopSettings>>["settings"]>
  >;
  onEdit: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-sm font-bold text-fg-secondary">موجودی اولیه</h2>
          <p className="text-xs text-fg-muted">
            <span className="text-fg-secondary">
              {formatGrams(settings.openingGoldGrams)} گرم طلا
            </span>
            {" و "}
            <span className="text-fg-secondary">
              {formatToman(settings.openingCashToman)} تومان نقد
            </span>
            {" از تاریخ "}
            <span className="text-fg-secondary">
              {formatJalali(new Date(settings.openingDate))}
            </span>
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={onEdit}>
          ویرایش موجودی اولیه
        </Button>
      </CardContent>
    </Card>
  );
}

/** `+۱۲٫۵` / `−۳` -- Intl supplies the minus, so only the plus is added. */
function signedGrams(value: number): string {
  return value > 0 ? `+${formatGrams(value)}` : formatGrams(value);
}

function signedPercent(value: number): string {
  return value > 0 ? `+${formatPercent(value)}` : formatPercent(value);
}

function Figures({
  data,
  loading,
  error,
  onRetry,
}: {
  data: CapitalResponse | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const snapshot = data?.snapshot;
  const failed = Boolean(error);

  // A shop with no price on record has a known gold and cash position but no
  // way to express it in grams. That is a specific, fixable state -- "record
  // today's price" -- not a failed request, so it gets its own message.
  const unpriced = Boolean(snapshot) && snapshot!.capitalGrams === null;
  const change = snapshot?.change ?? null;
  const direction = change ? (change.grams >= 0 ? "success" : "danger") : "neutral";

  const notFoundHint =
    error instanceof ApiError && error.status === 409
      ? "موجودی اولیه ثبت نشده است."
      : "بارگذاری این عدد انجام نشد.";

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-2">
        <StatCard
          title="سرمایه فعلی"
          description="مجموع دارایی مغازه بر حسب گرم طلا"
          value={snapshot?.capitalGrams ?? 0}
          format={formatGrams}
          unit="گرم"
          tone="primary"
          loading={loading}
          error={failed || unpriced}
          errorMessage={
            unpriced
              ? "برای محاسبه‌ی سرمایه، ابتدا قیمت روز طلا را ثبت کنید."
              : notFoundHint
          }
          onRetry={failed ? onRetry : undefined}
          hint={
            snapshot?.pricePerGram
              ? `بر مبنای قیمت ${formatToman(snapshot.pricePerGram)} تومان${
                  snapshot.estimated ? " (آخرین قیمت ثبت‌شده)" : " (قیمت امروز)"
                }`
              : undefined
          }
          icon={<GoldIcon />}
        />

        <StatCard
          title="تغییر در بازه"
          description={
            change
              ? `نسبت به ${formatGrams(change.fromCapitalGrams)} گرم در ابتدای بازه`
              : "نسبت به ابتدای بازه‌ی انتخاب‌شده"
          }
          value={change?.grams ?? 0}
          format={signedGrams}
          unit="گرم"
          tone={direction}
          loading={loading}
          error={failed || (Boolean(snapshot) && change === null)}
          errorMessage={
            failed
              ? notFoundHint
              : "برای ابتدای این بازه قیمتی ثبت نشده، پس مبنای مقایسه‌ای وجود ندارد."
          }
          onRetry={failed ? onRetry : undefined}
          hint={
            change?.percent !== null && change?.percent !== undefined
              ? signedPercent(change.percent)
              : undefined
          }
          icon={change && change.grams < 0 ? <TrendDownIcon /> : <TrendUpIcon />}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="طلای فیزیکی"
          value={snapshot?.goldGrams ?? 0}
          format={formatGrams}
          unit="گرم"
          loading={loading}
          error={failed}
          onRetry={onRetry}
          hint="موجودی واقعی صندوق"
        />

        <StatCard
          title="معادل گرمی نقد"
          value={gramsOf(snapshot?.cash, snapshot?.pricePerGram)}
          format={formatGrams}
          unit="گرم"
          loading={loading}
          // Cash with no price to convert it at has an unknown gram value, not
          // a zero one -- and "۰ گرم" beside a hint reading "۶۳۹ میلیون تومان"
          // would be a plain contradiction.
          error={failed || unpriced}
          errorMessage={
            unpriced ? "پس از ثبت قیمت روز محاسبه می‌شود." : notFoundHint
          }
          onRetry={failed ? onRetry : undefined}
          hint={snapshot ? `${formatToman(snapshot.cash)} تومان` : undefined}
        />

        <StatCard
          title="طلب از مشتریان"
          value={snapshot?.receivables ?? 0}
          format={formatToman}
          unit="تومان"
          tone="success"
          loading={loading}
          error={failed}
          onRetry={onRetry}
          hint={snapshot ? formatTomanInWords(snapshot.receivables) : undefined}
        />

        <StatCard
          title="بدهی به مشتریان"
          value={snapshot?.payables ?? 0}
          format={formatToman}
          unit="تومان"
          tone="danger"
          loading={loading}
          error={failed}
          onRetry={onRetry}
          hint={snapshot ? formatTomanInWords(snapshot.payables) : undefined}
        />
      </section>
    </>
  );
}

/** Toman as grams at a price, guarding the price that may not exist yet. */
function gramsOf(amount: number | undefined, pricePerGram: number | null | undefined): number {
  if (!amount || !pricePerGram) return 0;
  return Math.round((amount / pricePerGram) * 1000) / 1000;
}

function ScreenSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-36 animate-pulse rounded-lg bg-surface-raised" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-40 animate-pulse rounded-lg bg-surface-raised" />
        <div className="h-40 animate-pulse rounded-lg bg-surface-raised" />
      </div>
      <div className="h-80 animate-pulse rounded-lg bg-surface-raised" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function GoldIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 4h12l2 5-8 11L4 9Z" />
      <path d="M6 4l2 5h8l2-5M4 9h16M12 20 8 9M12 20l4-11" />
    </svg>
  );
}

function TrendUpIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M17 7h4v4" />
    </svg>
  );
}

function TrendDownIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 7 6 6 4-4 8 8" />
      <path d="M17 17h4v-4" />
    </svg>
  );
}
