"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { apiGet, apiPost } from "@/lib/apiClient";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";
import { NotificationItem } from "@/lib/types";

const POLL_MS = 30_000;

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = useState(0);
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

  // poll the unread count quietly; a failure (e.g. logged out) is not shown here
  useEffect(() => {
    let cancelled = false;
    const poll = () =>
      apiGet<{ unread: number }>("/api/v1/notifications/unread-count")
        .then((r) => { if (!cancelled) setUnread(r.unread); })
        .catch(() => undefined);
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        setItems(await apiGet<NotificationItem[]>("/api/v1/notifications"));
        setUnread(0);
      } catch {
        setItems([]);
      }
    }
  }

  async function markAllRead() {
    setItems((list) => (list ?? []).map((n) => ({ ...n, read: true })));
    try {
      await apiPost("/api/v1/notifications/read-all");
    } catch {
      // the next poll will correct the count if this failed
    }
  }

  async function open_(n: NotificationItem) {
    setOpen(false);
    if (!n.read) {
      setItems((list) => (list ?? []).map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      apiPost(`/api/v1/notifications/${n.id}/read`).catch(() => undefined);
    }
  }

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="relative w-8 px-0"
        aria-label="Notifications"
        onClick={toggle}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger" />}
      </Button>
      {open && (
        <div
          className={
            "absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border " +
            "border-line bg-surface shadow-xl"
          }
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            {items !== null && items.some((n) => !n.read) && (
              <button className="text-xs font-medium text-brand hover:underline" onClick={markAllRead}>
                Mark all as read
              </button>
            )}
          </div>
          {items === null ? (
            <p className="px-4 py-8 text-center text-sm text-subtle">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-subtle">You are all caught up.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {items.map((n) => {
                const row = (
                  <li className="flex items-start gap-3 px-4 py-3 text-sm">
                    <span
                      className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand")}
                    />
                    <div className="min-w-0">
                      <div className={n.read ? "text-subtle" : "font-medium"}>{n.text}</div>
                      <div className="text-xs text-subtle">{timeAgo(n.created_at)}</div>
                    </div>
                  </li>
                );
                return n.href ? (
                  <Link key={n.id} href={n.href} onClick={() => open_(n)} className="block hover:bg-ink/5">
                    {row}
                  </Link>
                ) : (
                  <button key={n.id} onClick={() => open_(n)} className="block w-full text-left hover:bg-ink/5">
                    {row}
                  </button>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
