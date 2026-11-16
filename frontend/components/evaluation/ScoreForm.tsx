"use client";
import { useState } from "react";
import { Save, Send, Trash2 } from "lucide-react";
import { EvaluationSummary } from "@/components/evaluation/EvaluationSummary";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/dialogs";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useToast } from "@/components/ui/Toast";
import { apiDelete, apiPost, apiPut, errorMessage } from "@/lib/apiClient";
import { formatScore, gradeFor, weightedTotal } from "@/lib/evaluationUi";
import { EvaluationDetailView } from "@/lib/types";

// "7" and "7." are fine while typing. A mark is valid when it is a number from 0 to 100.
const parse = (text: string): number | null => {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
};

// The evaluation of the person who is signed in: type the marks, save a draft, submit when every
// criterion is marked. After a submit the marks are shown read only.
export function ScoreForm({ detail, onChanged }: { detail: EvaluationDetailView; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const base = `/api/v1/evaluation/theses/${detail.thesis_id}`;
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      detail.criteria.map((c) => {
        const saved = detail.mine.scores.find((s) => s.criterion_id === c.id)?.score;
        return [c.id, saved === null || saved === undefined ? "" : String(saved)];
      }),
    ),
  );
  const [comment, setComment] = useState(detail.mine.comment);
  const [busy, setBusy] = useState<"save" | "submit" | "discard" | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  if (detail.result.published) {
    return <Alert>The result is published. Marks cannot change unless the coordinator withdraws it.</Alert>;
  }
  if (!detail.criteria_valid) {
    return <Alert>The criteria are not ready yet. The admin must set weights that add up to 100.</Alert>;
  }
  if (detail.mine.status === "final") return <EvaluationSummary entry={detail.mine} />;

  const numbers = Object.fromEntries(detail.criteria.map((c) => [c.id, parse(values[c.id] ?? "")]));
  const allMarked = detail.criteria.every((c) => numbers[c.id] !== null);
  const anyInvalid = detail.criteria.some((c) => (values[c.id] ?? "").trim() !== "" && numbers[c.id] === null);
  const total = weightedTotal(detail.criteria, numbers);

  async function run(kind: "save" | "submit" | "discard", action: () => Promise<unknown>, message: string) {
    setBusy(kind);
    try {
      await action();
      toast.success(message);
      await onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const body = () => ({
    scores: detail.criteria
      .filter((c) => numbers[c.id] !== null)
      .map((c) => ({ criterion_id: c.id, score: numbers[c.id] })),
    comment,
  });

  const save = () => apiPut(`${base}/mine`, body());
  const submit = async () => {
    await save();
    await apiPost(`${base}/mine/submit`);
  };

  return (
    <Card>
      <CardHeader
        title="Your evaluation"
        description="Mark each criterion from 0 to 100. The total is the weighted average."
        action={detail.mine.status === "draft" ? <Badge tone="warning">Draft</Badge> : undefined}
      />
      <CardContent className="space-y-5">
        {detail.criteria.map((c) => (
          <div key={c.id} className="grid gap-3 sm:grid-cols-[1fr_120px] sm:items-start">
            <div>
              <div className="font-medium">
                {c.name} <span className="text-xs font-normal text-subtle">· {formatScore(c.weight)}%</span>
              </div>
              {c.description && <p className="text-xs text-subtle">{c.description}</p>}
              <ProgressBar value={numbers[c.id] ?? 0} max={100} className="mt-2" />
            </div>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="0.5"
              placeholder="0 to 100"
              aria-label={`Mark for ${c.name}`}
              value={values[c.id] ?? ""}
              onChange={(e) => setValues({ ...values, [c.id]: e.target.value })}
            />
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-ink/5 px-4 py-3 text-sm">
          <span className="text-subtle">Total so far</span>
          <span className="text-xl font-semibold tabular-nums">{formatScore(total)}</span>
          {allMarked && <Badge tone="brand">Grade {gradeFor(detail.bands, total)}</Badge>}
          {!allMarked && <span className="text-xs text-subtle">Mark every criterion to submit.</span>}
        </div>
        {anyInvalid && <Alert>A mark must be a number from 0 to 100.</Alert>}
        <Field label="Comment" hint="Optional. The student sees it once the result is published.">
          <Textarea value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-3 border-t border-line pt-4">
          <Button
            variant="secondary"
            loading={busy === "save"}
            disabled={busy !== null || anyInvalid}
            onClick={() => run("save", save, "Draft saved")}
          >
            <Save className="h-4 w-4" />Save draft
          </Button>
          <Button
            loading={busy === "submit"}
            disabled={busy !== null || !allMarked}
            onClick={() => run("submit", submit, "Evaluation submitted")}
          >
            <Send className="h-4 w-4" />Submit evaluation
          </Button>
          {detail.mine.status === "draft" && (
            <Button
              variant="ghost"
              className="text-danger hover:bg-danger/10"
              disabled={busy !== null}
              onClick={() => setConfirmDiscard(true)}
            >
              <Trash2 className="h-4 w-4" />Discard draft
            </Button>
          )}
        </div>
      </CardContent>
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard your draft?"
        message="Your saved marks and comment for this thesis will be deleted."
        confirmLabel="Discard"
        danger
        onConfirm={() => {
          setConfirmDiscard(false);
          run("discard", () => apiDelete(base + "/mine"), "Draft discarded");
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </Card>
  );
}
