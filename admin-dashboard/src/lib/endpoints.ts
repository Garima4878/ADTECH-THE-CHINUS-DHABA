import { buildQuery, http, unwrap } from "@/lib/api";
import type {
  Category,
  DiningTable,
  MenuItem,
  Order,
  OrderStatus,
  Paginated,
  Payment,
  PaymentStatus,
  User,
} from "@/types";

/**
 * Every endpoint the dashboard needs from the Node/Express backend.
 * Core order action matches the spec: PATCH /api/admin/orders/:id/status
 */

function unwrapList<T>(payload: unknown, key: string): T[] {
  return unwrap<T[]>(payload, [key]) ?? [];
}

function toPaginated<T>(
  items: T[],
  payload: unknown,
  fallbackLimit: number,
): Paginated<T> {
  const root = (payload ?? {}) as Record<string, unknown>;
  const meta =
    (root.meta as Record<string, unknown>) ||
    (root.pagination as Record<string, unknown>) ||
    root;
  const num = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const total = num(meta.total, items.length);
  const limit = num(meta.limit ?? meta.perPage, fallbackLimit) || fallbackLimit;
  const page = num(meta.page ?? meta.currentPage, 1);
  const totalPages = num(
    meta.totalPages,
    Math.max(Math.ceil(total / limit), 1),
  );
  return { items, total, page, limit, totalPages: Math.max(totalPages, 1) };
}

export interface OrderFilters {
  status?: OrderStatus | "All";
  paymentStatus?: PaymentStatus | "All";
  orderType?: string;
  tableId?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export const ordersApi = {
  list: (params: OrderFilters, signal?: AbortSignal) =>
    http
      .get<unknown>(
        `/admin/orders${buildQuery({
          status: params.status && params.status !== "All" ? params.status : undefined,
          paymentStatus:
            params.paymentStatus && params.paymentStatus !== "All"
              ? params.paymentStatus
              : undefined,
          orderType:
            params.orderType && params.orderType !== "All" ? params.orderType : undefined,
          tableId: params.tableId,
          search: params.search,
          from: params.from,
          to: params.to,
          page: params.page,
          limit: params.limit,
        })}`,
        { signal },
      )
      .then((payload) =>
        toPaginated(unwrapList<Order>(payload, "orders"), payload, params.limit ?? 20),
      ),

  get: (id: string, signal?: AbortSignal) =>
    http
      .get<unknown>(`/admin/orders/${id}`, { signal })
      .then((payload) => unwrap<Order>(payload, ["order"])),

  /** Accept / Preparing / Ready / Completed / Cancelled. */
  updateStatus: (id: string, status: OrderStatus) =>
    http
      .patch<unknown>(`/admin/orders/${id}/status`, { status })
      .then((payload) => unwrap<Order>(payload, ["order"])),

  markPaid: (id: string, method: string) =>
    http
      .patch<unknown>(`/admin/orders/${id}/payment`, { status: "Paid", method })
      .then((payload) => unwrap<Order>(payload, ["order"])),
};

export const dashboardApi = {
  stats: (signal?: AbortSignal) =>
    http
      .get<unknown>("/admin/dashboard/stats", { signal })
      .then((payload) => unwrap(payload, ["stats"])),
};

export const menuApi = {
  list: (signal?: AbortSignal) =>
    http
      .get<unknown>("/admin/menu/items", { signal })
      .then((payload) => unwrapList<MenuItem>(payload, "menuItems")),
  create: (body: Partial<MenuItem>) =>
    http
      .post<unknown>("/admin/menu/items", body)
      .then((p) => unwrap<MenuItem>(p, ["menuItem"])),
  update: (id: string, body: Partial<MenuItem>) =>
    http
      .put<unknown>(`/admin/menu/items/${id}`, body)
      .then((p) => unwrap<MenuItem>(p, ["menuItem"])),
  setAvailability: (id: string, isAvailable: boolean) =>
    http
      .patch<unknown>(`/admin/menu/items/${id}/availability`, { isAvailable })
      .then((p) => unwrap<MenuItem>(p, ["menuItem"])),
  remove: (id: string) => http.delete(`/admin/menu/items/${id}`),
};

export const categoriesApi = {
  list: (signal?: AbortSignal) =>
    http
      .get<unknown>("/admin/menu/categories", { signal })
      .then((payload) => unwrapList<Category>(payload, "categories")),
  create: (body: Partial<Category>) =>
    http
      .post<unknown>("/admin/menu/categories", body)
      .then((p) => unwrap<Category>(p, ["category"])),
  update: (id: string, body: Partial<Category>) =>
    http
      .put<unknown>(`/admin/menu/categories/${id}`, body)
      .then((p) => unwrap<Category>(p, ["category"])),
  remove: (id: string) => http.delete(`/admin/menu/categories/${id}`),
};

export const tablesApi = {
  list: (signal?: AbortSignal) =>
    http
      .get<unknown>("/admin/tables", { signal })
      .then((payload) => unwrapList<DiningTable>(payload, "tables")),
  create: (body: Partial<DiningTable>) =>
    http.post<unknown>("/admin/tables", body).then((p) => unwrap<DiningTable>(p, ["table"])),
  update: (id: string, body: Partial<DiningTable>) =>
    http
      .put<unknown>(`/admin/tables/${id}`, body)
      .then((p) => unwrap<DiningTable>(p, ["table"])),
  updateStatus: (id: string, status: string) =>
    http
      .patch<unknown>(`/admin/tables/${id}/status`, { status })
      .then((p) => unwrap<DiningTable>(p, ["table"])),
  remove: (id: string) => http.delete(`/admin/tables/${id}`),
};

export interface PaymentFilters {
  status?: PaymentStatus | "All";
  method?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export const paymentsApi = {
  list: (params: PaymentFilters, signal?: AbortSignal) =>
    http
      .get<unknown>(
        `/admin/payments${buildQuery({
          status: params.status && params.status !== "All" ? params.status : undefined,
          method: params.method && params.method !== "All" ? params.method : undefined,
          from: params.from,
          to: params.to,
          page: params.page,
          limit: params.limit,
        })}`,
        { signal },
      )
      .then((payload) =>
        toPaginated(unwrapList<Payment>(payload, "payments"), payload, params.limit ?? 20),
      ),
};

export const staffApi = {
  list: (signal?: AbortSignal) =>
    http
      .get<unknown>("/admin/staff", { signal })
      .then((payload) => unwrapList<User>(payload, "staff")),
  create: (body: Record<string, unknown>) =>
    http.post<unknown>("/admin/staff", body).then((p) => unwrap<User>(p, ["user"])),
  update: (id: string, body: Record<string, unknown>) =>
    http.put<unknown>(`/admin/staff/${id}`, body).then((p) => unwrap<User>(p, ["user"])),
  remove: (id: string) => http.delete(`/admin/staff/${id}`),
};
