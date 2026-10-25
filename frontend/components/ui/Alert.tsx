import { ReactNode } from "react";
import { AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/cn";

export function Alert({ tone = "error", children }: { tone?: "error" | "info"; children: ReactNode }) {
  const Icon = tone === "error" ? AlertCircle : Info;
  return (
    <div className={cn(
      "mb-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
      tone === "error" ? "border-danger/30 bg-danger/5 text-danger" : "border-info/30 bg-info/5 text-info",
    )}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}