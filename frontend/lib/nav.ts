import { Role } from "./auth";

// Menu links per role. Each phase adds the pages it builds.
export const NAV: Record<Role, { href: string; label: string }[]> = {
  student: [
    { href: "/student/dashboard", label: "Dashboard" },
    { href: "/student/profile", label: "My profile" },
  ],
  supervisor: [
    { href: "/supervisor/dashboard", label: "Dashboard" },
    { href: "/supervisor/profile", label: "My profile" },
  ],
  coordinator: [
    { href: "/coordinator/dashboard", label: "Dashboard" },
    { href: "/coordinator/students", label: "Students & CGPA" },
    { href: "/coordinator/research-fields", label: "Research fields" },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/departments", label: "Departments" },
    { href: "/admin/programs", label: "Programs" },
    { href: "/admin/research-fields", label: "Research fields" },
    { href: "/admin/supervisor-designations", label: "Designations & supervisors" },
  ],
};