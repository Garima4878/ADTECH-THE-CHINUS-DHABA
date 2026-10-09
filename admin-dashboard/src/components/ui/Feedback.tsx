import type { ReactNode } from "react";
import { ApiError } from "@/lib/api";

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-stone-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-brand-600" />
      {label}…
    </div>
  );
}

export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const message =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : "Something went wrong.";

  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-lg font-bold text-red-600">
        !
      </div>
      <p className="font-semibold text-stone-800">Could not load this data</p>
      <p className="max-w-md text-sm text-stone-500">
        {error instanceof ApiError && error.status === 0
          ? "The backend is not connected yet, so there is no data to show. Start your Express API (or point VITE_PROXY_TARGET at it) and this screen will fill in."
          : message}
      </p>
      {onRetry && (
        <button type="button" className="btn-ghost mt-2" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-xl">
        🍽️
      </div>
      <p className="font-semibold text-stone-800">{title}</p>
      {description && <p className="max-w-sm text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "bg-red-50 text-red-700 border-red-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
  }[kind];

  return (
    <div role="alert" className={`rounded-lg border px-4 py-3 text-sm font-medium ${styles}`}>
      {children}
    </div>
  );
}
