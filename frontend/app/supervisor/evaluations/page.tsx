"use client";

import { FormEvent, useState } from "react";
import { Award } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Td } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { EVAL_STAGES, EvalStage, SUPERVISOR_STUDENTS } from "@/lib/mock/supervisorDemo";
import { EVALUATION, gradeFor } from "@/lib/mock/thesisDemo";

const STAGE_TONE: Record<EvalStage, Tone> = { "In progress": "neutral", "Final thesis submitted": "warning", Evaluated: "success" };
const MAX_TOTAL = EVALUATION.criteria.reduce((sum, c) => sum + c.max, 0);

export default function SupervisorEvaluationsPage() {
  const toast = useToast();
  const [stages, setStages] = useState<Record<number, EvalStage>>(EVAL_STAGES);
  const [results, setResults] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [scores, setScores] = useState<number[]>(EVALUATION.criteria.map(() => 0));
  const [comment, setComment] = useState("");

  const student = SUPERVISOR_STUDENTS.find((s) => s.id === selected);
  const total = scores.reduce((sum, n) => sum + n, 0);

  function start(id: number) {
    setSelected(id);
    setScores(EVALUATION.criteria.map(() => 0));
    setComment("");
  }

  // keep each score inside 0..max for its criterion
  function setScore(index: number, raw: string) {
    const max = EVALUATION.criteria[index].max;
    const value = Math.min(max, Math.max(0, Number(raw) || 0));
    setScores((list) => list.map((n, i) => (i === index ? value : n)));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (selected === null) return;
    setStages((s) => ({ ...s, [selected]: "Evaluated" }));
    setResults((r) => ({ ...r, [selected]: total }));
    toast.success(`Evaluation submitted for ${student?.name}: ${total}/${MAX_TOTAL}, grade ${gradeFor(total)} (demo: not saved yet)`);
    setSelected(null);
  }

  return (
    <>
      <PageHeader title="Evaluations" description="Grade a thesis once the student has submitted the final version." />
      <DemoBanner />

      <Card className="mb-6">
        <Table headers={["Student", "Thesis", "Stage", "Result", ""]}>
          {SUPERVISOR_STUDENTS.map((s) => {
            const stage = stages[s.id];
            return (
              <tr key={s.id} className="hover:bg-ink/[0.02]">
                <Td><div className="flex items-center gap-3"><Avatar name={s.name} /><span className="font-medium">{s.name}</span></div></Td>
                <Td className="max-w-[260px] truncate text-subtle">{s.thesis}</Td>
                <Td><Badge tone={STAGE_TONE[stage]}>{stage}</Badge></Td>
                <Td className="tabular-nums">{results[s.id] !== undefined ? `${results[s.id]} / ${MAX_TOTAL} (${gradeFor(results[s.id])})` : "—"}</Td>
                <Td className="text-right">
                  <Button size="sm" disabled={stage !== "Final thesis submitted"} onClick={() => start(s.id)}>Evaluate</Button>
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {student && (
        <Card>
          <CardHeader title={`Evaluate ${student.name}`} description={student.thesis} />
          <CardContent>
            <form className="space-y-6" onSubmit={submit}>
              <div className="grid gap-4 sm:grid-cols-2">
                {EVALUATION.criteria.map((c, i) => (
                  <Field key={c.name} label={`${c.name} (max ${c.max})`}>
                    <Input type="number" min={0} max={c.max} value={scores[i]} onChange={(e) => setScore(i, e.target.value)} />
                  </Field>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-4 rounded-lg bg-brand/5 px-4 py-3">
                <div className="text-2xl font-semibold">{total} / {MAX_TOTAL}</div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">
                  <Award className="h-4 w-4" />Grade {gradeFor(total)}
                </div>
                <span className="text-xs text-subtle">Updates as you type.</span>
              </div>

              <Field label="Comment for the student"><Textarea value={comment} onChange={(e) => setComment(e.target.value)} /></Field>

              <div className="flex gap-3">
                <Button type="submit">Submit evaluation</Button>
                <Button variant="secondary" onClick={() => setSelected(null)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </>
  );
}