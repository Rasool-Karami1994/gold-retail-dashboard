import Link from "next/link";
import { buttonStyles, PageHeader } from "@/components/ui";
import { CustomersTable } from "./customers-table";
import { CUSTOMERS_NEW } from "./routes";

/**
 * Customer directory.
 *
 * A server component around one client section, matching /admin/overview: the
 * heading and the "add" affordance are static, and only the table needs the
 * search state and the query.
 */
export default function CustomersPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        eyebrow="پنل مدیریت"
        title="مشتریان"
        description="فهرست مشتریان به همراه تعداد معاملات و مجموع خرید و فروش."
        actions={
          <Link href={CUSTOMERS_NEW} className={buttonStyles()}>
            <PlusIcon />
            افزودن مشتری
          </Link>
        }
      />

      <CustomersTable />
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
