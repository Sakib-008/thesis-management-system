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
import { formatScore, gradeFor, groupRows, marksTotal, studentUrl } from "@/lib/evaluationUi";
import { EvaluationDetailView } from "@/lib/types";

// "7" and "7." are fine while typing. A mark is valid when it is a number from 0 up to the criterion's maximum.
const parse = (text: string, max: number): number | null => {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 && value <= max ? value : null;
};

// The evaluation of the person who is signed in: type the marks, save a draft, submit when every
// criterion is marked. After a submit the marks are shown read only. The marks are for one student.
export function ScoreForm({ detail, onChanged }: { detail: EvaluationDetailView; onChanged: () => Promise<void> }) {
  const toast = useToast();
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
    return <Alert>The marking sheet is not ready yet. The admin must set marks that add up to 100.</Alert>;
  }
  if (detail.mine.status === "final") return <EvaluationSummary entry={detail.mine} />;

  const numbers = Object.fromEntries(detail.criteria.map((c) => [c.id, parse(values[c.id] ?? "", c.weight)]));
  const allMarked = detail.criteria.every((c) => numbers[c.id] !== null);
  const anyInvalid = detail.criteria.some((c) => (values[c.id] ?? "").trim() !== "" && numbers[c.id] === null);
  const total = marksTotal(numbers);

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

  const url = (path: string) => studentUrl(detail.thesis_id, detail.student_id, path);
  const save = () => apiPut(url("/mine"), body());
  const submit = async () => {
    await save();
    await apiPost(url("/mine/submit"));
  };

  return (
    <Card>
      <CardHeader
        title={`Your evaluation of ${detail.student_name}`}
        description="Give marks for each course outcome, up to its maximum. The total is out of 100."
        action={detail.mine.status === "draft" ? <Badge tone="warning">Draft</Badge> : undefined}
      />
      <CardContent className="space-y-5">
        {groupRows(detail.criteria).map((g) => {
          const got = g.rows.reduce((sum, c) => sum + (numbers[c.id] ?? 0), 0);
          const max = g.rows.reduce((sum, c) => sum + c.weight, 0);
          return (
            <section key={g.category} className="space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-1">
                <h3 className="text-sm font-semibold">{g.category}</h3>
                <span className="text-xs tabular-nums text-subtle">
                  {formatScore(got)} / {formatScore(max)}
                </span>
              </div>
              {g.rows.map((c) => (
                <div key={c.id} className="grid gap-3 sm:grid-cols-[1fr_120px] sm:items-start">
                  <div>
                    <div className="font-medium">
                      {c.code && <span className="mr-2 text-xs font-semibold text-brand">{c.code}</span>}
                      {c.name}{" "}
                      <span className="text-xs font-normal text-subtle">· out of {formatScore(c.weight)}</span>
                    </div>
                    {c.description && <p className="text-xs text-subtle">{c.description}</p>}
                    <ProgressBar value={numbers[c.id] ?? 0} max={c.weight} className="mt-2" />
                  </div>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={c.weight}
                    step="0.5"
                    placeholder={`0 to ${formatScore(c.weight)}`}
                    aria-label={`Marks for ${c.name}`}
                    value={values[c.id] ?? ""}
                    onChange={(e) => setValues({ ...values, [c.id]: e.target.value })}
                  />
                </div>
              ))}
            </section>
          );
        })}
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-ink/5 px-4 py-3 text-sm">
          <span className="text-subtle">Total so far</span>
          <span className="text-xl font-semibold tabular-nums">{formatScore(total)}</span>
          {allMarked && <Badge tone="brand">Grade {gradeFor(detail.bands, total)}</Badge>}
          {!allMarked && <span className="text-xs text-subtle">Mark every criterion to submit.</span>}
        </div>
        {anyInvalid && <Alert>Each mark must be a number from 0 up to the maximum shown for that outcome.</Alert>}
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
        message={`Your saved marks and comment for ${detail.student_name} will be deleted.`}
        confirmLabel="Discard"
        danger
        onConfirm={() => {
          setConfirmDiscard(false);
          run("discard", () => apiDelete(url("/mine")), "Draft discarded");
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </Card>
  );
}
