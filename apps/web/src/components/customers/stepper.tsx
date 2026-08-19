import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="flex items-start" aria-label="مراحل ثبت مشتری">
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;

        return (
          <li
            key={label}
            className={cn("flex items-center", index > 0 && "flex-1")}
            aria-current={active ? "step" : undefined}
          >
            {index > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  "mx-3 mb-6 h-px flex-1",
                  done || active ? "bg-primary-500" : "bg-border",
                )}
              />
            )}

            <div className="flex w-24 shrink-0 flex-col items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-10 place-items-center rounded-full border text-sm font-bold transition-colors",
                  active && "border-primary-500 bg-primary-500 text-white shadow-glow-sm",
                  done && "border-primary-500 bg-transparent text-primary-400",
                  !active && !done && "border-border bg-surface-sunken text-fg-muted",
                )}
              >
                {done ? <CheckIcon /> : formatNumber(index + 1)}
              </span>

              <span
                className={cn(
                  "text-center text-xs",
                  active ? "font-medium text-link" : "text-fg-muted",
                )}
              >
                {label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function CheckIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}
