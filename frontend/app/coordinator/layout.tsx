import type { ReactNode } from "react";
import RoleGuard from "@/components/guards/RoleGuard";

export default function CoordinatorLayout({ children }: { children: ReactNode }) {
  return <RoleGuard roles={["coordinator"]}>{children}</RoleGuard>;
}