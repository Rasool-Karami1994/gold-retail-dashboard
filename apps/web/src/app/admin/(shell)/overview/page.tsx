import { PageHeader } from "@/components/ui";
import { BalanceSection } from "./balance-section";
import { VolumeAmountSection } from "./volume-amount-section";

export default function AdminOverviewPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        eyebrow="پنل مدیریت"
        title="نمای کلی"
        description="گزارش خرید و فروش در بازه‌ی انتخاب‌شده."
      />

      <VolumeAmountSection />

      <SectionDivider title="مانده حساب‌ها (تومان)" />
      <BalanceSection unit="amount" />

      <SectionDivider title="مانده حساب‌ها (معادل گرم)" />
      <BalanceSection unit="grams" />
    </div>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <h2 className="shrink-0 text-sm font-bold text-fg-secondary">{title}</h2>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}
