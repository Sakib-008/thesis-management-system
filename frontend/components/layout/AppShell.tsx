"use client";

import { ReactNode, useState } from "react";
import { User } from "@/lib/auth";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell({ user, children }: { user: User; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar role={user.role} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="lg:pl-64">
        <Topbar user={user} onMenu={() => setMenuOpen(true)} />
        <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}