"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { dashboardPath, Role } from "@/lib/auth";

// UX-only guard. The real security is the backend's require_roles(...) on every endpoint.
export default function RoleGuard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center"><Spinner className="h-8 w-8" /></div>;
  }

  return (
    <AppShell user={user}>
      {roles.includes(user.role) ? (
        children
      ) : (
        <Card>
          <EmptyState
            icon={ShieldAlert}
            title="Not authorized"
            description={`Your role (${user.role}) cannot open this page.`}
            action={<Link href={dashboardPath(user.role)}><Button>Go to my dashboard</Button></Link>}
          />
        </Card>
      )}
    </AppShell>
  );
}