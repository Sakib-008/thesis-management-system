"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, EyeOff, Play, UserX, Users } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/dialogs";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StatCard } from "@/components/ui/StatCard";
import { Table, Td } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPost, errorMessage } from "@/lib/apiClient";
import { timeAgo } from "@/lib/format";
import { AllocationReadiness, AllocationRun, AllocationRunSummary } from "@/lib/types";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

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
  const [readiness, setReadiness] = useState<AllocationReadiness | null>(null);
  const [runs, setRuns] = useState<AllocationRunSummary[] | null>(null);
  const [shown, setShown] = useState<AllocationRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const openRun = useCallback(async (id: number) => {
    try {
      setShown(await apiGet<AllocationRun>(`/api/v1/allocation/runs/${id}`));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [r, history] = await Promise.all([
        apiGet<AllocationReadiness>("/api/v1/allocation/readiness"),
        apiGet<AllocationRunSummary[]>("/api/v1/allocation/runs"),
      ]);
      setReadiness(r);
      setRuns(history);
      return history;
    } catch (e) {
      setError(errorMessage(e));
      setRuns([]);
      return [];
    }
  }, []);

  useEffect(() => {
    load().then((history) => { if (history.length > 0) openRun(history[0].id); });
  }, [load, openRun]);

  async function run() {
    setConfirming(false);
    setRunning(true);
    setError(null);
    try {
      const result = await apiPost<AllocationRun>("/api/v1/allocation/runs");
      setShown(result);
      toast.success(
        `Allocation finished: ${result.matched_count} matched, ${result.unmatched_count} need a decision`,
      );
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Assignment runs"
        description="Place waiting students with supervisors. You review every result and can change any assignment."
      />
      {error && <Alert>{error}</Alert>}

      <div
        className={
          "mb-6 flex items-start gap-2 rounded-lg border border-line bg-surface " +
          "px-3 py-2.5 text-sm text-subtle"
        }
      >
        <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          Students are served in order of verified CGPA, highest first. That order is never shown to anyone, and
          results are listed alphabetically.
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Before you run" description="Live checks from the database." />
          <CardContent className="space-y-5">
            {!readiness ? (
              <Spinner className="mx-auto my-6 h-6 w-6" />
            ) : (
              <>
                <ul className="space-y-3">
                  <Check ok={readiness.waiting_verified > 0}>
                    {plural(readiness.waiting_verified, "student")} waiting with a verified CGPA
                  </Check>
                  <Check ok={readiness.waiting_unverified === 0}>
                    {readiness.waiting_unverified === 0 ? (
                      "Every waiting student has a verified CGPA"
                    ) : (
                      <>
                        {plural(readiness.waiting_unverified, "waiting student")} will be skipped because the CGPA is
                        not verified.{" "}
                        <Link href="/coordinator/students" className="font-medium text-brand hover:underline">
                          Verify CGPAs
                        </Link>
                      </>
                    )}
                  </Check>
                  <Check ok={readiness.open_slots > 0}>
                    {plural(readiness.open_slots, "free supervision place")} with{" "}
                    {plural(readiness.supervisors_with_slots, "supervisor")}
                  </Check>
                </ul>
                <Button
                  onClick={() => setConfirming(true)}
                  loading={running}
                  disabled={readiness.waiting_verified === 0}
                >
                  <Play className="h-4 w-4" />Run allocation
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Run history" />
          {runs === null ? (
            <Spinner className="mx-auto my-6 h-6 w-6" />
          ) : runs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-subtle">No runs yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {runs.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <div className="font-medium">Run #{r.id}</div>
                    <div className="text-xs text-subtle">
                      {timeAgo(r.run_at)} · {r.matched_count} matched · {r.unmatched_count} open
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={shown?.id === r.id ? "primary" : "secondary"}
                    onClick={() => openRun(r.id)}
                  >
                    View
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {shown && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Students processed" value={shown.processed} icon={Users} tone="info" />
            <StatCard label="Matched" value={shown.matched_count} icon={CheckCircle2} tone="success" />
            <StatCard label="Need your decision" value={shown.unmatched_count} icon={UserX} tone="warning" />
          </div>

          <Card className="mb-6">
            <CardHeader
              title={`Result of run #${shown.id}`}
              description={`Started by ${shown.triggered_by_name}, ${timeAgo(shown.run_at)}.`}
            />
            <Table headers={["Student", "Proposal", "Assigned supervisor", "Match", "On their list"]}>
              {shown.matched.map((m) => (
                <tr key={m.proposal_id}>
                  <Td className="font-medium">{m.student_name}</Td>
                  <Td className="max-w-[260px] truncate">{m.title}</Td>
                  <Td>{m.supervisor_name}</Td>
                  <Td className="tabular-nums">{Math.round(m.score)}%</Td>
                  <Td>
                    {m.choice === 1 ? <Badge tone="success">Best match</Badge> : <Badge>#{m.choice} match</Badge>}
                  </Td>
                </tr>
              ))}
            </Table>
          </Card>

          {shown.unmatched.length > 0 && (
            <Card className="mb-6">
              <CardHeader
                title="Students who need your decision"
                description="Not forced onto a poor match. Choose a supervisor for them yourself."
                action={<Link href="/coordinator/assignments"><Button size="sm">Assign manually</Button></Link>}
              />
              <Table headers={["Student", "Proposal", "Why"]}>
                {shown.unmatched.map((u) => (
                  <tr key={u.proposal_id}>
                    <Td className="font-medium">{u.student_name}</Td>
                    <Td className="max-w-[260px] truncate">{u.title}</Td>
                    <Td className="text-subtle">{u.message}</Td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}

          {shown.skipped_unverified.length > 0 && (
            <p className="text-sm text-subtle">
              Skipped because their CGPA is not verified: {shown.skipped_unverified.join(", ")}.
            </p>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirming}
        title="Run the allocation?"
        message="Every waiting student with a verified CGPA will be placed with the best available supervisor. You can change any assignment afterwards."
        confirmLabel="Run allocation"
        onConfirm={run}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
