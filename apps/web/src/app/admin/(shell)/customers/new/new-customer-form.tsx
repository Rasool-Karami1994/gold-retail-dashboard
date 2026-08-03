"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, buttonStyles, toast } from "@/components/ui";
import { NewCustomerWizard } from "@/components/customers/new-customer-wizard";
import { CUSTOMERS } from "../routes";

/**
 * The screen around the add-customer wizard.
 *
 * The flow itself lives in components/customers/new-customer-wizard.tsx, because
 * the new-transaction form opens the same three steps in a modal when the mobile
 * it looked up belongs to nobody. All this file adds is the page's framing and
 * what happens afterwards -- here, back to the directory.
 */
export function NewCustomerForm() {
  const router = useRouter();

  return (
    <Card className="w-full max-w-xl">
      <CardContent>
        <NewCustomerWizard
          onCreated={(customer) => {
            toast.success("مشتری ثبت شد", {
              description: `${customer.firstName} ${customer.lastName}`.trim(),
            });
            router.push(CUSTOMERS);
          }}
          secondaryAction={
            <Link href={CUSTOMERS} className={buttonStyles({ variant: "ghost" })}>
              انصراف
            </Link>
          }
        />
      </CardContent>
    </Card>
  );
}
