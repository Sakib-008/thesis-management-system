"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface ToastItem { id: number; tone: "success" | "error"; message: string }
interface ToastApi { success: (message: string) => void; error: (message: string) => void }

const ToastContext = createContext<ToastApi | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback((tone: ToastItem["tone"], message: string) => {
    const id = nextId++;
    setItems((list) => [...list, { id, tone, message }]);
    setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push("success", m), error: (m) => push("error", m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role="status"
            className={cn(
              "flex items-start gap-3 rounded-lg border bg-surface p-3 text-sm shadow-lg",
              t.tone === "success" ? "border-success/40" : "border-danger/40",
            )}>
            {t.tone === "success"
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
            <p className="flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-subtle hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}