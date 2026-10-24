import type { ReactNode } from "react";
import RoleGuard from "@/components/guards/RoleGuard";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return <RoleGuard roles={["student"]}>{children}</RoleGuard>;
}