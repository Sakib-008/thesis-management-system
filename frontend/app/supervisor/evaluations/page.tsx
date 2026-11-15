"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Td } from "@/components/ui/Table";
import { apiGet, errorMessage } from "@/lib/apiClient";
import { EVALUATION_LABEL, EVALUATION_TONE } from "@/lib/evaluationUi";
import { EvaluationListRow } from "@/lib/types";

export default function SupervisorEvaluationsPage() {
  const [rows, setRows] = useState<EvaluationListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<EvaluationListRow[]>("/api/v1/evaluation/theses")
      .then(setRows)
      .catch((e) => { setError(errorMessage(e)); setRows([]); });
  }, []);

  return (
    <>
      <PageHeader
        title="Evaluations"
        description="Mark the theses of your students. The coordinator publishes the result."
      />
      {error && <Alert>{error}</Alert>}
      <Card>
        <Table
          headers={["Student", "Thesis", "Your evaluation", "Result", ""]}
          loading={rows === null}
          emptyText={rows !== null && rows.length === 0 ? "You have no students to evaluate yet." : undefined}
        >
          {(rows ?? []).map((r) => (
            <tr key={r.thesis_id}>
              <Td className="font-medium">{r.student_names.join(", ")}</Td>
              <Td className="max-w-[320px] truncate text-subtle">{r.title}</Td>
              <Td><Badge tone={EVALUATION_TONE[r.my_status]}>{EVALUATION_LABEL[r.my_status]}</Badge></Td>
              <Td>
                {r.published ? (
                  <Badge tone="success">Published{r.grade ? ` · ${r.grade}` : ""}</Badge>
                ) : (
                  <span className="text-subtle">Not published</span>
                )}
              </Td>
              <Td className="text-right">
                <Link href={`/supervisor/evaluations/${r.thesis_id}`}>
                  <Button size="sm" variant={r.my_status === "final" ? "secondary" : "primary"}>
                    {r.my_status === "none" ? "Evaluate" : r.my_status === "draft" ? "Continue" : "View"}
                  </Button>
                </Link>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
