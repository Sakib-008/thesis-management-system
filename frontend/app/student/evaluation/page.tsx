import { Award } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Table, Td } from "@/components/ui/Table";
import { EVALUATION, gradeFor } from "@/lib/mock/thesisDemo";

export default function EvaluationPage() {
  const total = EVALUATION.criteria.reduce((sum, c) => sum + c.score, 0);
  const max = EVALUATION.criteria.reduce((sum, c) => sum + c.max, 0);

  return (
    <>
      <PageHeader title="Evaluation" description="Your final thesis result, criterion by criterion." />
      <DemoBanner />

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <ProgressRing value={Math.round((total / max) * 100)} size={140} stroke={12} label="score" />
            <div>
              <div className="text-3xl font-semibold">{total} / {max}</div>
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">
                <Award className="h-4 w-4" />Grade {gradeFor(total)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Evaluator's comment" description={`Evaluated by ${EVALUATION.evaluator}`} />
          <CardContent><p className="text-sm text-subtle">{EVALUATION.comment}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Score breakdown" />
        <Table headers={["Criterion", "Score", ""]}>
          {EVALUATION.criteria.map((c) => (
            <tr key={c.name}>
              <Td className="font-medium">{c.name}</Td>
              <Td className="tabular-nums">{c.score} / {c.max}</Td>
              <Td className="w-1/2"><ProgressBar value={c.score} max={c.max} /></Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}