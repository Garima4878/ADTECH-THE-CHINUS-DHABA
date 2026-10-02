import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dashboardApi,
  ordersApi,
  type OrderFilters,
  type PaymentFilters,
} from "@/lib/endpoints";
import type { DashboardStats, Order, OrderStatus, Paginated } from "@/types";

export const queryKeys = {
  stats: ["dashboard", "stats"] as const,
  orders: (filters: OrderFilters) => ["orders", "list", filters] as const,
  order: (id: string) => ["orders", "detail", id] as const,
  menu: ["menu", "items"] as const,
  categories: ["menu", "categories"] as const,
  tables: ["tables"] as const,
  payments: (filters: PaymentFilters) => ["payments", "list", filters] as const,
  staff: ["staff"] as const,
};

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: queryKeys.stats,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    queryFn: ({ signal }) => dashboardApi.stats(signal) as Promise<DashboardStats>,
  });
}

export function useOrders(filters: OrderFilters) {
  return useQuery<Paginated<Order>>({
    queryKey: queryKeys.orders(filters),
    refetchInterval: 20 * 1000,
    placeholderData: (prev) => prev,
    queryFn: ({ signal }) => ordersApi.list(filters, signal),
  });
}

export function useOrder(id: string | undefined) {
  return useQuery<Order>({
    queryKey: queryKeys.order(id ?? ""),
    enabled: Boolean(id),
    refetchInterval: 20 * 1000,
    queryFn: ({ signal }) => ordersApi.get(id as string, signal),
  });
}

/**
 * Status change with optimistic UI so the kitchen screen reacts instantly.
 * Rolls back to the server's truth when the PATCH fails.
 */
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: OrderStatus }) =>
      ordersApi.updateStatus(input.id, input.status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["orders"] });
      const snapshot = queryClient.getQueriesData({ queryKey: ["orders"] });

      queryClient.setQueriesData({ queryKey: ["orders"] }, (old) => {
        const container = old as { items?: Order[] } | undefined;
        if (!container || !Array.isArray(container.items)) return old;
        return {
          ...container,
          items: container.items.map((order) =>
            order.id === id ? { ...order, status } : order,
          ),
        };
      });

      queryClient.setQueryData(queryKeys.order(id), (old: Order | undefined) =>
        old ? { ...old, status } : old,
      );

      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useMarkOrderPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; method: string }) =>
      ordersApi.markPaid(input.id, input.method),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });
}
