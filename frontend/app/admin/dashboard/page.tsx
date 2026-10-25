"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, BadgeCheck, CheckCircle2, Circle, GraduationCap, UserCog, Users } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useAuth } from "@/components/auth/AuthProvider";
import { Alert } from "@/components/ui/Alert";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import { StatCard } from "@/components/ui/StatCard";
import { apiGet, errorMessage } from "@/lib/apiClient";
import { Role, User } from "@/lib/auth";
import { describeAction, timeAgo } from "@/lib/format";
import { THESIS_STATUS_DEMO } from "@/lib/mock/adminDemo";
import { AuditLogEntry, NamedRef, Program, Student, Supervisor } from "@/lib/types";

// Chart colours are plain hex because SVG attributes can't read the CSS theme variables.
const ROLE_META: Record<Role, { label: string; color: string }> = {
  student: { label: "Students", color: "#0ea5e9" },
  supervisor: { label: "Supervisors", color: "#6366f1" },
  coordinator: { label: "Coordinators", color: "#f59e0b" },
  admin: { label: "Admins", color: "#ef4444" },
};
const AXIS_TICK = { fontSize: 12, fill: "#94a3b8" };
const GRID = "rgba(148,163,184,0.25)";
const CURSOR = { fill: "rgba(148,163,184,0.12)" };
const TOOLTIP = {
  contentStyle: {
    background: "rgb(var(--surface))",
    border: "1px solid rgb(var(--line))",
    borderRadius: 8,
    fontSize: 12,
    color: "rgb(var(--ink))",
  },
  labelStyle: { color: "rgb(var(--ink))" },
  itemStyle: { color: "rgb(var(--ink))" },
};

interface Data {
  users: User[];
  students: Student[];
  supervisors: Supervisor[];
  departments: NamedRef[];
  programs: Program[];
  logs: AuditLogEntry[];
}

