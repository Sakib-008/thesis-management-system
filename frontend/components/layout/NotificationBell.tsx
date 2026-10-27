"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { Role } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { daysAgoLabel } from "@/lib/format";
import { NOTIFICATIONS } from "@/lib/mock/notificationsDemo";

export default function NotificationBell({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(NOTIFICATIONS[role]);
  const ref = useRef<HTMLDivElement>(null);

  // close when clicking anywhere outside the dropdown
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="sm" className="relative w-8 px-0" aria-label="Notifications" onClick={() => setOpen((o) => !o)}>
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger" />}
      </Button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button className="text-xs font-medium text-brand hover:underline"
                onClick={() => setItems((list) => list.map((n) => ({ ...n, read: true })))}>
                Mark all as read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-subtle">You are all caught up.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand")} />
                  <div>
                    <div className={n.read ? "text-subtle" : "font-medium"}>{n.text}</div>
                    <div className="text-xs text-subtle">{daysAgoLabel(n.daysAgo)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
            <span className="text-xs text-subtle">Sample notifications</span>
            <DemoBadge />
          </div>
        </div>
      )}
    </div>
  );
}