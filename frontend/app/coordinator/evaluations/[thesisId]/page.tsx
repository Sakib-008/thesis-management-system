"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, RotateCcw, Undo2 } from "lucide-react";
import { EvaluationSummary } from "@/components/evaluation/EvaluationSummary";
import { ResultPanel } from "@/components/evaluation/ResultPanel";
import { ScoreForm } from "@/components/evaluation/ScoreForm";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/dialogs";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPost, errorMessage } from "@/lib/apiClient";
import { formatScore, gradeFor } from "@/lib/evaluationUi";
import { EvaluationDetailView } from "@/lib/types";

type Confirm = "publish" | "unpublish" | null;

export default function CoordinatorEvaluationPage() {
  const params = useParams<{ thesisId: string }>();
  const toast = useToast();
  const [detail, setDetail] = useState<EvaluationDetailView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const base = `/api/v1/evaluation/theses/${params.thesisId}`;
  const load = useCallback(async () => {
    try {
      setDetail(await apiGet<EvaluationDetailView>(base));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [base]);

  useEffect(() => { load(); }, [load]);

  async function act(path: string, message: string) {
    try {
      await apiPost(`${base}/${path}`);
      toast.success(message);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  if (error) return <Alert>{error}</Alert>;
  if (!detail) return <Spinner className="mt-20 h-8 w-8" />;

  const everyone = [...detail.others, detail.mine].filter((e) => e.status !== "none");
  const finals = everyone.filter((e) => e.status === "final");
  const average = finals.length ? finals.reduce((sum, e) => sum + e.total, 0) / finals.length : null;
  const published = detail.result.published;

  return (
    <>
      <PageHeader
        title={detail.student_names.join(", ")}
        description={`${detail.title} · Supervisor: ${detail.supervisor_name ?? "none"}`}
        actions={
          <Link href="/coordinator/evaluations">
            <Button variant="secondary" size="sm"><ArrowLeft className="h-4 w-4" />All evaluations</Button>
          </Link>
        }
      />
      <Card className="mb-6">
        <CardHeader
          title={published ? "The result is published" : "Publish the result"}
          description={
            published
              ? "The student can see the result. Withdraw it if a mark needs to change."
              : "The student sees nothing until you publish. The result is the average of all submitted evaluations."
          }
          action={published ? <Badge tone="success">Published</Badge> : undefined}
        />
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="success">{finals.length} submitted</Badge>
            {everyone.length - finals.length > 0 && (
              <Badge tone="warning">{everyone.length - finals.length} not finished</Badge>
            )}
            {average !== null && (
              <span className="text-subtle">
                Average {formatScore(Math.round(average * 100) / 100)} · Grade {gradeFor(detail.bands, average)}
              </span>
            )}
          </div>
          {!published && detail.blocked_reason && <Alert>{detail.blocked_reason}.</Alert>}
          <div className="flex flex-wrap gap-3">
            {published ? (
              <Button variant="secondary" onClick={() => setConfirm("unpublish")}>
                <Undo2 className="h-4 w-4" />Withdraw the result
              </Button>
            ) : (
              <Button disabled={!detail.can_publish} onClick={() => setConfirm("publish")}>
                <CheckCircle2 className="h-4 w-4" />Publish the result
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      {published && <div className="mb-6"><ResultPanel result={detail.result} /></div>}
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          {detail.mine.status === "final" && !published && detail.mine.id !== null && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => act(`evaluations/${detail.mine.id}/reopen`, "Your evaluation is a draft again")}
            >
              <RotateCcw className="h-4 w-4" />Reopen my evaluation
            </Button>
          )}
          <ScoreForm key={`${detail.mine.status}-${detail.mine.id}`} detail={detail} onChanged={load} />
        </div>
        <div className="space-y-6">
          {detail.others.length === 0 && (
            <Alert>No other evaluator has started yet. The supervisor's marks appear here.</Alert>
          )}
          {detail.others.map((entry) => (
            <EvaluationSummary
              key={entry.id ?? entry.evaluator_name}
              entry={entry}
              actions={
                entry.status === "final" && !published && entry.id !== null ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => act(`evaluations/${entry.id}/reopen`, `${entry.evaluator_name} can edit again`)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />Reopen
                  </Button>
                ) : undefined
              }
            />
          ))}
        </div>
      </div>
      <ConfirmDialog
        open={confirm === "publish"}
        title="Publish this result?"
        message="The student will see the total, the grade, the breakdown and the comments."
        confirmLabel="Publish"
        onConfirm={() => { setConfirm(null); act("publish", "Result published"); }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "unpublish"}
        title="Withdraw the published result?"
        message="The student will no longer see it, and evaluators can change their marks."
        confirmLabel="Withdraw"
        danger
        onConfirm={() => { setConfirm(null); act("unpublish", "Result withdrawn"); }}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
