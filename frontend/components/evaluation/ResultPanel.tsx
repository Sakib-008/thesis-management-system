import { Award } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Table, Td } from "@/components/ui/Table";
import { formatScore, groupRows } from "@/lib/evaluationUi";
import { formatDay } from "@/lib/supervisionUi";
import { ThesisResultView } from "@/lib/types";

// The published result of a thesis: the total and grade, the average of each criterion, and the comments.
export function ResultPanel({ result }: { result: ThesisResultView }) {
  if (!result.published || result.total === null) return null;
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <ProgressRing value={Math.round(result.total)} size={140} stroke={12} label="score" />
            <div>
              <div className="text-3xl font-semibold tabular-nums">{formatScore(result.total)} / 100</div>
              <div
                className={
                  "mt-1 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-sm " +
                  "font-medium text-success"
                }
              >
                <Award className="h-4 w-4" />Grade {result.grade}
              </div>
              <p className="mt-3 text-xs text-subtle">
                The average of {result.evaluators_count} evaluation{result.evaluators_count === 1 ? "" : "s"}.
                {result.published_at ? ` Published ${formatDay(result.published_at)}.` : ""}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Comments" description="From the people who evaluated the thesis" />
          <CardContent className="space-y-3 text-sm">
            {result.comments.length === 0 && <p className="text-subtle">No comments were written.</p>}
            {result.comments.map((c) => (
              <div key={c.evaluator_name}>
                <div className="font-medium">{c.evaluator_name}</div>
                <p className="whitespace-pre-line text-subtle">{c.comment}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Score breakdown" description="The average marks for each course outcome, grouped like the defense sheet" />
        <Table headers={["Outcome", "Marks", "Out of", ""]}>
          {groupRows(result.criteria).flatMap((g) => {
            const sub = result.groups.find((x) => x.category === g.category);
            return [
              <tr key={`g-${g.category}`} className="bg-ink/5">
                <Td className="font-semibold">{g.category}</Td>
                <Td className="tabular-nums font-semibold">{formatScore(sub?.marks ?? 0)}</Td>
                <Td className="tabular-nums text-subtle">{formatScore(sub?.max ?? 0)}</Td>
                <Td>{""}</Td>
              </tr>,
              ...g.rows.map((c) => (
                <tr key={c.code || c.name}>
                  <Td className="font-medium">
                    {c.code && <span className="mr-2 text-xs font-semibold text-brand">{c.code}</span>}
                    {c.name}
                  </Td>
                  <Td className="tabular-nums">{formatScore(c.average)}</Td>
                  <Td className="tabular-nums text-subtle">{formatScore(c.weight)}</Td>
                  <Td className="w-1/3"><ProgressBar value={c.average} max={c.weight} /></Td>
                </tr>
              )),
            ];
          })}
        </Table>
      </Card>
    </>
  );
}
