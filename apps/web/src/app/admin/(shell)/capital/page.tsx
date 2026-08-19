import { PageHeader } from "@/components/ui";
import { CapitalScreen } from "./capital-screen";

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
