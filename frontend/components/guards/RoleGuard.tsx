"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import RoleNav from "@/components/ui/RoleNav";
import { dashboardPath, Role } from "@/lib/auth";

// UX-only guard. The real security is the backend's require_roles(...) on every endpoint.
export default function RoleGuard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return <p>Loading…</p>;

  if (!roles.includes(user.role)) {
    return (
      <div className="card">
        <h2>Not authorized</h2>
        <p>Your role ({user.role}) cannot open this page.</p>
        <Link href={dashboardPath(user.role)}>Go to my dashboard</Link>
      </div>
    );
  }
  return (
    <>
      <RoleNav role={user.role} />
      {children}
    </>
  );
}