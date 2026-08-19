import Link from "next/link";
import { buttonStyles, PageHeader } from "@/components/ui";
import { CustomersTable } from "./customers-table";
import { CUSTOMERS_NEW } from "./routes";

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
