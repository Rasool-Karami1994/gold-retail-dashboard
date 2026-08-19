import { TransactionDetail } from "./transaction-detail";

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
