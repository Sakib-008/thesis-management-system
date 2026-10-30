import { cn } from "@/lib/cn";
// A simple row of filter tabs. The parent owns which tab is selected.
export function Tabs<T extends string>({ tabs, value, onChange }: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === tab.id ? "bg-brand/10 text-brand" : "text-subtle hover:bg-ink/5",
          )}
        >
          {tab.label}
          {tab.count !== undefined && <span className="text-xs opacity-70">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}