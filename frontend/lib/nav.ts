import {
  Award, Building2, CalendarClock, ClipboardCheck, FileText, FlaskConical, FolderOpen, GraduationCap,
  LayoutDashboard, ListChecks, LucideIcon, Medal, MessageSquare, UserCircle, Users,
} from "lucide-react";
import { Role } from "./auth";

export interface NavItem { href: string; label: string; icon: LucideIcon }
export interface NavGroup { label?: string; items: NavItem[] }

// Sidebar menu per role. Each phase adds the pages it builds.
export const NAV: Record<Role, NavGroup[]> = {
  student: [
    {
      items: [
        { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/student/profile", label: "My profile", icon: UserCircle },
      ],
    },
    {
      label: "Thesis",
      items: [
        { href: "/student/thesis", label: "My thesis", icon: GraduationCap },
        { href: "/student/proposal/1", label: "Proposal", icon: FileText },
        { href: "/student/milestones", label: "Milestones", icon: ListChecks },
        { href: "/student/documents", label: "Documents", icon: FolderOpen },
      ],
    },
    {
      label: "Supervision",
      items: [
        { href: "/student/meetings", label: "Meetings", icon: CalendarClock },
        { href: "/student/feedback", label: "Feedback", icon: MessageSquare },
        { href: "/student/evaluation", label: "Evaluation", icon: Award },
      ],
    },
  ],
  supervisor: [
    {
      items: [
        { href: "/supervisor/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/supervisor/profile", label: "My profile", icon: UserCircle },
      ],
    },
  ],
  coordinator: [
    { items: [{ href: "/coordinator/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      label: "Manage",
      items: [
        { href: "/coordinator/students", label: "Students & CGPA", icon: ClipboardCheck },
        { href: "/coordinator/research-fields", label: "Research fields", icon: FlaskConical },
      ],
    },
  ],
  admin: [
    { items: [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      label: "People",
      items: [
        { href: "/admin/users", label: "Users & roles", icon: Users },
        { href: "/admin/supervisor-designations", label: "Designations", icon: Medal },
      ],
    },
    {
      label: "Academic setup",
      items: [
        { href: "/admin/departments", label: "Departments", icon: Building2 },
        { href: "/admin/programs", label: "Programs", icon: GraduationCap },
        { href: "/admin/research-fields", label: "Research fields", icon: FlaskConical },
      ],
    },
  ],
};

export function pageTitle(role: Role, pathname: string): string {
  const items = NAV[role].flatMap((g) => g.items);
  const match = items.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  return match?.label ?? "";
}