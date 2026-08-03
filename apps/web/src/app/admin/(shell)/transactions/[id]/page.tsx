import { SectionPlaceholder } from "../../_placeholder";

/**
 * Invoice detail -- not built yet.
 *
 * It exists because the list's "جزئیات" action links here, and a link into a
 * 404 reads as a broken app rather than an unfinished one. Same reasoning as
 * the other placeholders; see _placeholder.tsx.
 */
export default function TransactionDetailPage() {
  return (
    <SectionPlaceholder
      eyebrow="فاکتورها"
      title="جزئیات فاکتور"
      description="مشخصات معامله، فهرست پرداخت‌ها و لینک فاکتور PDF."
      endpoint="GET /api/admin/transactions/:id"
    />
  );
}
