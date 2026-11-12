"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { DownloadButton } from "@/components/supervision/DownloadButton";
import { FeedbackNotes } from "@/components/supervision/FeedbackNotes";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { FilePicker } from "@/components/ui/FilePicker";
import { Field, Textarea } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StatusTimeline } from "@/components/ui/StatusTimeline";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPost, errorMessage } from "@/lib/apiClient";
import { timeAgo } from "@/lib/format";
import {
  ACCEPT_FILES, MILESTONE_LABEL, MILESTONE_TONE, dueText, formatDay, isOpenForWork,
} from "@/lib/supervisionUi";
import { apiUpload } from "@/lib/upload";
import { Milestone, MilestoneStatusValue, MilestoneSubmission } from "@/lib/types";

const STEPS = ["Planned", "Handed in", "Reviewed", "Completed"];

const SUBMISSION_LABEL = { submitted: "Waiting", revision_required: "Changes requested", completed: "Approved" };
const SUBMISSION_TONE = { submitted: "info", revision_required: "warning", completed: "success" } as const;

function stepOf(status: MilestoneStatusValue): number {
  if (status === "completed") return STEPS.length;
  if (status === "submitted" || status === "under_review") return 1;
  if (status === "revision_required") return 2;
  return 0;
}

export default function SubmitWorkPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [history, setHistory] = useState<MilestoneSubmission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const base = `/api/v1/milestones/${params.id}`;

  const load = useCallback(async () => {
    try {
      setMilestone(await apiGet<Milestone>(base));
      setHistory(await apiGet<MilestoneSubmission[]>(`${base}/submissions`));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [base]);

  useEffect(() => { load(); }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const form = new FormData();
    form.append("note", note);
    if (file) form.append("file", file);
    setBusy(true);
    try {
      await apiUpload(`${base}/submissions`, form);
      toast.success("Work handed in. Your supervisor will review it.");
      setNote("");
      setFile(null);
      setPickerKey((k) => k + 1);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function resolve(id: number) {
    try {
      await apiPost(`/api/v1/feedback/${id}/resolve`);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  if (error) return <Alert>{error}</Alert>;
  if (!milestone) return <Spinner className="mt-20 h-8 w-8" />;

  const open = isOpenForWork(milestone.status);

  return (
    <>
      <PageHeader
        title={milestone.title}
        description={milestone.description || "Hand in your work for this milestone."}
        actions={
          <>
            <Badge tone={MILESTONE_TONE[milestone.status]}>{MILESTONE_LABEL[milestone.status]}</Badge>
            <Link href="/student/milestones">
              <Button variant="secondary" size="sm"><ArrowLeft className="h-4 w-4" />All milestones</Button>
            </Link>
          </>
        }
      />

      <Card className="mb-6">
        <CardContent>
          <StatusTimeline
            steps={STEPS}
            current={stepOf(milestone.status)}
            warning={milestone.status === "revision_required"}
          />
          <p className="mt-4 text-center text-sm text-subtle">
            {dueText(milestone)} · deadline {formatDay(milestone.deadline)}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          {open ? (
            <Card>
              <CardHeader
                title={milestone.status === "revision_required" ? "Hand in the revised work" : "Hand in your work"}
                description="A note, a file, or both. Files up to 20 MB."
              />
              <CardContent>
                <form className="space-y-4" onSubmit={submit}>
                  <Field label="Note for your supervisor" hint="What you did, and anything you want feedback on.">
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} />
                  </Field>
                  <div className="space-y-1.5">
                    <div className="text-sm font-medium">File (optional)</div>
                    <FilePicker key={pickerKey} accept={ACCEPT_FILES} onChange={setFile} />
                    <p className="text-xs text-subtle">PDF, Word, PowerPoint, Excel, zip, images or text.</p>
                  </div>
                  <Button type="submit" loading={busy} disabled={!note.trim() && !file}>
                    <Send className="h-4 w-4" />Submit work
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Alert>
              {milestone.status === "completed"
                ? "This milestone is completed."
                : "Your work is waiting for your supervisor's review."}
            </Alert>
          )}
        </div>

        <div className="space-y-4 lg:col-span-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">Your submissions</h2>
          {history.length === 0 && <p className="text-sm text-subtle">Nothing handed in yet.</p>}
          {history.map((s) => (
            <Card key={s.id}>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-subtle">{timeAgo(s.submitted_at)}</span>
                  <Badge tone={SUBMISSION_TONE[s.status]}>{SUBMISSION_LABEL[s.status]}</Badge>
                </div>
                {s.note && <p className="whitespace-pre-line">{s.note}</p>}
                {s.file && (
                  <DownloadButton
                    path={`/api/v1/submissions/${s.id}/download`}
                    filename={s.file.original_name}
                    size={s.file.size_bytes}
                  />
                )}
                <FeedbackNotes items={s.feedback} onResolve={resolve} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}