"use client";
import { useEffect, useMemo, useState } from "react";
import { Download, Gauge, Users, UserCheck, UserX } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import { StatCard } from "@/components/ui/StatCard";
import { Table, Td } from "@/components/ui/Table";
import { apiGet, errorMessage } from "@/lib/apiClient";
import { downloadCsv } from "@/lib/csv";
import { Supervisor } from "@/lib/types";
type Sort = "name" | "available" | "loaded";
export default function WorkloadPage() {
  const [supervisors, setSupervisors] = useState<Supervisor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("loaded");
  useEffect(() => {
    apiGet<Supervisor[]>("/api/v1/supervisors")
      .then(setSupervisors)
      .catch((e) => setError(errorMessage(e)));
  }, []);
  const rows = useMemo(() => {
    const list = (supervisors ?? []).slice();
    const ratio = (s: Supervisor) => (s.capacity > 0 ? s.current_count / s.capacity : 1);
    if (sort === "name") list.sort((a, b) => a.user.full_name.localeCompare(b.user.full_name));
    if (sort === "loaded") list.sort((a, b) => ratio(b) - ratio(a));
    if (sort === "available") list.sort((a, b) => (b.capacity - b.current_count) - (a.capacity - a.current_count));
    return list;
  }, [supervisors, sort]);
  if (error) return <Alert>{error}</Alert>;
  if (!supervisors) return <Spinner className="mt-20 h-8 w-8" />;
  const capacity = supervisors.reduce((n, s) => n + s.capacity, 0);
  const used = supervisors.reduce((n, s) => n + s.current_count, 0);
  const full = supervisors.filter((s) => s.current_count >= s.capacity).length;
  function exportCsv() {
    downloadCsv("supervisor-workload.csv", [
      ["Supervisor", "Email", "Department", "Designation", "Capacity", "Supervising", "Available"],
        ...supervisors!.map((s) => [
        s.user.full_name, s.user.email, s.department.name, s.designation.name,
        s.capacity, s.current_count, s.capacity - s.current_count,
      ]),
    ]);
  }
  return (
    <>
      <PageHeader
        title="Supervisor workload"
        description="How many students each supervisor has compared with their capacity."
        actions={
          <>
            <Select compact value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-44">
              <option value="loaded">Most loaded first</option>
              <option value="available">Most available first</option>
              <option value="name">Name</option>
            </Select>
            <Button variant="secondary" onClick={exportCsv} disabled={supervisors.length === 0}>
              <Download className="h-4 w-4" />Export CSV
            </Button>
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Supervisors" value={supervisors.length} icon={Users} tone="brand" />
        <StatCard label="Slots in use" value={`${used}/${capacity}`} icon={UserCheck} tone="info" />
        <StatCard
          label="Overall utilisation"
          value={capacity > 0 ? `${Math.round((used / capacity) * 100)}%` : "0%"}
          icon={Gauge}
          tone="warning"
        />
        <StatCard label="Supervisors at capacity" value={full} icon={UserX} tone="success" />
      </div>
      <Card>
        <Table
          headers={["Supervisor", "Designation", "Research fields", "Load", "Status"]}
          emptyText={supervisors.length === 0 ? "No supervisor has created a profile yet." : undefined}
        >
          {rows.map((s) => {
            const ratio = s.capacity > 0 ? s.current_count / s.capacity : 1;
            const tone = ratio >= 1 ? "danger" : ratio >= 0.8 ? "warning" : "success";
            const label = ratio >= 1 ? "Full" : ratio >= 0.8 ? "Almost full" : "Available";
            return (
              <tr key={s.id} className="hover:bg-ink/[0.02]">
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={s.user.full_name} />
                    <div>
                      <div className="font-medium">{s.user.full_name}</div>
                      <div className="text-xs text-subtle">{s.department.name}</div>
                    </div>
                  </div>
                </Td>
                <Td>{s.designation.name}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {s.fields.length === 0
                      ? <span className="text-xs text-subtle">None chosen</span>
                      : s.fields.map((f) => <Badge key={f.id} tone="brand">{f.name}</Badge>)}
                  </div>
                </Td>
                <Td>
                  <div className="flex w-40 items-center gap-2">
                    <ProgressBar value={s.current_count} max={s.capacity} />
                    <span className="text-xs font-medium tabular-nums">{s.current_count}/{s.capacity}</span>
                  </div>
                </Td>
                <Td><Badge tone={tone}>{label}</Badge></Td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}