import { MyTransactionDetail } from "./transaction-detail";

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
