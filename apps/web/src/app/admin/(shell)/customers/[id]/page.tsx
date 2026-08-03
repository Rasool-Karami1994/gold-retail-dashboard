import { SectionPlaceholder } from "../../_placeholder";

/**
 * Customer profile -- not built yet.
 *
 * It exists because the directory's "مشاهده پروفایل" action links here, and a
 * link into a 404 reads as a broken app rather than an unfinished one. Same
 * reasoning as the other placeholders; see _placeholder.tsx.
 */
export default function CustomerProfilePage() {
  return (
    <SectionPlaceholder
      eyebrow="مشتریان"
      title="پروفایل مشتری"
      description="مشخصات مشتری، مجموع خرید و فروش، و تاریخچه‌ی معاملات او."
      endpoint="GET /api/admin/customers/:id"
    />
  );
}
