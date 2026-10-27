import { ReactNode } from "react";
import { Info } from "lucide-react";

// Shown at the top of any screen that still runs on sample data.
export function DemoBanner({ children }: { children?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start gap-2 rounded-lg border border-info/30 bg-info/5 px-3 py-2.5 text-sm text-info">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {children ?? "This screen shows sample data. Anything you do here is not saved yet; it becomes real when the matching backend feature is built."}
      </div>
    </div>
  );
}