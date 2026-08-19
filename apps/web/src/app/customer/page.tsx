import { redirect } from "next/navigation";
import { CUSTOMER_TRANSACTIONS } from "./routes";

export default function CustomerIndexPage() {
  redirect(CUSTOMER_TRANSACTIONS);
}
