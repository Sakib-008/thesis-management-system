import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "./Card";

const tones = {
  brand: "bg-brand/10 text-brand",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
};

export function StatCard({ label, value, icon: Icon, tone = "brand" }: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof tones;
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-semibold leading-none">{value}</div>
        <div className="mt-1.5 text-xs text-subtle">{label}</div>
      </div>
    </Card>
  );
}