"use client";

import { LogOut, Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "@/components/theme/ThemeToggle";
import NotificationBell from "@/components/layout/NotificationBell";
import { useAuth } from "@/components/auth/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { User } from "@/lib/auth";
import { pageTitle } from "@/lib/nav";

export default function Topbar({ user, onMenu }: { user: User; onMenu: () => void }) {
  const { logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur sm:px-6 lg:px-8">
      <Button variant="ghost" size="sm" className="w-8 px-0 lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </Button>
      <div className="font-medium">{pageTitle(user.role, pathname)}</div>

      <div className="ml-auto flex items-center gap-2">
        <NotificationBell role={user.role} />
        <ThemeToggle />
        <div className="hidden text-right leading-tight sm:block">
          <div className="text-sm font-medium">{user.full_name}</div>
          <div className="text-xs capitalize text-subtle">{user.role}</div>
        </div>
        <Avatar name={user.full_name} />
        <Button variant="ghost" size="sm" className="w-8 px-0" aria-label="Log out"
          onClick={() => { logout(); router.push("/login"); }}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}