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
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatCard } from "@/components/ui/StatCard";
import { apiGet, errorMessage } from "@/lib/apiClient";
import { AXIS_TICK, CURSOR, GRID, TOOLTIP } from "@/lib/chartTheme";
import { downloadCsv } from "@/lib/csv";
import { ReportStats, Supervisor } from "@/lib/types";

const METHOD_COLORS: Record<string, string> = { "Allocation run": "#6366f1", Manual: "#f59e0b" };
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", submitted: "Submitted", under_review: "Under review", approved: "Approved",
  revision_required: "Revise", resubmitted: "Resubmitted",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "#94a3b8", submitted: "#f59e0b", under_review: "#0ea5e9", approved: "#22c55e",
  revision_required: "#ef4444", resubmitted: "#8b5cf6",
};

function ChartEmpty({ text }: { text: string }) {
  return <div className="flex h-48 items-center justify-center text-sm text-subtle">{text}</div>;
}

export default function ReportsPage() {
  const [supervisors, setSupervisors] = useState<Supervisor[] | null>(null);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<Supervisor[]>("/api/v1/supervisors"),
      apiGet<ReportStats>("/api/v1/dashboard/coordinator/reports"),
    ])
      .then(([sup, st]) => { setSupervisors(sup); setStats(st); })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const workload = (supervisors ?? []).map((s) => ({
    name: s.user.full_name,
    supervising: s.current_count,
    available: s.capacity - s.current_count,
  }));
  const completions = (stats?.completions_by_month ?? []).map(([month, completed]) => ({ month, completed }));
  const methods = (stats?.assignment_method ?? []).map(([name, value]) => ({
    name, value, color: METHOD_COLORS[name] ?? "#94a3b8",
  }));
  const byDept = (stats?.theses_by_department ?? []).map(([name, value]) => ({ name, value }));
  const FIELD_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#06b6d4", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6"];
  const byField = (stats?.theses_by_field ?? []).map(([name, value], i) => ({
    name, value, color: FIELD_COLORS[i % FIELD_COLORS.length],
  }));
  const byStatus = (stats?.theses_by_status ?? []).map(([key, count]) => ({
    status: STATUS_LABEL[key] ?? key, count, color: STATUS_COLOR[key] ?? "#94a3b8",
  }));

  function exportStatusSummary() {
    downloadCsv("thesis-status-summary.csv", [["Status", "Theses"], ...byStatus.map((s) => [s.status, s.count])]);
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Thesis activity across the department."
        actions={
          <Button variant="secondary" onClick={exportStatusSummary} disabled={byStatus.length === 0}>
            <Download className="h-4 w-4" />Export status summary
          </Button>
        }
      />
      {error && <Alert>{error}</Alert>}
      <SectionTitle title="Key figures" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Average days to complete"
          value={stats?.avg_completion_days ?? "-"}
          icon={TimerReset}
          tone="brand"
        />
        <StatCard
          label="Completion rate"
          value={`${stats?.completion_rate ?? 0}%`}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard label="Active theses" value={stats?.active_theses ?? "-"} icon={CalendarCheck} tone="info" />
        <StatCard label="Overdue theses" value={stats?.overdue_theses ?? "-"} icon={Hourglass} tone="warning" />
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Theses with a published result, per month" />
          <CardContent>
            {completions.length === 0 ? <ChartEmpty text="No results published yet" /> : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={completions} margin={{ left: -16, right: 8 }}>
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
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="How supervisors were assigned" />
          <CardContent>
            {methods.length === 0 ? <ChartEmpty text="No assignments yet" /> : (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={methods}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={44}
                        outerRadius={70}
                        stroke="none"
                      >
                        {methods.map((m) => <Cell key={m.name} fill={m.color} />)}
                      </Pie>
                      <Tooltip {...TOOLTIP} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  {methods.map((m) => (
                    <li key={m.name} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                      <span className="text-subtle">{m.name}</span>
                      <span className="ml-auto font-medium">{m.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Theses by department" />
          <CardContent>
            {byDept.length === 0 ? <ChartEmpty text="No supervised theses yet" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byDept} margin={{ left: -16, right: 8 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP} cursor={CURSOR} />
                  <Bar dataKey="value" name="Theses" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Theses by research field" />
          <CardContent>
            {byField.length === 0 ? <ChartEmpty text="No supervised theses yet" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byField} layout="vertical" margin={{ left: 8, right: 16 }}>
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
                    {byField.map((f) => <Cell key={f.name} fill={f.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Thesis status" description="Across every proposal, not only supervised ones" />
          <CardContent>
            {byStatus.length === 0 ? <ChartEmpty text="No proposals yet" /> : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byStatus} margin={{ left: -16, right: 8 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="status" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
                  <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP} cursor={CURSOR} />
                  <Bar dataKey="count" name="Theses" radius={[4, 4, 0, 0]}>
                    {byStatus.map((s) => <Cell key={s.status} fill={s.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
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
