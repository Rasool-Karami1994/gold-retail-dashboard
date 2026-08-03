import { SectionPlaceholder } from "../_placeholder";

export default function CustomersPage() {
  return (
    <SectionPlaceholder
      eyebrow="پنل مدیریت"
      title="مشتریان"
      description="فهرست مشتریان به همراه تعداد معاملات و مجموع خرید و فروش."
      endpoint="GET /api/admin/customers"
    />
  );
}
