import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDashboardStats, useOrders, useUpdateOrderStatus } from "@/hooks/queries";
import { can } from "@/lib/permissions";
import { formatCurrency } from "@/lib/format";
import { ORDER_FLOW } from "@/lib/orderStatus";
import { useAuth } from "@/providers/AuthProvider";
import type { Order, OrderStatus } from "@/types";
import { OrderCard } from "@/components/orders/OrderCard";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Alert, EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { Pagination } from "@/components/ui/Pagination";

const LIMIT = 12;

export default function DashboardPage() {
  const { user } = useAuth();
  const stats = useDashboardStats();
  const [status, setStatus] = useState<OrderStatus | "All">("Pending");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const filters = useMemo(
    () => ({ status, page, limit: LIMIT, search: appliedSearch }),
    [status, page, appliedSearch],
  );

  const orders = useOrders(filters);
  const updateStatus = useUpdateOrderStatus();

  const [pendingAction, setPendingAction] = useState<{
    order: Order;
    status: OrderStatus;
  } | null>(null);

  const canUpdate = can(user, "orders.update");
  const canCancel = can(user, "orders.cancel");

  const confirmAction = async () => {
    if (!pendingAction) return;
    try {
      await updateStatus.mutateAsync({
        id: pendingAction.order.id,
        status: pendingAction.status,
      });
    } catch {
      /* error banner below */
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-stone-900">Restaurant dashboard</h1>
        <p className="text-sm text-stone-500">
          New orders and status updates, live from the kitchen.
        </p>
      </header>

      {updateStatus.isError && (
        <Alert kind="error">
          {(updateStatus.error as Error).message ||
            "Could not update the order status. Please try again."}
        </Alert>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Today's orders"
          value={stats.data ? String(stats.data.todayOrders) : "—"}
          icon="🧾"
        />
        <StatCard
          label="Today's revenue"
          value={stats.data ? formatCurrency(stats.data.todayRevenue) : "—"}
          icon="💰"
        />
        <StatCard
          label="Awaiting action"
          value={stats.data ? String(stats.data.pendingOrders) : "—"}
          icon="🔔"
          highlight
        />
        <StatCard
          label="Unpaid amount"
          value={stats.data ? formatCurrency(stats.data.unpaidAmount) : "—"}
          icon="⚠️"
        />
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(["All", ...ORDER_FLOW] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setStatus(option as OrderStatus | "All");
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                  status === option
                    ? "bg-brand-600 text-white"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {option}
              </button>
            ))}
            <Link
              to="/orders"
              className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-stone-600 transition hover:bg-stone-200"
            >
              Full history
            </Link>
          </div>

          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setAppliedSearch(search.trim());
              setPage(1);
            }}
          >
            <input
              className="input sm:w-56"
              placeholder="Order #, table, customer"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="submit" className="btn-ghost">
              Search
            </button>
          </form>
        </div>

        {orders.isLoading ? (
          <Spinner label="Loading orders" />
        ) : orders.isError ? (
          <div className="p-4">
            <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
          </div>
        ) : !orders.data?.items.length ? (
          <div className="p-4">
            <EmptyState
              title="No orders here"
              description={
                status === "Pending"
                  ? "Nothing waiting for approval. New orders appear here automatically."
                  : "Try a different status filter."
              }
            />
          </div>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {orders.data.items.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                canUpdate={canUpdate}
                canCancel={canCancel}
                busy={
                  updateStatus.isPending && pendingAction?.order.id === order.id
                }
                onStatusChange={(target, next) => setPendingAction({ order: target, status: next })}
              />
            ))}
          </div>
        )}

        {orders.data && (
          <Pagination
            page={orders.data.page}
            totalPages={orders.data.totalPages}
            total={orders.data.total}
            limit={orders.data.limit}
            onPageChange={setPage}
          />
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={
          pendingAction?.status === "Cancelled" ? "Cancel this order?" : "Update order status"
        }
        message={
          pendingAction
            ? `Order #${pendingAction.order.orderNumber} will be marked as ${pendingAction.status}.`
            : ""
        }
        confirmLabel={pendingAction?.status === "Cancelled" ? "Cancel order" : "Confirm"}
        destructive={pendingAction?.status === "Cancelled"}
        loading={updateStatus.isPending}
        onConfirm={confirmAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`card p-4 ${
        highlight ? "border-brand-300 bg-brand-50/60" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          {label}
        </p>
        <span aria-hidden className="text-lg">
          {icon}
        </span>
      </div>
      <p className="mt-1 text-2xl font-extrabold text-stone-900">{value}</p>
    </div>
  );
}
