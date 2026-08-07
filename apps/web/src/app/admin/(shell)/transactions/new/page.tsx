import { PageHeader } from "@/components/ui";
import { NewTransactionForm } from "./new-transaction-form";

export default function NewTransactionPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        breadcrumbs={[
          { label: "معاملات", href: "/admin/transactions" },
          { label: "ثبت معامله" },
        ]}
        eyebrow="پنل مدیریت"
        title="ثبت معامله"
        description="با شماره موبایل مشتری شروع کنید؛ باقی فرم پس از انتخاب مشتری باز می‌شود."
      />

      <NewTransactionForm />
    </div>
  );
}
