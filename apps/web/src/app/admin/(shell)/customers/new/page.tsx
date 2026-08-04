import { PageHeader } from "@/components/ui";
import { CUSTOMERS } from "../routes";
import { NewCustomerForm } from "./new-customer-form";

export default function NewCustomerPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        breadcrumbs={[{ label: "مشتریان", href: CUSTOMERS }, { label: "افزودن مشتری" }]}
        eyebrow="پنل مدیریت"
        title="افزودن مشتری"
        description="پس از تأیید شماره‌ی موبایل با کد پیامکی، مشتری ثبت می‌شود."
      />

      <NewCustomerForm />
    </div>
  );
}
