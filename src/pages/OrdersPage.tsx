import { useMemo, useState } from "react";
import { useOrders, useUpdateOrderStatus } from "@/hooks/queries";
import { can } from "@/lib/permissions";
import { ORDER_STATUSES, ORDER_TYPES, PAYMENT_STATUSES } from "@/lib/orderStatus";
import { toDateInput } from "@/lib/format";
import { useAuth } from "@/providers/AuthProvider";
import type { Order, OrderStatus, PaymentStatus } from "@/types";
import { OrderCard } from "@/components/orders/OrderCard";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Alert, EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { Pagination } from "@/components/ui/Pagination";

const LIMIT = 20;

export default function OrdersPage() {
  const { user } = useAuth();
  const updateStatus = useUpdateOrderStatus();
  const [status, setStatus] = useState<OrderStatus | "All">("All");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "All">("All");
  const [orderType, setOrderType] = useState<string>("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pendingAction, setPendingAction] = useState<{
    order: Order;
    status: OrderStatus;
  } | null>(null);

  const filters = useMemo(
    () => ({ status, paymentStatus, orderType, from, to, search, page, limit: LIMIT }),
    [status, paymentStatus, orderType, from, to, search, page],
  );

  const orders = useOrders(filters);
  const canUpdate = can(user, "orders.update");
  const canCancel = can(user, "orders.cancel");

  const resetPage = () => setPage(1);

  const confirmAction = async () => {
    if (!pendingAction) return;
    try {
      await updateStatus.mutateAsync({
        id: pendingAction.order.id,
        status: pendingAction.status,
      });
    } catch {
      /* banner below */
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-stone-900">Orders</h1>
        <p className="text-sm text-stone-500">
          Full order history with filters. Data comes straight from the backend.
        </p>
      </header>

      {updateStatus.isError && (
        <Alert kind="error">{(updateStatus.error as Error).message}</Alert>
      )}

      <section className="card p-4">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchInput.trim());
            resetPage();
          }}
        >
          <div>
            <label className="label" htmlFor="f-status">
              Status
            </label>
            <select
              id="f-status"
              className="input"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as OrderStatus | "All");
                resetPage();
              }}
            >
              <option value="All">All</option>
              {ORDER_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="f-payment">
              Payment
            </label>
            <select
              id="f-payment"
              className="input"
              value={paymentStatus}
              onChange={(event) => {
                setPaymentStatus(event.target.value as PaymentStatus | "All");
                resetPage();
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
            <label className="label" htmlFor="f-type">
              Order type
            </label>
            <select
              id="f-type"
              className="input"
              value={orderType}
              onChange={(event) => {
                setOrderType(event.target.value);
                resetPage();
              }}
            >
              {ORDER_TYPES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="f-from">
              From
            </label>
            <input
              id="f-from"
              type="date"
              className="input"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                resetPage();
              }}
            />
          </div>

          <div>
            <label className="label" htmlFor="f-to">
              To
            </label>
            <input
              id="f-to"
              type="date"
              className="input"
              max={to ? to : undefined}
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                resetPage();
              }}
            />
          </div>

          <div>
            <label className="label" htmlFor="f-search">
              Search
            </label>
            <div className="flex gap-2">
              <input
                id="f-search"
                className="input"
                placeholder="Order #, table, name"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              <button type="submit" className="btn-ghost">
                Go
              </button>
            </div>
          </div>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            onClick={() => {
              setFrom(toDateInput());
              setTo(toDateInput());
              resetPage();
            }}
          >
            Today
          </button>
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            onClick={() => {
              setStatus("All");
              setPaymentStatus("All");
              setOrderType("All");
              setFrom("");
              setTo("");
              setSearch("");
              setSearchInput("");
              resetPage();
            }}
          >
            Clear filters
          </button>
        </div>
      </section>

      {orders.isLoading ? (
        <Spinner label="Loading orders" />
      ) : orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
      ) : !orders.data?.items.length ? (
        <EmptyState
          title="No matching orders"
          description="Adjust the filters or clear them to see all orders."
        />
      ) : (
        <section className="card overflow-hidden">
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {orders.data.items.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                canUpdate={canUpdate}
                canCancel={canCancel}
                busy={updateStatus.isPending && pendingAction?.order.id === order.id}
                onStatusChange={(target, next) => setPendingAction({ order: target, status: next })}
              />
            ))}
          </div>
          <Pagination
            page={orders.data.page}
            totalPages={orders.data.totalPages}
            total={orders.data.total}
            limit={orders.data.limit}
            onPageChange={setPage}
          />
        </section>
      )}

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
