"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { DownloadButton } from "@/components/supervision/DownloadButton";
import { FeedbackNotes } from "@/components/supervision/FeedbackNotes";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DecisionToggle, Decision } from "@/components/ui/DecisionToggle";
import { Field, Textarea } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPost, errorMessage } from "@/lib/apiClient";
import { timeAgo } from "@/lib/format";
import { MilestoneSubmission } from "@/lib/types";

const STATUS_LABEL = {
  submitted: "Waiting for review",
  revision_required: "Changes requested",
  completed: "Approved",
};

export default function ReviewSubmissionPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [submission, setSubmission] = useState<MilestoneSubmission | null>(null);
  const [others, setOthers] = useState<MilestoneSubmission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision>("approve");
  const [feedback, setFeedback] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<"review" | "comment" | null>(null);
  const base = `/api/v1/submissions/${params.id}`;

  const load = useCallback(async () => {
    try {
      const current = await apiGet<MilestoneSubmission>(base);
      setSubmission(current);
      const all = await apiGet<MilestoneSubmission[]>(`/api/v1/milestones/${current.milestone_id}/submissions`);
      setOthers(all.filter((s) => s.id !== current.id));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [base]);

  useEffect(() => { load(); }, [load]);

  async function review(e: FormEvent) {
    e.preventDefault();
    setBusy("review");
    try {
      await apiPost(`${base}/review`, {
        decision: decision === "approve" ? "approved" : "revision_required",
        feedback,
      });
      toast.success(decision === "approve" ? "Approved. The milestone is completed." : "Sent back to the student");
      setFeedback("");
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function addComment(e: FormEvent) {
    e.preventDefault();
    setBusy("comment");
    try {
      await apiPost(`${base}/feedback`, { content: comment });
      toast.success("Comment added");
      setComment("");
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (error) return <Alert>{error}</Alert>;
  if (!submission) return <Spinner className="mt-20 h-8 w-8" />;

  const pending = submission.status === "submitted";

  return (
    <>
      <PageHeader
        title={submission.milestone_title}
        description={`${submission.student_names.join(", ")} · handed in ${timeAgo(submission.submitted_at)}`}
        actions={
          <>
            <Badge tone={pending ? "info" : submission.status === "completed" ? "success" : "warning"}>
              {STATUS_LABEL[submission.status]}
            </Badge>
            <Link href="/supervisor/milestones">
              <Button variant="secondary" size="sm"><ArrowLeft className="h-4 w-4" />All milestones</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader title="What the student handed in" />
            <CardContent className="space-y-4 text-sm">
              <p className="whitespace-pre-line">{submission.note || "No note."}</p>
              {submission.file ? (
                <DownloadButton
                  path={`/api/v1/submissions/${submission.id}/download`}
                  filename={submission.file.original_name}
                  size={submission.file.size_bytes}
                />
              ) : (
                <p className="text-subtle">No file attached.</p>
              )}
              <FeedbackNotes items={submission.feedback} />
            </CardContent>
          </Card>

          {others.length > 0 && (
            <Card>
              <CardHeader title="Earlier submissions for this milestone" />
              <ul className="divide-y divide-line">
                {others.map((s) => (
                  <li key={s.id} className="space-y-2 px-5 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-subtle">{timeAgo(s.submitted_at)}</span>
                      <Badge>{STATUS_LABEL[s.status]}</Badge>
                    </div>
                    <p className="whitespace-pre-line text-subtle">{s.note}</p>
                    {s.file && (
                      <DownloadButton
                        path={`/api/v1/submissions/${s.id}/download`}
                        filename={s.file.original_name}
                        size={s.file.size_bytes}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          {pending ? (
            <Card>
              <CardHeader title="Your review" description="Approving completes the milestone." />
              <CardContent>
                <form className="space-y-4" onSubmit={review}>
                  <DecisionToggle value={decision} onChange={setDecision} />
                  <Field
                    label="Feedback"
                    hint={decision === "revise" ? "Required: say what needs to change." : "Optional."}
                  >
                    <Textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      required={decision === "revise"}
                    />
                  </Field>
                  <Button type="submit" loading={busy === "review"} disabled={busy !== null}>
                    {decision === "approve" ? "Approve" : "Send back for changes"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Alert>
              This submission has been reviewed
              {submission.reviewed_by_name ? ` by ${submission.reviewed_by_name}` : ""}.
            </Alert>
          )}

          <Card>
            <CardHeader title="Add a comment" description="A note for the student. It does not change the status." />
            <CardContent>
              <form className="space-y-3" onSubmit={addComment}>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} required maxLength={3000} />
                <Button type="submit" variant="secondary" loading={busy === "comment"} disabled={busy !== null}>
                  Add comment
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}