import { AddPaymentScreen } from "./add-payment-screen";

/**
 * Recording an instalment against an existing invoice, with the whole deal in
 * view.
 *
 * The counterpart to the create form rather than a dialog: an admin settling a
 * balance wants to see the weight, the rate, what has already been paid and
 * against which card before adding to it. Everything except the new payment is
 * locked, because none of it is editable through this endpoint -- the API takes
 * a payment and nothing else.
 *
 * `params` is a promise in Next 15; awaiting it here keeps the client component
 * taking a plain string, matching the detail page next door.
 */
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
