import type { OrderStatus, PaymentStatus, TableStatus } from "@/types";

/** The kitchen flow defined in the brief. */
export const ORDER_FLOW: OrderStatus[] = [
  "Pending",
  "Accepted",
  "Preparing",
  "Ready",
  "Completed",
];

export const ORDER_STATUSES: (OrderStatus | "Cancelled")[] = [
  ...ORDER_FLOW,
  "Cancelled",
];

export const ORDER_STATUS_LABEL: Record<string, string> = {
  Pending: "PENDING",
  Accepted: "ACCEPTED",
  Preparing: "PREPARING",
  Ready: "READY",
  Completed: "COMPLETED",
  Cancelled: "CANCELLED",
};

export const ORDER_STATUS_STYLE: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800 ring-amber-200",
  Accepted: "bg-blue-100 text-blue-800 ring-blue-200",
  Preparing: "bg-violet-100 text-violet-800 ring-violet-200",
  Ready: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  Completed: "bg-stone-200 text-stone-700 ring-stone-300",
  Cancelled: "bg-red-100 text-red-800 ring-red-200",
};

export const PAYMENT_STATUS_STYLE: Record<string, string> = {
  Paid: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  Unpaid: "bg-amber-100 text-amber-800 ring-amber-200",
  Partial: "bg-orange-100 text-orange-800 ring-orange-200",
  Refunded: "bg-stone-200 text-stone-700 ring-stone-300",
};

export const TABLE_STATUS_STYLE: Record<TableStatus, string> = {
  Free: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  Occupied: "bg-red-100 text-red-800 ring-red-200",
  Reserved: "bg-amber-100 text-amber-800 ring-amber-200",
  Cleaning: "bg-sky-100 text-sky-800 ring-sky-200",
};

/** Label shown on the primary action button for an order. */
export function nextStatusLabel(status: OrderStatus): string | null {
  switch (status) {
    case "Pending":
      return "Accept";
    case "Accepted":
      return "Start Preparing";
    case "Preparing":
      return "Mark Ready";
    case "Ready":
      return "Complete";
    case "Completed":
    case "Cancelled":
      return null;
    default:
      return null;
  }
}

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const index = ORDER_FLOW.indexOf(status);
  if (index === -1 || index === ORDER_FLOW.length - 1) return null;
  return ORDER_FLOW[index + 1];
}

export const PAYMENT_STATUSES: (PaymentStatus | "All")[] = [
  "All",
  "Paid",
  "Unpaid",
  "Partial",
  "Refunded",
];

export const ORDER_TYPES = ["All", "DineIn", "Takeaway", "Delivery"] as const;
