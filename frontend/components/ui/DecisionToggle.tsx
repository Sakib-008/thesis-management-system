import { Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
export type Decision = "approve" | "revise";
const OPTIONS = [
  { value: "approve", label: "Approve", icon: Check },
  { value: "revise", label: "Request revision", icon: RotateCcw },
] as const;
// Two big buttons that behave like a radio group: approve or ask for changes.
export function DecisionToggle({ value, onChange }: { value: Decision; onChange: (d: Decision) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {OPTIONS.map(({ value: option, label, icon: Icon }) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium",
            "transition-colors",
            value === option ? "border-brand bg-brand/10 text-brand" : "border-line text-subtle hover:bg-ink/5",
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}