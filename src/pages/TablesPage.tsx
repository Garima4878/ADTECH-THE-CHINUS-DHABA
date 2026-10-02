import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tablesApi } from "@/lib/endpoints";
import { queryKeys } from "@/hooks/queries";
import { can } from "@/lib/permissions";
import { TABLE_STATUS_STYLE } from "@/lib/orderStatus";
import { useAuth } from "@/providers/AuthProvider";
import type { DiningTable, TableStatus } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { Alert, EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";

const STATUSES: TableStatus[] = ["Free", "Occupied", "Reserved", "Cleaning"];

interface FormState {
  id?: string;
  number: string;
  capacity: string;
  isActive: boolean;
}

const EMPTY: FormState = { number: "", capacity: "4", isActive: true };

export default function TablesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can(user, "tables.manage");

  const [filter, setFilter] = useState<TableStatus | "All">("All");
  const [form, setForm] = useState<FormState | null>(null);
  const [deleting, setDeleting] = useState<DiningTable | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const tables = useQuery({ queryKey: queryKeys.tables, queryFn: ({ signal }) => tablesApi.list(signal) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.tables });

  const save = useMutation({
    mutationFn: (state: FormState) => {
      const payload = {
        number: state.number.trim(),
        capacity: Number(state.capacity),
        isActive: state.isActive,
      };
      return state.id ? tablesApi.update(state.id, payload) : tablesApi.create(payload);
    },
    onSuccess: () => {
      invalidate();
      setForm(null);
      setActionError(null);
    },
    onError: (error) => setActionError((error as Error).message),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      tablesApi.updateStatus(id, status),
    onSuccess: invalidate,
    onError: (error) => setActionError((error as Error).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => tablesApi.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
    },
    onError: (error) => setActionError((error as Error).message),
  });

  const list = useMemo(() => {
    const all = tables.data ?? [];
    return filter === "All" ? all : all.filter((table) => table.status === filter);
  }, [tables.data, filter]);

  if (tables.isLoading) return <Spinner label="Loading tables" />;
  if (tables.isError) return <ErrorState error={tables.error} onRetry={() => tables.refetch()} />;

  const all = tables.data ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Tables</h1>
          <p className="text-sm text-stone-500">
            Floor status for the dining hall. {all.filter((t) => t.status === "Occupied").length}{" "}
            of {all.length} occupied.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setActionError(null);
              setForm({ ...EMPTY });
            }}
          >
            + Add table
          </button>
        )}
      </header>

      {actionError && <Alert kind="error">{actionError}</Alert>}

      <div className="flex flex-wrap gap-1.5">
        {(["All", ...STATUSES] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
              filter === status ? "bg-brand-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {!list.length ? (
        <EmptyState
          title="No tables"
          description="Add dining tables to track seating and occupancy."
          action={
            canManage ? (
              <button type="button" className="btn-primary" onClick={() => setForm({ ...EMPTY })}>
                + Add table
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((table) => (
            <div key={table.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold text-stone-900">{table.number}</p>
                  <p className="text-xs text-stone-500">
                    Seats {table.capacity}
                    {!table.isActive && " · inactive"}
                  </p>
                </div>
                <Badge className={TABLE_STATUS_STYLE[table.status] ?? TABLE_STATUS_STYLE.Free}>
                  {table.status}
                </Badge>
              </div>

              {canManage && (
                <div className="mt-3 space-y-2">
                  <select
                    className="input py-1.5 text-xs"
                    value={table.status}
                    onChange={(event) =>
                      changeStatus.mutate({ id: table.id, status: event.target.value })
                    }
                    disabled={changeStatus.isPending}
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="btn-ghost flex-1 px-2 py-1 text-xs"
                      onClick={() => {
                        setActionError(null);
                        setForm({
                          id: table.id,
                          number: table.number,
                          capacity: String(table.capacity),
                          isActive: table.isActive,
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      onClick={() => setDeleting(table)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(form)}
        title={form?.id ? "Edit table" : "Add table"}
        onClose={() => setForm(null)}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button
              type="submit"
              form="table-form"
              className="btn-primary"
              disabled={save.isPending || !form?.number?.trim()}
            >
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        {form && (
          <form
            id="table-form"
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(form);
            }}
          >
            <div>
              <label className="label" htmlFor="t-number">
                Table number / name
              </label>
              <input
                id="t-number"
                className="input"
                placeholder="T05"
                value={form.number}
                onChange={(event) => setForm({ ...form, number: event.target.value })}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="t-capacity">
                Seats
              </label>
              <input
                id="t-capacity"
                type="number"
                min="1"
                className="input"
                value={form.capacity}
                onChange={(event) => setForm({ ...form, capacity: event.target.value })}
                required
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              />
              Active
            </label>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete table?"
        message={deleting ? `Table ${deleting.number} will be removed from the floor plan.` : ""}
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
