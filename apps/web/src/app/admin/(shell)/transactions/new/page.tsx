import { SectionPlaceholder } from "../../_placeholder";

export default function NewTransactionPage() {
  return (
    <SectionPlaceholder
      eyebrow="فاکتورها"
      title="ثبت معامله"
      description="ثبت خرید یا فروش طلا برای یک مشتری، به همراه پرداخت‌های اولیه."
      endpoint="POST /api/admin/transactions"
    />
  );
}
