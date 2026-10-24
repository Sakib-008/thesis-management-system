"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { dashboardPath } from "@/lib/auth";

export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="top header-row">
      <Link href={user ? dashboardPath(user.role) : "/"} className="brand">
        AI-Assisted University Thesis Management System
      </Link>
      <div>
        {user ? (
          <>
            <span className="muted">{user.full_name} · {user.role}</span>{" "}
            <button className="btn btn-small" onClick={() => { logout(); router.push("/login"); }}>
              Log out
            </button>
          </>
        ) : (
          <Link href="/login">Log in</Link>
        )}
      </div>
    </header>
  );
}