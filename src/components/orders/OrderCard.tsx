import { Link } from "react-router-dom";
import { formatCurrency, timeAgo } from "@/lib/format";
import { nextStatus, nextStatusLabel } from "@/lib/orderStatus";
import type { Order } from "@/types";
import { PaymentBadge, StatusBadge } from "@/components/ui/Badge";

interface OrderCardProps {
  order: Order;
  canUpdate: boolean;
  canCancel: boolean;
  busy: boolean;
  onStatusChange: (order: Order, status: Order["status"]) => void;
}

export function OrderCard({ order, canUpdate, canCancel, busy, onStatusChange }: OrderCardProps) {
  const actionLabel = canUpdate ? nextStatusLabel(order.status) : null;
  const next = nextStatus(order.status);
  const isUrgent = order.status === "Pending" || order.status === "Accepted";

  return (
    <article
      className={`card animate-slide-in overflow-hidden ${
        isUrgent ? "border-brand-300 ring-1 ring-brand-100" : ""
      }`}
    >
      <header className="flex items-start justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <div>
          <p className="text-base font-bold text-stone-900">
            Order #{order.orderNumber}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">
            {order.tableNumber ? `Table ${order.tableNumber}` : order.orderType}
            {" · "}
            {timeAgo(order.placedAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={order.status} />
          <PaymentBadge status={order.paymentStatus} />
        </div>
      </header>

      <div className="px-4 py-3">
        <ul className="space-y-1.5">
          {order.items?.length ? (
            order.items.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-stone-700">
                  <span className="font-semibold">{item.name}</span>
                  <span className="ml-1.5 text-stone-500">× {item.quantity}</span>
                </span>
                <span className="shrink-0 text-stone-500">
                  {formatCurrency(item.price * item.quantity)}
                </span>
              </li>
            ))
          ) : (
            <li className="text-sm text-stone-400">No items</li>
          )}
        </ul>

        {order.notes && (
          <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
            <span className="font-semibold">Note:</span> {order.notes}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-dashed border-stone-200 pt-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Total
          </span>
          <span className="text-lg font-bold text-stone-900">
            {formatCurrency(order.totalAmount)}
          </span>
        </div>
      </div>

      <footer className="flex items-center gap-2 border-t border-stone-100 bg-stone-50/60 px-4 py-3">
        {actionLabel && next ? (
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={() => onStatusChange(order, next)}
            disabled={busy}
          >
            {busy ? "Updating…" : actionLabel}
          </button>
        ) : (
          <span className="flex-1 text-xs text-stone-400">
            {order.status === "Completed" ? "Order closed" : "No further action"}
          </span>
        )}

        {canCancel && (order.status === "Pending" || order.status === "Accepted") && (
          <button
            type="button"
            className="btn-ghost text-red-600 hover:bg-red-50"
            onClick={() => onStatusChange(order, "Cancelled")}
            disabled={busy}
          >
            Cancel
          </button>
        )}

        <Link to={`/orders/${order.id}`} className="btn-ghost">
          Details
        </Link>
      </footer>
    </article>
  );
}
