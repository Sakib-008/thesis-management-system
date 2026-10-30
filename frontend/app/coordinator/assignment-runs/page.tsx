"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, EyeOff, Loader2, Play, Shuffle, UserX, Users } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/dialogs";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StatCard } from "@/components/ui/StatCard";
import { Table, Td } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { apiGet, errorMessage } from "@/lib/apiClient";
import { daysAgoLabel } from "@/lib/format";
import { ALLOCATION_RESULT, PENDING_ALLOCATION, RUN_HISTORY } from "@/lib/mock/coordinatorDemo";
import { Student, Supervisor } from "@/lib/types";
type Phase = "idle" | "running" | "done";
function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <li className="flex items-start gap-3 text-sm">
      <Icon className={ok ? "mt-0.5 h-4 w-4 text-success" : "mt-0.5 h-4 w-4 text-warning"} />
      <span>{children}</span>
    </li>
  );
}
export default function AssignmentRunsPage() {
  const toast = useToast();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [supervisors, setSupervisors] = useState<Supervisor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    Promise.all([
      apiGet<Student[]>("/api/v1/students"),
      apiGet<Supervisor[]>("/api/v1/supervisors"),
    ])
      .then(([s, sup]) => { setStudents(s); setSupervisors(sup); })
      .catch((e) => setError(errorMessage(e)));
    return () => clearTimeout(timer.current);
  }, []);
  function run() {
    setConfirming(false);
    setPhase("running");
    timer.current = setTimeout(() => {
      setPhase("done");
      toast.success("Allocation finished (demo result)");
    }, 1800);
  }
  if (error) return <Alert>{error}</Alert>;
  if (!students || !supervisors) return <Spinner className="mt-20 h-8 w-8" />;
  const verified = students.filter((s) => s.cgpa_verified).length;
  const unverified = students.length - verified;
  const openSlots = supervisors.reduce((n, s) => n + (s.capacity - s.current_count), 0);
  const { matched, unmatched } = ALLOCATION_RESULT;
  return (
    <>
      <PageHeader
        title="Assignment runs"
        description="Match approved proposals to supervisors. You review the result and can override any assignment."
        actions={
          <Button onClick={() => setConfirming(true)} loading={phase === "running"}>
            <Play className="h-4 w-4" />Run allocation
          </Button>
        }
      />
      <Card className="mb-6">
        <CardHeader title="Before you run" description="Checked against your live data" />
        <CardContent>
          <ul className="space-y-3">
            <Check ok={unverified === 0}>
              {verified} of {students.length} student CGPAs verified.
              {unverified > 0 && " Students with an unverified CGPA are left out of the run."}
              {unverified > 0 && (
                <>
                  {" "}
                  <Link href="/coordinator/students" className="font-medium text-brand hover:underline">
                    Verify now
                  </Link>
                </>
              )}
            </Check>
            <Check ok={openSlots > 0}>
              {openSlots} open supervision slot{openSlots === 1 ? "" : "s"} across {supervisors.length} supervisor
              {supervisors.length === 1 ? "" : "s"}.
               </Check>
            <Check ok>
              {PENDING_ALLOCATION.length} approved proposals are waiting for a supervisor (sample data).
            </Check>
          </ul>
        </CardContent>
      </Card>
      {phase === "running" && (
        <Card className="mb-6">
          <CardContent className="flex items-center gap-3 text-sm">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
            Running the allocation. Students are processed in order of verified CGPA...
          </CardContent>
        </Card>
      )}
      {phase === "done" && (
        <div className="mb-6 space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">Latest result</h2>
            <DemoBadge />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Students processed" value={PENDING_ALLOCATION.length} icon={Users} tone="info" />
            <StatCard label="Matched to a supervisor" value={matched.length} icon={Shuffle} tone="success" />
            <StatCard label="Need manual assignment" value={unmatched.length} icon={UserX} tone="warning" />
          </div>
          <Card>
            <CardHeader title="Matched" />
            <Table headers={["Student", "Proposal", "Assigned supervisor", "AI match"]}>
              {matched.map((m) => (
                <tr key={m.student}>
                  <Td className="font-medium">{m.student}</Td>
                  <Td className="max-w-[260px] truncate text-subtle">{m.title}</Td>
                  <Td>{m.supervisor}</Td>
                  <Td><Badge tone="brand">{m.score}%</Badge></Td>
                </tr>
              ))}
            </Table>
          </Card>
          {unmatched.length > 0 && (
            <Card className="border-warning/30">
              <CardHeader
                title="Needs your decision"
                description="No supervisor with free capacity fit these students."
              />
              <ul className="divide-y divide-line">
                {unmatched.map((u) => (
                  <li key={u.student} className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{u.student}</div>
                      <div className="truncate text-subtle">{u.title}</div>
                      <div className="mt-1 text-xs text-warning">{u.reason}</div>
                    </div>
                    <Link href="/coordinator/assignments"><Button size="sm">Assign manually</Button></Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Run history" action={<DemoBadge />} />
          <Table headers={["Run", "When", "Matched", "Needed manual", "Status"]}>
            {RUN_HISTORY.map((r) => (
              <tr key={r.id}>
                <Td className="font-medium">#{r.id}</Td>
                <Td className="text-subtle">{daysAgoLabel(r.daysAgo)}</Td>
                <Td>{r.matched}</Td>
                <Td>{r.unmatched}</Td>
                <Td>
                  <Badge tone={r.unmatched > 0 ? "warning" : "success"}>{r.status}</Badge>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card className="h-fit">
            <CardHeader title="How it works" />
          <CardContent className="space-y-3 text-sm text-subtle">
            <p>
              Students are processed in order of verified CGPA, highest first. Each student is placed with the
              best-matched supervisor from their own AI recommendation list who still has capacity.
            </p>
            <p className="flex gap-2">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                The CGPA order and any ranking stay inside the allocation service. They are never shown here
                or to anyone else.
              </span>
            </p>
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Run the allocation?"
        message={
          `${PENDING_ALLOCATION.length} students waiting for a supervisor will be matched. ` +
          "You can review and override every result afterwards."
        }
        confirmLabel="Run allocation"
        onCancel={() => setConfirming(false)}
        onConfirm={run}
      />
    </>
  );
}