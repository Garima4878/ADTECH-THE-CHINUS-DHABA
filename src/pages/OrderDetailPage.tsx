import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMarkOrderPaid, useOrder, useUpdateOrderStatus } from "@/hooks/queries";
import { can } from "@/lib/permissions";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { nextStatusLabel } from "@/lib/orderStatus";
import { useAuth } from "@/providers/AuthProvider";
import type { OrderStatus } from "@/types";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { PaymentBadge, StatusBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Alert, ErrorState, PageLoader } from "@/components/ui/Feedback";

const PAYMENT_METHODS = ["Cash", "UPI", "Card", "NetBanking", "Wallet"];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: order, isLoading, isError, error, refetch } = useOrder(id);
  const updateStatus = useUpdateOrderStatus();
  const markPaid = useMarkOrderPaid();

  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [method, setMethod] = useState("Cash");

  if (isLoading) return <PageLoader label="Loading order" />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!order) return <ErrorState error={new Error("Order not found.")} />;

  const canUpdate = can(user, "orders.update");
  const canCancel = can(user, "orders.cancel");
  const actionLabel = canUpdate ? nextStatusLabel(order.status) : null;
  const flow: OrderStatus[] = ["Pending", "Accepted", "Preparing", "Ready", "Completed"];
  const next = flow.indexOf(order.status) >= 0 ? flow[flow.indexOf(order.status) + 1] : null;

  return (
    <div className="space-y-5">
      <button type="button" onClick={() => navigate(-1)} className="btn-ghost px-3 py-1.5 text-xs">
        ← Back
      </button>

      {updateStatus.isError && <Alert kind="error">{(updateStatus.error as Error).message}</Alert>}
      {markPaid.isError && <Alert kind="error">{(markPaid.error as Error).message}</Alert>}

      <header className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Order #{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {order.tableNumber ? `Table ${order.tableNumber}` : "No table"} ·{" "}
            {order.orderType} · placed {formatDateTime(order.placedAt)}
          </p>
          {(order.customerName || order.customerPhone) && (
            <p className="mt-1 text-sm text-stone-500">
              {order.customerName} {order.customerPhone && `· ${order.customerPhone}`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <StatusBadge status={order.status} />
          <PaymentBadge status={order.paymentStatus} />
        </div>
      </header>

      <OrderTimeline status={order.status} />

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="border-b border-stone-100 px-5 py-3 text-sm font-bold uppercase tracking-wide text-stone-500">
            Items
          </h2>
          <ul className="divide-y divide-stone-100">
            {order.items?.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-stone-800">
                    {item.name}{" "}
                    <span className="text-stone-500">× {item.quantity}</span>
                  </p>
                  {item.notes && <p className="mt-0.5 text-xs text-stone-500">Note: {item.notes}</p>}
                </div>
                <p className="shrink-0 text-sm text-stone-600">
                  {formatCurrency(item.price * item.quantity)}
                </p>
              </li>
            ))}
          </ul>
          <div className="space-y-1 border-t border-stone-100 px-5 py-4 text-sm">
            {(order.discountAmount ?? 0) > 0 && (
              <div className="flex justify-between text-stone-500">
                <span>Discount</span>
                <span>- {formatCurrency(order.discountAmount)}</span>
              </div>
            )}
            {(order.taxAmount ?? 0) > 0 && (
              <div className="flex justify-between text-stone-500">
                <span>Tax</span>
                <span>{formatCurrency(order.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-stone-900">
              <span>Total</span>
              <span>{formatCurrency(order.totalAmount)}</span>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-stone-500">
              Actions
            </h2>
            <div className="space-y-2">
              {actionLabel && next && (
                <button
                  type="button"
                  className="btn-primary w-full"
                  disabled={updateStatus.isPending}
                  onClick={() => setPendingStatus(next)}
                >
                  {updateStatus.isPending ? "Updating…" : actionLabel}
                </button>
              )}
              {canCancel && (order.status === "Pending" || order.status === "Accepted") && (
                <button
                  type="button"
                  className="btn-ghost w-full text-red-600 hover:bg-red-50"
                  disabled={updateStatus.isPending}
                  onClick={() => setPendingStatus("Cancelled")}
                >
                  Cancel order
                </button>
              )}
              {order.paymentStatus !== "Paid" && (
                <button
                  type="button"
                  className="btn-ghost w-full"
                  disabled={markPaid.isPending}
                  onClick={() => setShowPayment((open) => !open)}
                >
                  Mark as paid
                </button>
              )}
              {showPayment && order.paymentStatus !== "Paid" && (
                <div className="space-y-2 rounded-lg bg-stone-50 p-3">
                  <label className="label" htmlFor="method">
                    Payment method
                  </label>
                  <select
                    id="method"
                    className="input"
                    value={method}
                    onChange={(event) => setMethod(event.target.value)}
                  >
                    {PAYMENT_METHODS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-primary w-full"
                    disabled={markPaid.isPending}
                    onClick={async () => {
                      try {
                        await markPaid.mutateAsync({ id: order.id, method });
                        setShowPayment(false);
                      } catch {
                        /* banner */
                      }
                    }}
                  >
                    {markPaid.isPending ? "Saving…" : `Confirm ${method}`}
                  </button>
                </div>
              )}
              <Link to="/orders" className="btn-ghost w-full">
                All orders
              </Link>
            </div>
          </div>

          {order.statusHistory && order.statusHistory.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-stone-500">
                Status history
              </h2>
              <ol className="space-y-3">
                {[...order.statusHistory].reverse().map((entry, index) => (
                  <li key={`${entry.status}-${index}`} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={entry.status} />
                      <span className="text-xs text-stone-400">
                        {formatDateTime(entry.at)}
                      </span>
                    </div>
                    {entry.by && <p className="mt-1 text-xs text-stone-500">by {entry.by}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {order.notes && (
            <div className="card p-5">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">
                Order note
              </h2>
              <p className="text-sm text-stone-600">{order.notes}</p>
            </div>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={Boolean(pendingStatus)}
        title={pendingStatus === "Cancelled" ? "Cancel this order?" : "Update order status"}
        message={
          pendingStatus
            ? `Order #${order.orderNumber} will be marked as ${pendingStatus}.`
            : ""
        }
        confirmLabel={pendingStatus === "Cancelled" ? "Cancel order" : "Confirm"}
        destructive={pendingStatus === "Cancelled"}
        loading={updateStatus.isPending}
        onConfirm={async () => {
          if (!pendingStatus) return;
          try {
            await updateStatus.mutateAsync({ id: order.id, status: pendingStatus });
          } catch {
            /* banner */
          } finally {
            setPendingStatus(null);
          }
        }}
        onCancel={() => setPendingStatus(null)}
      />
    </div>
  );
}
