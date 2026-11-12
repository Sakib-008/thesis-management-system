"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarPlus, Pencil, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/dialogs";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import { Table, Td } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { apiDelete, apiGet, apiPost, apiPut, errorMessage } from "@/lib/apiClient";
import { timeAgo } from "@/lib/format";
import { MILESTONE_LABEL, MILESTONE_TONE, dueText, formatDay } from "@/lib/supervisionUi";
import { Milestone, MilestoneSubmission, ThesisProgress } from "@/lib/types";

type Dialog = { kind: "add"; thesisId: number } | { kind: "edit"; milestone: Milestone } | null;
const EMPTY = { title: "", description: "", start_date: "", deadline: "" };

export default function SupervisorMilestonesPage() {
  const toast = useToast();
  const [students, setStudents] = useState<ThesisProgress[] | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [queue, setQueue] = useState<MilestoneSubmission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Milestone | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, m, q] = await Promise.all([
        apiGet<ThesisProgress[]>("/api/v1/milestones/progress"),
        apiGet<Milestone[]>("/api/v1/milestones"),
        apiGet<MilestoneSubmission[]>("/api/v1/submissions?status=submitted"),
      ]);
      setStudents(p);
      setMilestones(m);
      setQueue(q);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
      setStudents([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openDialog(next: Dialog) {
    setForm(
      next?.kind === "edit"
        ? {
            title: next.milestone.title,
            description: next.milestone.description,
            start_date: next.milestone.start_date ?? "",
            deadline: next.milestone.deadline,
          }
        : EMPTY,
    );
    setDialog(next);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!dialog) return;
    const body = {
      title: form.title,
      description: form.description,
      start_date: form.start_date || null,
      deadline: form.deadline,
    };
    setBusy(true);
    try {
      if (dialog.kind === "add") {
        await apiPost("/api/v1/milestones", { thesis_id: dialog.thesisId, ...body });
        toast.success("Milestone added");
      } else {
        await apiPut(`/api/v1/milestones/${dialog.milestone.id}`, body);
        toast.success("Milestone saved");
      }
      setDialog(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    try {
      await apiDelete(`/api/v1/milestones/${deleting.id}`);
      toast.success("Milestone deleted");
      setDeleting(null);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
      setDeleting(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Milestones"
        description="Plan the stages of each student's thesis, and review the work they hand in."
      />
      {error && <Alert>{error}</Alert>}
      {students === null && <Spinner className="mt-10 h-8 w-8" />}

      {queue.length > 0 && (
        <Card className="mb-6">
          <CardHeader title="Waiting for your review" description={`${queue.length} submission(s) to look at.`} />
          <ul className="divide-y divide-line">
            {queue.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <div className="font-medium">{s.student_names.join(", ")}: {s.milestone_title}</div>
                  <div className="text-xs text-subtle">Handed in {timeAgo(s.submitted_at)}</div>
                </div>
                <Link href={`/supervisor/submissions/${s.id}/review`}>
                  <Button size="sm">Review</Button>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {students !== null && students.length === 0 && !error && (
        <p className="text-sm text-subtle">
          You have no students yet. They appear here once the coordinator assigns them.
        </p>
      )}

      <div className="space-y-6">
        {(students ?? []).map((st) => (
          <Card key={st.thesis_id}>
            <CardHeader
              title={st.student_names.join(", ")}
              description={st.title}
              action={
                <Button size="sm" onClick={() => openDialog({ kind: "add", thesisId: st.thesis_id })}>
                  <CalendarPlus className="h-4 w-4" />Add milestone
                </Button>
              }
            />
            <CardContent className="space-y-2 border-b border-line">
              <div className="flex items-center gap-3">
                <ProgressBar value={st.completed} max={Math.max(st.total, 1)} />
                <span className="w-12 text-right text-sm font-medium tabular-nums">{st.percent}%</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge tone="success">{st.completed} of {st.total} completed</Badge>
                {st.in_review > 0 && <Badge tone="info">{st.in_review} to review</Badge>}
                {st.revision_required > 0 && (
                  <Badge tone="warning">{st.revision_required} with changes requested</Badge>
                )}
                {st.overdue > 0 && <Badge tone="danger">{st.overdue} overdue</Badge>}
              </div>
            </CardContent>
            <Table
              headers={["Milestone", "Deadline", "Status", "Submissions", ""]}
              emptyText={
                milestones.every((m) => m.thesis_id !== st.thesis_id) ? "No milestones planned yet." : undefined
              }
            >
              {milestones.filter((m) => m.thesis_id === st.thesis_id).map((m) => (
                <tr key={m.id}>
                  <Td>
                    <div className="font-medium">{m.title}</div>
                    {m.description && (
                      <div className="max-w-[280px] truncate text-xs text-subtle">{m.description}</div>
                    )}
                  </Td>
                  <Td>
                    <div>{formatDay(m.deadline)}</div>
                    <div className={m.overdue ? "text-xs text-danger" : "text-xs text-subtle"}>{dueText(m)}</div>
                  </Td>
                  <Td><Badge tone={MILESTONE_TONE[m.status]}>{MILESTONE_LABEL[m.status]}</Badge></Td>
                  <Td className="tabular-nums">{m.submissions_count}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      {m.latest_submission_id !== null && m.status === "submitted" && (
                        <Link href={`/supervisor/submissions/${m.latest_submission_id}/review`}>
                          <Button size="sm">Review</Button>
                        </Link>
                      )}
                      {m.status !== "completed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Edit milestone"
                          onClick={() => openDialog({ kind: "edit", milestone: m })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {m.submissions_count === 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Delete milestone"
                          className="text-danger hover:bg-danger/10"
                          onClick={() => setDeleting(m)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          </Card>
        ))}
      </div>

      <Modal
        open={dialog !== null}
        title={dialog?.kind === "edit" ? "Edit milestone" : "Add a milestone"}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
            <Button type="submit" form="milestone-form" loading={busy}>Save</Button>
          </>
        }
      >
        <form id="milestone-form" className="space-y-4" onSubmit={save}>
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              minLength={3}
              maxLength={200}
            />
          </Field>
          <Field label="What is expected" hint="Optional.">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" hint="Optional.">
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </Field>
            <Field label="Deadline">
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                required
              />
            </Field>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this milestone?"
        message={`"${deleting?.title ?? ""}" has no submissions, so nothing else is lost.`}
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}