import { useMemo, useState } from "react";
import { useOrders, useUpdateOrderStatus } from "@/hooks/queries";
import { can } from "@/lib/permissions";
import { ORDER_FLOW } from "@/lib/orderStatus";
import { timeAgo } from "@/lib/format";
import { useAuth } from "@/providers/AuthProvider";
import type { Order, OrderStatus } from "@/types";
import { PaymentBadge, StatusBadge } from "@/components/ui/Badge";
import { Alert, EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";

/** Board-style kitchen view: one column per stage, auto-refreshing. */
export default function KitchenPage() {
  const { user } = useAuth();
  const updateStatus = useUpdateOrderStatus();
  const [page] = useState(1);
  const filters = useMemo(() => ({ page, limit: 100 }), [page]);
  const orders = useOrders(filters);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canUpdate = can(user, "orders.update");
  const flow: OrderStatus[] = [...ORDER_FLOW];

  const grouped = flow.map((status) => ({
    status,
    items: (orders.data?.items ?? []).filter(
      (order) => order.status === status && status !== "Completed",
    ),
  }));

  const advance = async (order: Order) => {
    const index = flow.indexOf(order.status);
    const next = flow[index + 1];
    if (!next) return;
    setBusyId(order.id);
    try {
      await updateStatus.mutateAsync({ id: order.id, status: next });
    } catch {
      /* banner */
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Kitchen screen</h1>
          <p className="text-sm text-stone-500">
            Drag-free workflow: tap a ticket to move it to the next stage.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => orders.refetch()}
          disabled={orders.isFetching}
        >
          {orders.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {updateStatus.isError && <Alert kind="error">{(updateStatus.error as Error).message}</Alert>}

      {orders.isLoading ? (
        <Spinner label="Loading kitchen board" />
      ) : orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
      ) : !orders.data?.items.filter((order) => order.status !== "Completed").length ? (
        <EmptyState title="Kitchen is clear" description="No active orders right now." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {grouped
            .filter((group) => group.status !== "Completed")
            .map((group) => (
              <section key={group.status} className="card flex flex-col overflow-hidden">
                <header className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-3 py-2">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-stone-600">
                    {group.status}
                  </h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-stone-600">
                    {group.items.length}
                  </span>
                </header>
                <div className="flex-1 space-y-2 p-3">
                  {group.items.map((order) => (
                    <div key={order.id} className="rounded-lg border border-stone-200 p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-stone-900">
                            #{order.orderNumber}
                          </p>
                          <p className="text-xs text-stone-500">
                            {order.tableNumber ? `Table ${order.tableNumber}` : order.orderType} ·{" "}
                            {timeAgo(order.placedAt)}
                          </p>
                        </div>
                        <PaymentBadge status={order.paymentStatus} />
                      </div>
                      <ul className="mb-2 space-y-1 text-sm text-stone-700">
                        {order.items.map((item) => (
                          <li key={item.id}>
                            <span className="font-semibold">{item.quantity}×</span> {item.name}
                          </li>
                        ))}
                      </ul>
                      <div className="flex items-center justify-between gap-2">
                        <StatusBadge status={order.status} />
                        {canUpdate && (
                          <button
                            type="button"
                            className="btn-primary px-3 py-1.5 text-xs"
                            disabled={busyId === order.id}
                            onClick={() => advance(order)}
                          >
                            {busyId === order.id ? "…" : "Advance"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!group.items.length && (
                    <p className="py-6 text-center text-xs text-stone-400">Empty</p>
                  )}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
