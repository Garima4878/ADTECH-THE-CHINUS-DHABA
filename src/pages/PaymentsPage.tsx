import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { paymentsApi, type PaymentFilters } from "@/lib/endpoints";
import { queryKeys } from "@/hooks/queries";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PAYMENT_STATUSES } from "@/lib/orderStatus";
import type { Paginated, Payment } from "@/types";
import { PaymentBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { Pagination } from "@/components/ui/Pagination";

const METHODS = ["All", "Cash", "UPI", "Card", "NetBanking", "Wallet"];
const LIMIT = 20;

export default function PaymentsPage() {
  const [status, setStatus] = useState<string>("All");
  const [method, setMethod] = useState<string>("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const filters: PaymentFilters = useMemo(
    () => ({ status: status as PaymentFilters["status"], method, from, to, page, limit: LIMIT }),
    [status, method, from, to, page],
  );

  const payments = useQuery<Paginated<Payment>>({
    queryKey: queryKeys.payments(filters),
    placeholderData: (prev) => prev,
    queryFn: ({ signal }) => paymentsApi.list(filters, signal),
  });

  if (payments.isLoading) return <Spinner label="Loading payments" />;
  if (payments.isError)
    return <ErrorState error={payments.error} onRetry={() => payments.refetch()} />;

  const list = payments.data?.items ?? [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-stone-900">Payments</h1>
        <p className="text-sm text-stone-500">
          Settlement records reported by the backend for each order.
        </p>
      </header>

      <section className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="p-status">
            Status
          </label>
          <select
            id="p-status"
            className="input"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            {PAYMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="p-method">
            Method
          </label>
          <select
            id="p-method"
            className="input"
            value={method}
            onChange={(event) => {
              setMethod(event.target.value);
              setPage(1);
            }}
          >
            {METHODS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="p-from">
            From
          </label>
          <input
            id="p-from"
            type="date"
            className="input"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div>
          <label className="label" htmlFor="p-to">
            To
          </label>
          <input
            id="p-to"
            type="date"
            className="input"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </section>

      {!list.length ? (
        <EmptyState title="No payments found" description="Adjust the filters to see settlements." />
      ) : (
        <section className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-2.5">Order</th>
                  <th className="px-4 py-2.5">Table</th>
                  <th className="px-4 py-2.5">Method</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5">Paid at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {list.map((payment) => (
                  <tr key={payment.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      {payment.orderId ? (
                        <Link
                          to={`/orders/${payment.orderId}`}
                          className="font-semibold text-brand-700 hover:underline"
                        >
                          #{payment.orderNumber ?? payment.orderId}
                        </Link>
                      ) : (
                        <span className="font-semibold text-stone-700">
                          #{payment.orderNumber ?? "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {payment.tableNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-stone-600">{payment.method ?? "—"}</td>
                    <td className="px-4 py-3">
                      <PaymentBadge status={payment.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-stone-800">
                      {formatCurrency(payment.paidAmount ?? payment.amount)}
                    </td>
                    <td className="px-4 py-3 text-stone-500">
                      {formatDateTime(payment.paidAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {payments.data && (
            <Pagination
              page={payments.data.page}
              totalPages={payments.data.totalPages}
              total={payments.data.total}
              limit={payments.data.limit}
              onPageChange={setPage}
            />
          )}
        </section>
      )}
    </div>
  );
}
