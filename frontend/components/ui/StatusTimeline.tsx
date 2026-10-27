import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

// A horizontal stepper. current = index of the active step; use steps.length to show every step as done.
export function StatusTimeline({ steps, current, warning }: { steps: string[]; current: number; warning?: boolean }) {
  return (
    <ol className="flex items-start">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <div className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : i <= current ? "bg-brand" : "bg-line")} />
              <div className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                done && "border-brand bg-brand text-on-brand",
                active && (warning ? "border-warning bg-warning/10 text-warning" : "border-brand bg-brand/10 text-brand"),
                !done && !active && "border-line text-subtle",
              )}>
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <div className={cn("h-0.5 flex-1", i === steps.length - 1 ? "bg-transparent" : i < current ? "bg-brand" : "bg-line")} />
            </div>
            <span className={cn("mt-2 px-1 text-center text-xs", active ? "font-medium" : "text-subtle")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}