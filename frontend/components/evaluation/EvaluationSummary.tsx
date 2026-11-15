import { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Table, Td } from "@/components/ui/Table";
import { EVALUATION_LABEL, EVALUATION_TONE, formatScore } from "@/lib/evaluationUi";
import { EvaluationEntry } from "@/lib/types";

// One evaluator's marks, read only: the scores, the total, the grade and the comment.
export function EvaluationSummary({ entry, actions }: { entry: EvaluationEntry; actions?: ReactNode }) {
  return (
    <Card>
      <CardHeader
        title={entry.evaluator_name}
        description={entry.evaluator_role === "coordinator" ? "Coordinator" : "Supervisor"}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={EVALUATION_TONE[entry.status]}>{EVALUATION_LABEL[entry.status]}</Badge>
            {actions}
          </div>
        }
      />
      <Table headers={["Criterion", "Weight", "Score"]}>
        {entry.scores.map((s) => (
          <tr key={s.criterion_id}>
            <Td className="font-medium">{s.name}</Td>
            <Td className="tabular-nums text-subtle">{formatScore(s.weight)}%</Td>
            <Td className="tabular-nums">{s.score === null ? "-" : formatScore(s.score)}</Td>
          </tr>
        ))}
      </Table>
      <CardContent className="space-y-2 border-t border-line text-sm">
        <div className="flex items-center gap-3">
          <span className="text-subtle">Total</span>
          <span className="text-lg font-semibold tabular-nums">{formatScore(entry.total)}</span>
          {entry.grade && <Badge tone="brand">Grade {entry.grade}</Badge>}
        </div>
        {entry.comment && <p className="whitespace-pre-line text-subtle">{entry.comment}</p>}
      </CardContent>
    </Card>
  );
}
