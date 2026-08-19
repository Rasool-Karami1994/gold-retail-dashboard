"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, buttonStyles, toast } from "@/components/ui";
import { NewCustomerWizard } from "@/components/customers/new-customer-wizard";
import { CUSTOMERS } from "../routes";

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
