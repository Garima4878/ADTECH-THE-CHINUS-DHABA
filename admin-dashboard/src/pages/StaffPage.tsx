import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { staffApi } from "@/lib/endpoints";
import { queryKeys } from "@/hooks/queries";
import { ROLE_LABEL } from "@/lib/permissions";
import { useAuth } from "@/providers/AuthProvider";
import type { Role, User } from "@/types";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { Alert, EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";

const ROLES: Role[] = ["admin", "manager", "employee"];

const ROLE_SUMMARY: Record<Role, string> = {
  admin: "Full control: orders, menu, categories, tables, payments and staff accounts.",
  manager: "Runs the floor: orders, menu, categories, tables and payments. No staff accounts.",
  employee: "Kitchen and service: view and advance orders, view menu and tables.",
};

interface FormState {
  id?: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  role: Role;
  password: string;
  isActive: boolean;
}

const EMPTY: FormState = {
  name: "",
  username: "",
  email: "",
  phone: "",
  role: "employee",
  password: "",
  isActive: true,
};

export default function StaffPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const staff = useQuery({ queryKey: queryKeys.staff, queryFn: ({ signal }) => staffApi.list(signal) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.staff });

  const save = useMutation({
    mutationFn: (state: FormState) => {
      const payload: Record<string, unknown> = {
        name: state.name.trim(),
        username: state.username.trim(),
        email: state.email.trim() || undefined,
        phone: state.phone.trim() || undefined,
        role: state.role,
        isActive: state.isActive,
      };
      if (!state.id) payload.password = state.password;
      return state.id ? staffApi.update(state.id, payload) : staffApi.create(payload);
    },
    onSuccess: () => {
      invalidate();
      setForm(null);
      setActionError(null);
    },
    onError: (error) => setActionError((error as Error).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => staffApi.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
    },
    onError: (error) => setActionError((error as Error).message),
  });

  if (staff.isLoading) return <Spinner label="Loading staff" />;
  if (staff.isError) return <ErrorState error={staff.error} onRetry={() => staff.refetch()} />;

  const list = staff.data ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Staff &amp; roles</h1>
          <p className="text-sm text-stone-500">
            Admin-only. Create restaurant employee logins and control what they can do.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setActionError(null);
            setForm({ ...EMPTY });
          }}
        >
          + Add staff
        </button>
      </header>

      {actionError && <Alert kind="error">{actionError}</Alert>}

      <section className="card grid gap-3 p-4 sm:grid-cols-3">
        {ROLES.map((role) => (
          <div key={role} className="rounded-lg bg-stone-50 p-3">
            <p className="text-sm font-bold text-stone-800">{ROLE_LABEL[role]}</p>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">{ROLE_SUMMARY[role]}</p>
            <p className="mt-1 text-xs text-stone-400">
              {list.filter((member) => member.role === role).length} account(s)
            </p>
          </div>
        ))}
      </section>

      {!list.length ? (
        <EmptyState
          title="No staff accounts"
          description="Add your first restaurant employee login."
          action={
            <button type="button" className="btn-primary" onClick={() => setForm({ ...EMPTY })}>
              + Add staff
            </button>
          }
        />
      ) : (
        <div className="card divide-y divide-stone-100 overflow-hidden">
          {list.map((member) => (
            <div
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                  {(member.name ?? member.username).slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <p className="font-semibold text-stone-800">
                    {member.name}
                    {member.id === user?.id && (
                      <span className="ml-2 text-xs font-normal text-stone-400">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-stone-500">
                    @{member.username}
                    {member.email && ` · ${member.email}`}
                    {member.phone && ` · ${member.phone}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-600">
                  {ROLE_LABEL[member.role] ?? member.role}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    member.isActive === false
                      ? "bg-stone-200 text-stone-500"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {member.isActive === false ? "Disabled" : "Active"}
                </span>
                <button
                  type="button"
                  className="btn-ghost px-2 py-1 text-xs"
                  onClick={() => {
                    setActionError(null);
                    setForm({
                      id: member.id,
                      name: member.name,
                      username: member.username,
                      email: member.email ?? "",
                      phone: member.phone ?? "",
                      role: member.role,
                      password: "",
                      isActive: member.isActive !== false,
                    });
                  }}
                >
                  Edit
                </button>
                {member.id !== user?.id && (
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    onClick={() => setDeleting(member)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(form)}
        title={form?.id ? "Edit staff account" : "Add staff account"}
        onClose={() => setForm(null)}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button
              type="submit"
              form="staff-form"
              className="btn-primary"
              disabled={save.isPending || !form?.name?.trim() || !form?.username?.trim()}
            >
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        {form && (
          <form
            id="staff-form"
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(form);
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="s-name">
                  Full name
                </label>
                <input
                  id="s-name"
                  className="input"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="s-username">
                  Username
                </label>
                <input
                  id="s-username"
                  className="input"
                  value={form.username}
                  onChange={(event) => setForm({ ...form, username: event.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="s-email">
                  Email
                </label>
                <input
                  id="s-email"
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="s-phone">
                  Phone
                </label>
                <input
                  id="s-phone"
                  className="input"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="s-role">
                Role
              </label>
              <select
                id="s-role"
                className="input"
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-stone-500">{ROLE_SUMMARY[form.role]}</p>
            </div>
            {!form.id && (
              <div>
                <label className="label" htmlFor="s-password">
                  Password
                </label>
                <input
                  id="s-password"
                  type="password"
                  className="input"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  required
                />
              </div>
            )}
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
        title="Remove staff account?"
        message={
          deleting ? `${deleting.name} (@${deleting.username}) will lose dashboard access.` : ""
        }
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
