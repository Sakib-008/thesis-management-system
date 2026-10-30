import {
  Award, BarChart3, Building2, CalendarClock, ClipboardCheck, FileBarChart, FileCheck, FileText, FlaskConical,
  FolderOpen, GraduationCap, LayoutDashboard, ListChecks, LucideIcon, Medal, MessageSquare, ScrollText,
  Settings, Shuffle, UserCheck, UserCircle, Users,
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
    {
      label: "Supervision",
      items: [
        { href: "/supervisor/proposals", label: "Proposals", icon: FileText },
        { href: "/supervisor/students", label: "My students", icon: Users },
        { href: "/supervisor/milestones", label: "Milestones", icon: ListChecks },
        { href: "/supervisor/meetings", label: "Meetings", icon: CalendarClock },
        { href: "/supervisor/evaluations", label: "Evaluations", icon: FileCheck },
      ],
    },
  ],
  coordinator: [
    { items: [{ href: "/coordinator/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      label: "Thesis",
      items: [
        { href: "/coordinator/proposals", label: "Proposals", icon: FileText },
        { href: "/coordinator/assignment-runs", label: "Assignment runs", icon: Shuffle },
        { href: "/coordinator/assignments", label: "Assignments", icon: UserCheck },
      ],
    },
    {
      label: "People",
      items: [
        { href: "/coordinator/students", label: "Students & CGPA", icon: ClipboardCheck },
        { href: "/coordinator/workload", label: "Supervisor workload", icon: BarChart3 },
      ],
    },
    {
      label: "Setup and insights",
      items: [
        { href: "/coordinator/research-fields", label: "Research fields", icon: FlaskConical },
        { href: "/coordinator/reports", label: "Reports", icon: FileBarChart },
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
    {
      label: "System",
      items: [
        { href: "/admin/audit-logs", label: "Audit log", icon: ScrollText },
        { href: "/admin/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
};
export function pageTitle(role: Role, pathname: string): string {
  const items = NAV[role].flatMap((g) => g.items);
  const match = items.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  return match?.label ?? "";
}