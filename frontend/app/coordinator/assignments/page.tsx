"use client";
import { FormEvent, useState } from "react";
import { Pencil, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Field, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Td } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { daysAgoLabel } from "@/lib/format";
import {
  ASSIGNABLE_SUPERVISORS, AssignmentRow, ASSIGNMENTS, UNASSIGNED,
} from "@/lib/mock/coordinatorDemo";
interface Target {
  student: string;
  title: string;
  // set only when changing an existing assignment:
  rowId?: number;
  // the supervisor being replaced:
  current?: string;
}
export default function AssignmentsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<AssignmentRow[]>(ASSIGNMENTS);
  const [unassigned, setUnassigned] = useState(UNASSIGNED);
  const [supervisors, setSupervisors] = useState(ASSIGNABLE_SUPERVISORS);
  const [target, setTarget] = useState<Target | null>(null);
  const [choice, setChoice] = useState("");
  const [reason, setReason] = useState("");
  function open(t: Target) {
    setTarget(t);
    setChoice("");
    setReason("");
  }
  function save(e: FormEvent) {
    e.preventDefault();
    if (!target || !choice) return;
    // keep the supervisors' loads in step with the change
    setSupervisors((list) =>
      list.map((s) => {
              if (s.name === choice) return { ...s, load: s.load + 1 };
        if (s.name === target.current) return { ...s, load: s.load - 1 };
        return s;
      }),
    );
    if (target.rowId !== undefined) {
      setRows((list) =>
        list.map((r) =>
          r.id === target.rowId ? { ...r, supervisor: choice, method: "Manual override", daysAgo: 0 } : r,
        ),
      );
    } else {
      const created: AssignmentRow = {
        id: Date.now(), student: target.student, title: target.title,
        supervisor: choice, method: "Manual override", daysAgo: 0,
      };
      setRows((list) => [created, ...list]);
      setUnassigned((list) => list.filter((u) => u.student !== target.student));
    }
    toast.success(`${target.student} is now supervised by ${choice} (demo: not saved yet)`);
    setTarget(null);
  }
  return (
    <>
      <PageHeader
        title="Assignments"
        description="Who supervises whom. You can change any assignment; overrides are recorded with your reason."
      />
      <DemoBanner />
      {unassigned.length > 0 && (
        <Card className="mb-6 border-warning/30">
          <CardHeader title="Needs a supervisor" description="The allocation could not place these students." />
          <ul className="divide-y divide-line">
            {unassigned.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{u.student}</div>
                  <div className="truncate text-subtle">{u.title}</div>
                </div>
                <Button size="sm" onClick={() => open({ student: u.student, title: u.title })}>
                  <UserPlus className="h-4 w-4" />Assign
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <Table headers={["Student", "Proposal", "Supervisor", "How", "When", ""]}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-ink/[0.02]">
              <Td className="font-medium">{r.student}</Td>
              <Td className="max-w-[240px] truncate text-subtle">{r.title}</Td>
              <Td>{r.supervisor}</Td>
              <Td>
                <Badge tone={r.method === "Merit allocation" ? "brand" : "warning"}>{r.method}</Badge>
              </Td>
              <Td className="text-subtle">{daysAgoLabel(r.daysAgo)}</Td>
              <Td className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => open({ student: r.student, title: r.title, rowId: r.id, current: r.supervisor })}
                >
                  <Pencil className="h-3.5 w-3.5" />Change
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
      <Modal
        open={target !== null}
        title={target?.current ? "Change supervisor" : "Assign supervisor"}
        onClose={() => setTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
            <Button type="submit" form="assign-form">Save assignment</Button>
          </>
             }
      >
        {target && (
          <form id="assign-form" className="space-y-4" onSubmit={save}>
            <div className="text-sm">
              <div className="font-medium">{target.student}</div>
              <div className="text-subtle">{target.title}</div>
            </div>
            <Field label="Supervisor">
              <Select value={choice} onChange={(e) => setChoice(e.target.value)} required>
                <option value="">Select a supervisor...</option>
                {supervisors
                  .filter((s) => s.name !== target.current)
                  .map((s) => (
                    <option key={s.name} value={s.name} disabled={s.load >= s.capacity}>
                      {s.name} ({s.designation}, {s.load}/{s.capacity}{s.load >= s.capacity ? ", full" : ""})
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Reason" hint="Recorded in the audit log.">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} required />
            </Field>
          </form>
        )}
      </Modal>
    </>
  );
}