function ChartEmpty({ text }: { text: string }) {
  return <div className="flex h-48 items-center justify-center text-sm text-subtle">{text}</div>;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<User[]>("/api/v1/users"),
      apiGet<Student[]>("/api/v1/students"),
      apiGet<Supervisor[]>("/api/v1/supervisors"),
      apiGet<NamedRef[]>("/api/v1/departments"),
      apiGet<Program[]>("/api/v1/programs"),
      apiGet<AuditLogEntry[]>("/api/v1/audit-logs?limit=8"),
    ])
      .then(([users, students, supervisors, departments, programs, logs]) =>
        setData({ users, students, supervisors, departments, programs, logs }))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const { users, students, supervisors, departments, programs } = data;
    const count = (role: Role) => users.filter((u) => u.role === role).length;
    const verified = students.filter((s) => s.cgpa_verified).length;

    const roleData = (Object.keys(ROLE_META) as Role[])
      .map((r) => ({ name: ROLE_META[r].label, value: count(r), color: ROLE_META[r].color }))
      .filter((r) => r.value > 0);

    const capacityRows = supervisors.map((s) => ({
      name: s.user.full_name,
      supervising: s.current_count,
      available: s.capacity - s.current_count,
    }));

    const perField = new Map<string, number>();
    supervisors.forEach((s) => s.fields.forEach((f) => perField.set(f.name, (perField.get(f.name) ?? 0) + 1)));
    const fieldRows = Array.from(perField, ([name, supervisorsCount]) => ({ name, supervisors: supervisorsCount }))
      .sort((a, b) => b.supervisors - a.supervisors)
      .slice(0, 8);

    const checklist = [
      { label: "Create departments", done: departments.length > 0, detail: `${departments.length} created`, href: "/admin/departments" },
      { label: "Add programs", done: programs.length > 0, detail: `${programs.length} created`, href: "/admin/programs" },
      {
        label: "Create a coordinator account",
        done: users.some((u) => u.role === "coordinator" && u.is_active),
        detail: `${count("coordinator")} coordinator(s)`,
        href: "/admin/users",
      },
      {
        label: "Supervisors complete their profiles",
        done: supervisors.length > 0 && supervisors.length >= count("supervisor"),
        detail: `${supervisors.length} of ${count("supervisor")}`,
        href: "/admin/supervisor-designations",
      },
      {
        label: "Students complete their profiles",
        done: students.length > 0 && students.length >= count("student"),
        detail: `${students.length} of ${count("student")}`,
        href: null,
      },
      {
        label: "Coordinators verify student CGPAs",
        done: students.length > 0 && verified === students.length,
        detail: `${verified} of ${students.length} verified`,
        href: null,
      },
    ];

    return {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.is_active).length,
      roleData,
      capacityRows,
      fieldRows,
      checklist,
      verified,
      studentProfiles: students.length,
      supervisorProfiles: supervisors.length,
      totalCapacity: supervisors.reduce((sum, s) => sum + s.capacity, 0),
      used: supervisors.reduce((sum, s) => sum + s.current_count, 0),
      done: checklist.filter((c) => c.done).length,
    };
  }, [data]);

  const firstName = user?.full_name.split(" ")[0] ?? "";

  if (error) return <Alert>{error}</Alert>;
  if (!data || !view) return <Spinner className="mt-20 h-8 w-8" />;

  return (
    <>
      <PageHeader title="Admin dashboard" description={`Welcome back, ${firstName}. Here is what is happening across the system.`} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={`Users (${view.activeUsers} active)`} value={view.totalUsers} icon={Users} tone="brand" />
        <StatCard label="Students with a profile" value={view.studentProfiles} icon={GraduationCap} tone="info" />
        <StatCard label="Supervisors with a profile" value={view.supervisorProfiles} icon={UserCog} tone="warning" />
        <StatCard label="CGPAs verified" value={`${view.verified}/${view.studentProfiles}`} icon={BadgeCheck} tone="success" />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Users by role" />
          <CardContent>
            {view.roleData.length === 0 ? <ChartEmpty text="No users yet" /> : (
              <>
                <div className="relative h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={view.roleData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={86} paddingAngle={3} stroke="none">
                        {view.roleData.map((r) => <Cell key={r.name} fill={r.color} />)}
                      </Pie>
                      <Tooltip {...TOOLTIP} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-2xl font-semibold">{view.totalUsers}</div>
                    <div className="text-xs text-subtle">users</div>
                  </div>
                </div>
                <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  {view.roleData.map((r) => (
                    <li key={r.name} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                      <span className="text-subtle">{r.name}</span>
                      <span className="ml-auto font-medium">{r.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Supervisor capacity"
            description={view.totalCapacity > 0 ? `${view.used} of ${view.totalCapacity} supervision slots in use` : "Slots in use versus available"} />
          <CardContent>
            {view.capacityRows.length === 0 ? <ChartEmpty text="No supervisor has created a profile yet" /> : (
              <ResponsiveContainer width="100%" height={Math.max(200, view.capacityRows.length * 44)}>
                <BarChart data={view.capacityRows} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke={GRID} />
                  <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP} cursor={CURSOR} />
                  <Bar dataKey="supervising" name="Supervising" stackId="a" fill="#6366f1" />
                  <Bar dataKey="available" name="Available" stackId="a" fill="#6366f1" fillOpacity={0.25} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Setup checklist" description={`${view.done} of ${view.checklist.length} steps complete`} />
          <CardContent className="space-y-4">
            <ProgressBar value={view.done} max={view.checklist.length} />
            <ul className="space-y-3">
              {view.checklist.map((item) => (
                <li key={item.label} className="flex items-start gap-3 text-sm">
                  {item.done
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />}
                  <div className="flex-1">
                    {item.href && !item.done
                      ? <Link href={item.href} className="font-medium text-brand hover:underline">{item.label}</Link>
                      : <span className={item.done ? "text-subtle" : "font-medium"}>{item.label}</span>}
                  </div>
                  <span className="text-xs text-subtle">{item.detail}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Recent activity" description="The latest administrative actions" />
          {data.logs.length === 0 ? (
            <EmptyState icon={Activity} title="No activity yet" description="Actions like creating users or departments will appear here." />
          ) : (
            <ul className="divide-y divide-line">
              {data.logs.map((log) => (
                <li key={log.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{describeAction(log.action, log.meta)}</div>
                    <div className="text-xs text-subtle">{log.user?.full_name ?? "System"} · {timeAgo(log.timestamp)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Supervisors per research field" description="Where your supervision expertise is concentrated" />
          <CardContent>
            {view.fieldRows.length === 0 ? <ChartEmpty text="Supervisors have not chosen research fields yet" /> : (
              <ResponsiveContainer width="100%" height={Math.max(200, view.fieldRows.length * 38)}>
                <BarChart data={view.fieldRows} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke={GRID} />
                  <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={150} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP} cursor={CURSOR} />
                  <Bar dataKey="supervisors" name="Supervisors" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Thesis status overview" description="Theses at each stage of the workflow" action={<DemoBadge />} />
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={THESIS_STATUS_DEMO} margin={{ left: -16, right: 8 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="status" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP} cursor={CURSOR} />
                <Bar dataKey="count" name="Theses" radius={[4, 4, 0, 0]}>
                  {THESIS_STATUS_DEMO.map((s) => <Cell key={s.status} fill={s.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </>
  );
}