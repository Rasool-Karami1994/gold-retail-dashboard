import { PageHeader } from "@/components/ui";
import { VolumeAmountSection } from "./volume-amount-section";

/**
 * Admin dashboard.
 *
 * A server component that composes client sections. Each section owns its own
 * queries and range state, so adding section 2 (debt/credit) later does not
 * touch this file beyond one more line.
 */
export default function AdminOverviewPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        eyebrow="پنل مدیریت"
        title="نمای کلی"
        description="گزارش خرید و فروش در بازه‌ی انتخاب‌شده."
      />

      <VolumeAmountSection />
    </div>
  );
}
