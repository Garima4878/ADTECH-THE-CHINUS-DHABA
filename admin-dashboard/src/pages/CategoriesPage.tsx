import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { categoriesApi, menuApi } from "@/lib/endpoints";
import { queryKeys } from "@/hooks/queries";
import { can } from "@/lib/permissions";
import { useAuth } from "@/providers/AuthProvider";
import type { Category } from "@/types";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { Alert, EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";

interface FormState {
  id?: string;
  name: string;
  description: string;
  isActive: boolean;
}

const EMPTY: FormState = { name: "", description: "", isActive: true };

export default function CategoriesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can(user, "categories.manage");

  const [form, setForm] = useState<FormState | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const categories = useQuery({
    queryKey: queryKeys.categories,
    queryFn: ({ signal }) => categoriesApi.list(signal),
  });
  const menu = useQuery({ queryKey: queryKeys.menu, queryFn: ({ signal }) => menuApi.list(signal) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    queryClient.invalidateQueries({ queryKey: queryKeys.menu });
  };

  const save = useMutation({
    mutationFn: (state: FormState) => {
      const payload = {
        name: state.name.trim(),
        description: state.description.trim() || null,
        isActive: state.isActive,
      };
      return state.id ? categoriesApi.update(state.id, payload) : categoriesApi.create(payload);
    },
    onSuccess: () => {
      invalidate();
      setForm(null);
      setActionError(null);
    },
    onError: (error) => setActionError((error as Error).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => categoriesApi.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
    },
    onError: (error) => setActionError((error as Error).message),
  });

  if (categories.isLoading) return <Spinner label="Loading categories" />;
  if (categories.isError)
    return <ErrorState error={categories.error} onRetry={() => categories.refetch()} />;

  const list = categories.data ?? [];
  const countFor = (id: string) => (menu.data ?? []).filter((item) => item.categoryId === id).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Menu categories</h1>
          <p className="text-sm text-stone-500">
            Groups used across the menu, such as Starters, Biryani, Kebabs, Rotis.
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
            + Add category
          </button>
        )}
      </header>

      {actionError && <Alert kind="error">{actionError}</Alert>}

      {!list.length ? (
        <EmptyState
          title="No categories yet"
          description="Create categories like Starters, Main Course or Desserts to organise the menu."
          action={
            canManage ? (
              <button type="button" className="btn-primary" onClick={() => setForm({ ...EMPTY })}>
                + Add category
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="card divide-y divide-stone-100 overflow-hidden">
          {list.map((category) => (
            <div
              key={category.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="font-semibold text-stone-800">{category.name}</p>
                {category.description && (
                  <p className="text-xs text-stone-500">{category.description}</p>
                )}
                <p className="mt-0.5 text-xs text-stone-400">
                  {countFor(category.id)} item{countFor(category.id) === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    category.isActive
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-stone-200 text-stone-500"
                  }`}
                >
                  {category.isActive ? "Active" : "Hidden"}
                </span>
                {canManage && (
                  <>
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-xs"
                      onClick={() => {
                        setActionError(null);
                        setForm({
                          id: category.id,
                          name: category.name,
                          description: category.description ?? "",
                          isActive: category.isActive,
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      onClick={() => setDeleting(category)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(form)}
        title={form?.id ? "Edit category" : "Add category"}
        onClose={() => setForm(null)}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button
              type="submit"
              form="category-form"
              className="btn-primary"
              disabled={save.isPending || !form?.name?.trim()}
            >
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        {form && (
          <form
            id="category-form"
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(form);
            }}
          >
            <div>
              <label className="label" htmlFor="c-name">
                Name
              </label>
              <input
                id="c-name"
                className="input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="c-desc">
                Description
              </label>
              <textarea
                id="c-desc"
                className="input min-h-20"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
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
        title="Delete category?"
        message={
          deleting
            ? `"${deleting.name}" will be removed. The backend will reject this if items still use it.`
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
