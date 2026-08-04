import { MyTransactionDetail } from "./transaction-detail";

/**
 * One of the customer's own invoices. `params` is a promise in Next 15;
 * awaiting it here keeps the client component taking a plain string.
 */
export default async function MyTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-6 p-6">
      <MyTransactionDetail id={id} />
    </div>
  );
}
