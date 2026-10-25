"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Role } from "@/lib/auth";
import { NAV } from "@/lib/nav";

export default function RoleNav({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav className="rolenav">
      {NAV[role].map((item) => (
        <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}