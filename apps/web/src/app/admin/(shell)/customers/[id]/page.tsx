import { CustomerDetail } from "./customer-detail";

/**
 * One customer: who they are, what they have traded, and their invoice history.
 *
 * The whole screen is one client component rather than a server page around a
 * client table, because a single request answers all three parts -- the
 * customer, the lifetime totals and a page of transactions. Fetching it on the
 * server would mean either passing the result into a client tree that has to
 * re-fetch anyway when the pager moves, or two requests for one payload.
 *
 * `params` is a promise in Next 15; awaiting it here keeps the client component
 * taking a plain string.
 */
export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-6 p-6">
      <CustomerDetail id={id} />
    </div>
  );
}
