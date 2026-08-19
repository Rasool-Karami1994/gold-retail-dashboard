import { AddPaymentScreen } from "./add-payment-screen";

export default async function AddPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-6 p-6">
      <AddPaymentScreen id={id} />
    </div>
  );
}
