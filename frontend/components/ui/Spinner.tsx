import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("mx-auto h-5 w-5 animate-spin text-subtle", className)} aria-label="Loading" />;
}