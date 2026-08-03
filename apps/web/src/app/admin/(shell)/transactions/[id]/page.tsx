import { TransactionDetail } from "./transaction-detail";

/**
 * One invoice: the deal, its balance, its payments and its PDF.
 *
 * A single request answers all of it, so the whole screen is one client
 * component -- the same reasoning as the customer profile. `params` is a
 * promise in Next 15; awaiting it here keeps the client component taking a
 * plain string.
 */
export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-6 p-6">
      <TransactionDetail id={id} />
    </div>
  );
}
