"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { CalendarClock, ClipboardList, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useToast } from "@/components/ui/Toast";
import { daysAgoLabel, dueLabel } from "@/lib/format";
import { STATUS_TONE } from "@/lib/mock/shared";
import { milestonesFor, StudentMilestone, SUBMISSIONS_TO_REVIEW, SUPERVISOR_STUDENTS } from "@/lib/mock/supervisorDemo";

const EMPTY = { title: "", description: "", start: "", deadline: "" };

export default function SupervisorMilestonesPage() {
  const toast = useToast();
  const [studentId, setStudentId] = useState(SUPERVISOR_STUDENTS[0].id);
  const [added, setAdded] = useState<Record<number, StudentMilestone[]>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const student = SUPERVISOR_STUDENTS.find((s) => s.id === studentId) ?? SUPERVISOR_STUDENTS[0];
  const milestones = useMemo(() => [...milestonesFor(student), ...(added[student.id] ?? [])], [student, added]);

  function create(e: FormEvent) {
    e.preventDefault();
    const daysLeft = Math.ceil((new Date(form.deadline).getTime() - Date.now()) / 86_400_000);
    const created: StudentMilestone = { id: Date.now(), title: form.title, progress: 0, daysLeft, status: daysLeft < 0 ? "Overdue" : "Not started" };
    setAdded((a) => ({ ...a, [student.id]: [...(a[student.id] ?? []), created] }));
    toast.success(`Milestone added for ${student.name} (demo: not saved yet)`);
    setOpen(false);
    setForm(EMPTY);
  }

  return (
    <>
      <PageHeader
        title="Milestones"
        description="Plan each student's thesis as a series of milestones, and review the work they submit."
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add milestone</Button>}
      />
      <DemoBanner />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="max-w-xs">
            <Field label="Student">
              <Select value={studentId} onChange={(e) => setStudentId(Number(e.target.value))}>
                {SUPERVISOR_STUDENTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          </div>

          {milestones.map((m) => (
            <Card key={m.id}>
              <div className="space-y-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{m.title}</h3>
                    <Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge>
                  </div>
                  <span className={m.status === "Overdue" ? "flex items-center gap-1 text-xs font-medium text-danger" : "flex items-center gap-1 text-xs text-subtle"}>
                    <CalendarClock className="h-3.5 w-3.5" />{m.status === "Completed" ? "Finished" : dueLabel(m.daysLeft)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <ProgressBar value={m.progress} max={100} />
                  <span className="w-10 text-right text-xs font-medium tabular-nums">{m.progress}%</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="h-fit">
          <CardHeader title="Submissions to review" description={`${SUBMISSIONS_TO_REVIEW.length} waiting`} />
          <ul className="divide-y divide-line">
            {SUBMISSIONS_TO_REVIEW.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3.5 text-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info"><ClipboardList className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.milestone} v{s.version}</div>
                  <div className="text-xs text-subtle">{s.student} · {daysAgoLabel(s.daysAgo)}</div>
                </div>
                <Link href={`/supervisor/submissions/${s.id}/review`}><Button size="sm">Review</Button></Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Modal open={open} title={`Add milestone for ${student.name}`} onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="add-milestone-form">Add milestone</Button>
          </>
        }>
        <form id="add-milestone-form" className="space-y-4" onSubmit={create}>
          <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
          <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date"><Input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></Field>
            <Field label="Deadline"><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} required /></Field>
          </div>
        </form>
      </Modal>
    </>
  );
}