import type { ReactNode } from "react";
import RoleGuard from "@/components/guards/RoleGuard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RoleGuard roles={["admin"]}>{children}</RoleGuard>;
}