"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, BadgeCheck, CheckCircle2, Clock, FileClock, GraduationCap, Hourglass, Inbox, UserCog, Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/components/auth/AuthProvider";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Spinner } from "@/components/ui/Spinner";
import { StatCard } from "@/components/ui/StatCard";
import { apiGet, errorMessage } from "@/lib/apiClient";
import { AXIS_TICK, CURSOR, GRID, TOOLTIP } from "@/lib/chartTheme";
import { daysAgoLabel } from "@/lib/format";
import { COORDINATOR_PIPELINE, PROPOSAL_QUEUE, PROPOSALS_BY_FIELD } from "@/lib/mock/coordinatorDemo";
import { Student, Supervisor } from "@/lib/types";

export default function CoordinatorDashboardPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [supervisors, setSupervisors] = useState<Supervisor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([apiGet<Student[]>("/api/v1/students"), apiGet<Supervisor[]>("/api/v1/supervisors")])
      .then(([s, sup]) => { setStudents(s); setSupervisors(sup); })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const view = useMemo(() => {
    if (!students || !supervisors) return null;
    const unverified = students.filter((s) => !s.cgpa_verified).length;
    const noFields = supervisors.filter((s) => s.fields.length === 0).length;

    const attention: { text: string; href?: string; cta?: string }[] = [];
    if (unverified > 0) {
      attention.push({
        text: `${unverified} student CGPA${unverified === 1 ? " is" : "s are"} waiting for verification`,
        href: "/coordinator/students", cta: "Review",
      });
    }
    if (noFields > 0) {
      attention.push({ text: `${noFields} supervisor${noFields === 1 ? " has" : "s have"} no research field and cannot be matched` });
    }
    if (students.length === 0) attention.push({ text: "No student has completed a profile yet" });
    if (supervisors.length === 0) attention.push({ text: "No supervisor has created a profile yet" });

    return {
      unverified,
      attention,
      openSlots: supervisors.reduce((n, s) => n + (s.capacity - s.current_count), 0),
      workload: supervisors.map((s) => ({
        name: s.user.full_name,
        supervising: s.current_count,
        available: s.capacity - s.current_count,
      })),
    };
  }, [students, supervisors]);

  const firstName = user?.full_name.split(" ")[0] ?? "";

  if (error) return <Alert>{error}</Alert>;
  if (!students || !supervisors || !view) return <Spinner className="mt-20 h-8 w-8" />;

  return (
    <>
      <PageHeader title={`Welcome back, ${firstName}`} description="Students, supervisors and the thesis pipeline." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students with a profile" value={students.length} icon={GraduationCap} tone="info" />
        <StatCard label="CGPAs awaiting verification" value={view.unverified} icon={Hourglass} tone="warning" />
        <StatCard label="Supervisors with a profile" value={supervisors.length} icon={UserCog} tone="brand" />
        <StatCard label="Open supervision slots" value={view.openSlots} icon={Users} tone="success" />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Needs your attention" />
          {view.attention.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <CheckCircle2 className="mb-2 h-8 w-8 text-success" />
              <div className="font-medium">All clear</div>
              <p className="mt-1 text-sm text-subtle">Nothing needs action right now.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {view.attention.map((a) => (
                <li key={a.text} className="flex items-start gap-3 px-5 py-3.5 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <div className="flex-1">
                    <div>{a.text}</div>
                    {a.href && <Link href={a.href} className="text-xs font-medium text-brand hover:underline">{a.cta} →</Link>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Supervisor workload" description="Supervision slots in use versus available" />
          <CardContent>
            {view.workload.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-subtle">No supervisor has created a profile yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, view.workload.length * 44)}>
                <BarChart data={view.workload} layout="vertical" margin={{ left: 8, right: 16 }}>
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

      <SectionTitle title="Thesis pipeline" demo />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Proposals pending review" value={COORDINATOR_PIPELINE.pendingProposals} icon={FileClock} tone="warning" />
        <StatCard label="Awaiting supervisor assignment" value={COORDINATOR_PIPELINE.awaitingAssignment} icon={Inbox} tone="info" />
        <StatCard label="Active theses" value={COORDINATOR_PIPELINE.activeTheses} icon={BadgeCheck} tone="success" />
        <StatCard label="Overdue theses" value={COORDINATOR_PIPELINE.overdueTheses} icon={Clock} tone="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Proposals by research field" action={<DemoBadge />} />
          <CardContent>
            <div className="grid items-center gap-4 sm:grid-cols-2">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={PROPOSALS_BY_FIELD} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3} stroke="none">
                      {PROPOSALS_BY_FIELD.map((f) => <Cell key={f.name} fill={f.color} />)}
                    </Pie>
                    <Tooltip {...TOOLTIP} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-2 text-sm">
                {PROPOSALS_BY_FIELD.map((f) => (
                  <li key={f.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: f.color }} />
                    <span className="text-subtle">{f.name}</span>
                    <span className="ml-auto font-medium">{f.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Proposals waiting for review" action={<DemoBadge />} />
          <ul className="divide-y divide-line">
            {PROPOSAL_QUEUE.map((p) => (
              <li key={p.title} className="flex items-start gap-3 px-5 py-3.5 text-sm">
                <Avatar name={p.student} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.title}</div>
                  <div className="text-xs text-subtle">{p.student} · {daysAgoLabel(p.daysAgo)}</div>
                </div>
                <Badge tone="brand">{p.field}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}