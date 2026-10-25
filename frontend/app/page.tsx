"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Spinner } from "@/components/ui/Spinner";
import { dashboardPath } from "@/lib/auth";

// The home page only decides where to send you.
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? dashboardPath(user.role) : "/login");
  }, [user, loading, router]);

  return <div className="flex min-h-screen items-center justify-center"><Spinner className="h-8 w-8" /></div>;
}