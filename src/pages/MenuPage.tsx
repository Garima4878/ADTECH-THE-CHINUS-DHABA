import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { categoriesApi, menuApi } from "@/lib/endpoints";
import { queryKeys } from "@/hooks/queries";
import { can } from "@/lib/permissions";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/providers/AuthProvider";
import type { MenuItem } from "@/types";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { Alert, EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";

interface FormState {
  id?: string;
  name: string;
  description: string;
  price: string;
  categoryId: string;
  imageUrl: string;
  isVeg: boolean;
  isSpicy: boolean;
  isAvailable: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  price: "",
  categoryId: "",
  imageUrl: "",
  isVeg: false,
  isSpicy: false,
  isAvailable: true,
};

export default function MenuPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can(user, "menu.manage");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [form, setForm] = useState<FormState | null>(null);
  const [deleting, setDeleting] = useState<MenuItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const menu = useQuery({ queryKey: queryKeys.menu, queryFn: ({ signal }) => menuApi.list(signal) });
  const categories = useQuery({
    queryKey: queryKeys.categories,
    queryFn: ({ signal }) => categoriesApi.list(signal),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.menu });
    queryClient.invalidateQueries({ queryKey: queryKeys.categories });
  };

  const save = useMutation({
    mutationFn: async (state: FormState) => {
      const payload = {
        name: state.name.trim(),
        description: state.description.trim() || null,
        price: Number(state.price),
        categoryId: state.categoryId,
        imageUrl: state.imageUrl.trim() || null,
        isVeg: state.isVeg,
        isSpicy: state.isSpicy,
        isAvailable: state.isAvailable,
      };
      return state.id ? menuApi.update(state.id, payload) : menuApi.create(payload);
    },
    onSuccess: () => {
      invalidate();
      setForm(null);
      setActionError(null);
    },
    onError: (error) => setActionError((error as Error).message),
  });

  const toggleAvailability = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      menuApi.setAvailability(id, isAvailable),
    onSuccess: invalidate,
    onError: (error) => setActionError((error as Error).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => menuApi.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
    },
    onError: (error) => setActionError((error as Error).message),
  });

  const items = useMemo(() => {
    let list = menu.data ?? [];
    if (categoryFilter !== "All") list = list.filter((item) => item.categoryId === categoryFilter);
    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(term) ||
          item.description?.toLowerCase().includes(term),
      );
    }
    return list;
  }, [menu.data, categoryFilter, search]);

  const byCategory = useMemo(() => {
    const groups = new Map<string, { name: string; items: MenuItem[] }>();
    items.forEach((item) => {
      const key = item.categoryId || "uncategorised";
      const existing = groups.get(key);
      if (existing) existing.items.push(item);
      else groups.set(key, { name: item.categoryName ?? "Uncategorised", items: [item] });
    });
    return Array.from(groups.entries());
  }, [items]);

  if (menu.isLoading || categories.isLoading) return <Spinner label="Loading menu" />;
  if (menu.isError) return <ErrorState error={menu.error} onRetry={() => menu.refetch()} />;
  if (categories.isError)
    return <ErrorState error={categories.error} onRetry={() => categories.refetch()} />;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Menu</h1>
          <p className="text-sm text-stone-500">
            {canManage
              ? "Add, edit and manage availability. Items load from the backend."
              : "Read-only view. Ask an admin or manager to change the menu."}
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setActionError(null);
              setForm({ ...EMPTY_FORM, categoryId: categories.data?.[0]?.id ?? "" });
            }}
          >
            + Add item
          </button>
        )}
      </header>

      {actionError && <Alert kind="error">{actionError}</Alert>}

      <section className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input
          className="input sm:max-w-xs"
          placeholder="Search dishes"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="input sm:max-w-52"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="All">All categories</option>
          {(categories.data ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </section>

      {!items.length ? (
        <EmptyState
          title="No menu items"
          description={
            categories.data?.length
              ? "Add the first dish to this category."
              : "Create a category first, then add dishes."
          }
          action={
            canManage && categories.data?.length ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  setForm({ ...EMPTY_FORM, categoryId: categories.data?.[0]?.id ?? "" })
                }
              >
                + Add item
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {byCategory.map(([key, group]) => (
            <section key={key}>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">
                {group.name}{" "}
                <span className="font-normal text-stone-400">({group.items.length})</span>
              </h2>
              <div className="card divide-y divide-stone-100 overflow-hidden">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-xl">
                          🍛
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-semibold text-stone-800">
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                              item.isVeg ? "bg-emerald-500" : "bg-red-500"
                            }`}
                            title={item.isVeg ? "Veg" : "Non-veg"}
                          />
                          <span className="truncate">{item.name}</span>
                          {item.isSpicy && <span title="Spicy">🌶️</span>}
                        </p>
                        {item.description && (
                          <p className="truncate text-xs text-stone-500">{item.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-stone-900">
                        {formatCurrency(item.price)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          item.isAvailable
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-stone-200 text-stone-500"
                        }`}
                      >
                        {item.isAvailable ? "Available" : "Unavailable"}
                      </span>
                      {canManage && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1 text-xs"
                            onClick={() =>
                              toggleAvailability.mutate({
                                id: item.id,
                                isAvailable: !item.isAvailable,
                              })
                            }
                            disabled={toggleAvailability.isPending}
                          >
                            {item.isAvailable ? "Hide" : "Show"}
                          </button>
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1 text-xs"
                            onClick={() => {
                              setActionError(null);
                              setForm({
                                id: item.id,
                                name: item.name,
                                description: item.description ?? "",
                                price: String(item.price),
                                categoryId: item.categoryId,
                                imageUrl: item.imageUrl ?? "",
                                isVeg: Boolean(item.isVeg),
                                isSpicy: Boolean(item.isSpicy),
                                isAvailable: item.isAvailable,
                              });
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            onClick={() => setDeleting(item)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(form)}
        title={form?.id ? "Edit menu item" : "Add menu item"}
        onClose={() => setForm(null)}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button
              type="submit"
              form="menu-item-form"
              className="btn-primary"
              disabled={save.isPending || !form?.name || !form?.price || !form?.categoryId}
            >
              {save.isPending ? "Saving…" : "Save item"}
            </button>
          </>
        }
      >
        {form && (
          <form
            id="menu-item-form"
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(form);
            }}
          >
            <div>
              <label className="label" htmlFor="m-name">
                Dish name
              </label>
              <input
                id="m-name"
                className="input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="m-desc">
                Description
              </label>
              <textarea
                id="m-desc"
                className="input min-h-20"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="m-price">
                  Price (₹)
                </label>
                <input
                  id="m-price"
                  type="number"
                  min="0"
                  step="1"
                  className="input"
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: event.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="m-cat">
                  Category
                </label>
                <select
                  id="m-cat"
                  className="input"
                  value={form.categoryId}
                  onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                  required
                >
                  <option value="">Select category</option>
                  {(categories.data ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="m-img">
                Image URL
              </label>
              <input
                id="m-img"
                className="input"
                placeholder="https://…"
                value={form.imageUrl}
                onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <Toggle
                label="Vegetarian"
                checked={form.isVeg}
                onChange={(checked) => setForm({ ...form, isVeg: checked })}
              />
              <Toggle
                label="Spicy"
                checked={form.isSpicy}
                onChange={(checked) => setForm({ ...form, isSpicy: checked })}
              />
              <Toggle
                label="Available"
                checked={form.isAvailable}
                onChange={(checked) => setForm({ ...form, isAvailable: checked })}
              />
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete menu item?"
        message={
          deleting
            ? `"${deleting.name}" will be removed from the menu. Existing orders are not affected.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-700">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
