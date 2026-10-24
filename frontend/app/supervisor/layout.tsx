import type { ReactNode } from "react";
import RoleGuard from "@/components/guards/RoleGuard";

export default function SupervisorLayout({ children }: { children: ReactNode }) {
  return <RoleGuard roles={["supervisor"]}>{children}</RoleGuard>;
}