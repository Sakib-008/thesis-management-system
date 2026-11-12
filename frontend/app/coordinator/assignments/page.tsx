"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Td } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPut, errorMessage } from "@/lib/apiClient";
import { timeAgo } from "@/lib/format";
import { Assignment, Supervisor, WaitingStudent } from "@/lib/types";

type Tab = "waiting" | "assigned";

interface Target {
  proposalId: number;
  student: string;
  title: string;
  currentSupervisorId: number | null;
}

export default function AssignmentsPage() {
  const toast = useToast();
  const [assigned, setAssigned] = useState<Assignment[] | null>(null);
  const [waiting, setWaiting] = useState<WaitingStudent[] | null>(null);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("waiting");
  const [target, setTarget] = useState<Target | null>(null);
  const [supervisorId, setSupervisorId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, w, s] = await Promise.all([
        apiGet<Assignment[]>("/api/v1/assignments"),
        apiGet<WaitingStudent[]>("/api/v1/assignments/waiting"),
        apiGet<Supervisor[]>("/api/v1/supervisors"),
      ]);
      setAssigned(a);
      setWaiting(w);
      setSupervisors(s);
      return w.length;
    } catch (e) {
      setError(errorMessage(e));
      setAssigned([]);
      setWaiting([]);
      return 0;
    }
  }, []);

  useEffect(() => {
    load().then((waitingCount) => setTab(waitingCount > 0 ? "waiting" : "assigned"));
  }, [load]);

  function openDialog(next: Target) {
    setTarget(next);
    setSupervisorId("");
    setReason("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!target || !supervisorId) return;
    setBusy(true);
    try {
      await apiPut(`/api/v1/proposals/${target.proposalId}/assignment`, {
        supervisor_id: Number(supervisorId),
        reason,
      });
      toast.success(target.currentSupervisorId ? "Supervisor changed" : "Supervisor assigned");
      setTarget(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Assignments"
        description="Every student's supervisor. Place students the allocation could not, or change any assignment."
      />
      {error && <Alert>{error}</Alert>}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "waiting", label: "Needs a supervisor", count: waiting?.length ?? 0 },
          { id: "assigned", label: "Assigned", count: assigned?.length ?? 0 },
        ]}
      />

      {tab === "waiting" ? (
        <Card>
          <Table
            headers={["Student", "Proposal", "CGPA", "Note", ""]}
            loading={waiting === null}
            emptyText={
              waiting !== null && waiting.length === 0 ? "Every approved student has a supervisor." : undefined
            }
          >
            {(waiting ?? []).map((w) => (
              <tr key={w.proposal_id}>
                <Td className="font-medium">{w.student_name}</Td>
                <Td className="max-w-[260px] truncate">{w.title}</Td>
                <Td>
                  <Badge tone={w.cgpa_verified ? "success" : "warning"}>
                    {w.cgpa_verified ? "Verified" : "Not verified"}
                  </Badge>
                </Td>
                <Td className="text-subtle">{w.note ?? (w.cgpa_verified ? "-" : "Skipped by the allocation")}</Td>
                <Td className="text-right">
                  <Button
                    size="sm"
                    onClick={() => openDialog({
                      proposalId: w.proposal_id, student: w.student_name, title: w.title, currentSupervisorId: null,
                    })}
                  >
                    Assign
                  </Button>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : (
        <Card>
          <Table
            headers={["Student", "Proposal", "Supervisor", "How", "Match", "When", ""]}
            loading={assigned === null}
            emptyText={assigned !== null && assigned.length === 0 ? "No assignments yet." : undefined}
          >
            {(assigned ?? []).map((a) => (
              <tr key={a.id}>
                <Td className="font-medium">{a.student_name}</Td>
                <Td className="max-w-[220px] truncate">{a.title}</Td>
                <Td>
                  <div>{a.supervisor_name}</div>
                  <div className="text-xs text-subtle">{a.designation}</div>
                </Td>
                <Td>
                  <Badge tone={a.method === "merit_allocation" ? "brand" : "warning"}>
                    {a.method === "merit_allocation" ? "Allocation" : "Manual"}
                  </Badge>
                  {a.reason && <div className="mt-1 max-w-[200px] text-xs text-subtle">{a.reason}</div>}
                </Td>
                <Td className="tabular-nums">{a.score !== null ? `${Math.round(a.score)}%` : "-"}</Td>
                <Td className="text-subtle">{timeAgo(a.assigned_at)}</Td>
                <Td className="text-right">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openDialog({
                      proposalId: a.proposal_id, student: a.student_name, title: a.title,
                      currentSupervisorId: a.supervisor_id,
                    })}
                  >
                    Change
                  </Button>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <Modal
        open={target !== null}
        title={target?.currentSupervisorId ? "Change supervisor" : "Assign a supervisor"}
        onClose={() => setTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
            <Button type="submit" form="assign-form" loading={busy} disabled={!supervisorId || !reason.trim()}>
              Save
            </Button>
          </>
        }
      >
        {target && (
          <form id="assign-form" className="space-y-4" onSubmit={submit}>
            <div className="text-sm">
              <div className="font-medium">{target.student}</div>
              <div className="text-subtle">{target.title}</div>
            </div>
            <Field label="Supervisor" hint="A supervisor who is at capacity cannot be chosen.">
              <Select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} required>
                <option value="">Choose a supervisor</option>
                {supervisors.map((s) => {
                  const full = s.current_count >= s.capacity;
                  const same = s.id === target.currentSupervisorId;
                  return (
                    <option key={s.id} value={s.id} disabled={full || same}>
                      {s.user.full_name} · {s.designation.name} · {s.current_count}/{s.capacity}
                      {full ? " · full" : ""}{same ? " · current" : ""}
                    </option>
                  );
                })}
              </Select>
            </Field>
            <Field label="Reason" hint="Required. It is recorded in the audit log.">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} required />
            </Field>
          </form>
        )}
      </Modal>
    </>
  );
}
