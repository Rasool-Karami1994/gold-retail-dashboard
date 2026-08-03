import { SectionPlaceholder } from "../_placeholder";

export default function TransactionsPage() {
  return (
    <SectionPlaceholder
      eyebrow="پنل مدیریت"
      title="فاکتورها"
      description="همه‌ی معاملات، با فیلتر بر اساس مشتری، شماره فاکتور، تاریخ و وضعیت."
      endpoint="GET /api/admin/transactions"
    />
  );
}
