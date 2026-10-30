"use client";
import { useEffect, useState } from "react";
import { CalendarCheck, CheckCircle2, Download, Hourglass, TimerReset } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatCard } from "@/components/ui/StatCard";
import { apiGet, errorMessage } from "@/lib/apiClient";
import { AXIS_TICK, CURSOR, GRID, TOOLTIP } from "@/lib/chartTheme";
import { downloadCsv } from "@/lib/csv";
import {
  ASSIGNMENT_METHOD, COMPLETIONS_BY_MONTH, PROPOSALS_BY_FIELD, REPORT_KPIS, THESES_BY_DEPARTMENT,
} from "@/lib/mock/coordinatorDemo";
import { THESIS_STATUS_DEMO } from "@/lib/mock/adminDemo";
import { Supervisor } from "@/lib/types";
export default function ReportsPage() {
  const [supervisors, setSupervisors] = useState<Supervisor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiGet<Supervisor[]>("/api/v1/supervisors")
      .then(setSupervisors)
      .catch((e) => setError(errorMessage(e)));
  }, []);
  const workload = (supervisors ?? []).map((s) => ({
    name: s.user.full_name,
    supervising: s.current_count,
    available: s.capacity - s.current_count,
  }));
  function exportDemoSummary() {
    downloadCsv("thesis-status-summary.csv", [
      ["Status", "Theses"],
      ...THESIS_STATUS_DEMO.map((s) => [s.status, s.count]),
    ]);
  }
  return (
    <>
      <PageHeader
        title="Reports"
        description="Thesis activity across the department."
        actions={
          <Button variant="secondary" onClick={exportDemoSummary}>
            <Download className="h-4 w-4" />Export status summary
          </Button>
        }
      />
      {error && <Alert>{error}</Alert>}
      <SectionTitle title="Key figures" demo first />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Average days to complete"
          value={REPORT_KPIS.avgCompletionDays}
          icon={TimerReset}
          tone="brand"
        />
        <StatCard
          label="Completion rate"
          value={`${REPORT_KPIS.completionRate}%`}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard label="Active theses" value={REPORT_KPIS.activeTheses} icon={CalendarCheck} tone="info" />
        <StatCard label="Overdue theses" value={REPORT_KPIS.overdueTheses} icon={Hourglass} tone="warning" />
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Theses completed per month" action={<DemoBadge />} />
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={COMPLETIONS_BY_MONTH} margin={{ left: -16, right: 8 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                   <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP} cursor={CURSOR} />
                <Line
                  type="monotone"
                  dataKey="completed"
                  name="Completed"
                  stroke="#6366f1"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="How supervisors were assigned" action={<DemoBadge />} />
          <CardContent>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ASSIGNMENT_METHOD}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={44}
                    outerRadius={70}
                    stroke="none"
                  >
                    {ASSIGNMENT_METHOD.map((m) => <Cell key={m.name} fill={m.color} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {ASSIGNMENT_METHOD.map((m) => (
                <li key={m.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                  <span className="text-subtle">{m.name}</span>
                  <span className="ml-auto font-medium">{m.value}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Theses by department" action={<DemoBadge />} />
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={THESES_BY_DEPARTMENT} margin={{ left: -16, right: 8 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP} cursor={CURSOR} />
                <Bar dataKey="value" name="Theses" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Theses by research field" action={<DemoBadge />} />
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={PROPOSALS_BY_FIELD} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip {...TOOLTIP} cursor={CURSOR} />
                <Bar dataKey="value" name="Theses" radius={[0, 4, 4, 0]}>
                  {PROPOSALS_BY_FIELD.map((f) => <Cell key={f.name} fill={f.color} />)}
                </Bar>
              </BarChart>
                    </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Thesis status" action={<DemoBadge />} />
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
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
        <Card>
          <CardHeader title="Supervisor workload" description="Live data from the system" />
          <CardContent>
            {workload.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-subtle">
                {supervisors ? "No supervisor has created a profile yet" : "Loading..."}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, workload.length * 44)}>
                <BarChart data={workload} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke={GRID} />
                  <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip {...TOOLTIP} cursor={CURSOR} />
                  <Bar dataKey="supervising" name="Supervising" stackId="a" fill="#6366f1" />
                  <Bar
                    dataKey="available"
                    name="Available"
                    stackId="a"
                    fill="#6366f1"
                    fillOpacity={0.25}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}