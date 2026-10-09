import type { ReactNode } from "react";
import { ORDER_STATUS_LABEL, ORDER_STATUS_STYLE, PAYMENT_STATUS_STYLE } from "@/lib/orderStatus";

export function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={ORDER_STATUS_STYLE[status] ?? ORDER_STATUS_STYLE.Completed}>
      {ORDER_STATUS_LABEL[status] ?? status.toUpperCase()}
    </Badge>
  );
}

export function PaymentBadge({ status }: { status: string }) {
  return (
    <Badge className={PAYMENT_STATUS_STYLE[status] ?? PAYMENT_STATUS_STYLE.Unpaid}>
      {status.toUpperCase()}
    </Badge>
  );
}
