import type { OrderStatus } from "@/types";
import { ORDER_FLOW, ORDER_STATUS_STYLE } from "@/lib/orderStatus";

export function OrderTimeline({ status }: { status: OrderStatus }) {
  const isCancelled = status === "Cancelled";
  const activeIndex = ORDER_FLOW.indexOf(status);

  return (
    <div className="card p-4">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-stone-500">
        Order progress
      </h3>
      <ol className="flex flex-col gap-0 sm:flex-row sm:items-start">
        {ORDER_FLOW.map((step, index) => {
          const done = !isCancelled && activeIndex >= index;
          const current = !isCancelled && activeIndex === index;
          return (
            <li key={step} className="flex flex-1 items-center gap-2 sm:flex-col sm:gap-2">
              <div className="flex items-center gap-2 sm:flex-col">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset ${
                    done ? "bg-brand-600 text-white ring-brand-600" : "bg-stone-100 text-stone-400 ring-stone-200"
                  } ${current ? "scale-110" : ""}`}
                >
                  {done ? "✓" : index + 1}
                </span>
                <span
                  className={`text-xs font-semibold sm:text-center ${
                    done ? "text-stone-800" : "text-stone-400"
                  }`}
                >
                  {step}
                </span>
              </div>
              {index < ORDER_FLOW.length - 1 && (
                <span
                  className={`ml-4 hidden h-0.5 flex-1 sm:ml-0 sm:mt-[-1.75rem] sm:block ${
                    done && activeIndex > index ? "bg-brand-500" : "bg-stone-200"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>

      {isCancelled && (
        <p
          className={`mt-4 rounded-lg px-3 py-2 text-xs font-semibold ring-1 ring-inset ${ORDER_STATUS_STYLE.Cancelled}`}
        >
          This order was cancelled. Available in history for reference.
        </p>
      )}
    </div>
  );
}
