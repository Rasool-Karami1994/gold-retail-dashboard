import { PageHeader } from "@/components/ui";
import { CapitalScreen } from "./capital-screen";

/**
 * Capital measured in grams of gold.
 *
 * A gold shop's position is metal, not currency: the gold in the safe plus
 * whatever its cash, receivables and payables come to at the day's rate. A
 * server component composing one client screen, matching /admin/overview.
 */
export default function AdminCapitalPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        eyebrow="پنل مدیریت"
        title="مدیریت سرمایه بر مبنای طلا"
        description="سرمایه‌ی مغازه بر حسب گرم طلا؛ شامل طلای فیزیکی، معادل گرمی نقد، طلب‌ها و بدهی‌ها."
      />

      <CapitalScreen />
    </div>
  );
}
