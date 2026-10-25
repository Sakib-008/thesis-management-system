"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Role } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { NAV } from "@/lib/nav";

export default function Sidebar({ role, open, onClose }: { role: Role; open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform duration-200",
        "lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex h-16 items-center gap-3 border-b border-line px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-on-brand shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Thesis Manager</div>
            <div className="text-xs capitalize text-subtle">{role} portal</div>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {NAV[role].map((group, i) => (
            <div key={i}>
              {group.label && (
                <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-subtle">{group.label}</div>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link href={item.href} onClick={onClose}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          active ? "bg-brand/10 font-medium text-brand" : "text-subtle hover:bg-ink/5 hover:text-ink",
                        )}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-line px-5 py-4 text-xs text-subtle">
          AI-Assisted Thesis Management
        </div>
      </aside>
    </>
  );
}