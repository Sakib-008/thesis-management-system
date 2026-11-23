"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Td } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { apiGet, errorMessage } from "@/lib/apiClient";
import { formatScore } from "@/lib/evaluationUi";
import { EvaluationListRow } from "@/lib/types";

type Tab = "ready" | "waiting" | "published" | "all";
const stateOf = (r: EvaluationListRow): Tab => {
  if (r.published) return "published";
  return r.finals > 0 && r.drafts === 0 ? "ready" : "waiting";
};

export default function CoordinatorEvaluationsPage() {
  const [rows, setRows] = useState<EvaluationListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("ready");

  useEffect(() => {
    apiGet<EvaluationListRow[]>("/api/v1/evaluation/theses")
      .then(setRows)
      .catch((e) => { setError(errorMessage(e)); setRows([]); });
  }, []);

  const all = rows ?? [];
  const count = (t: Tab) => (t === "all" ? all.length : all.filter((r) => stateOf(r) === t).length);
  const visible = tab === "all" ? all : all.filter((r) => stateOf(r) === tab);

  return (
    <>
      <PageHeader
        title="Evaluations"
        description="Check the marks of each student, add your own, and publish the result to the student."
      />
      {error && <Alert>{error}</Alert>}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "ready", label: "Ready to publish", count: count("ready") },
          { id: "waiting", label: "Waiting for marks", count: count("waiting") },
          { id: "published", label: "Published", count: count("published") },
          { id: "all", label: "All", count: count("all") },
        ]}
      />
      <Card>
        <Table
          headers={["Student", "Supervisor", "Evaluations", "Average", "Result", ""]}
          loading={rows === null}
          emptyText={rows !== null && visible.length === 0 ? "Nothing in this view." : undefined}
        >
          {visible.map((r) => (
            <tr key={`${r.thesis_id}-${r.student_id}`}>
              <Td>
                <div className="font-medium">
                  {r.student_name}
                  {r.student_number && <span className="ml-2 text-xs text-subtle">{r.student_number}</span>}
                </div>
                <div className="max-w-[260px] truncate text-xs text-subtle">{r.title}</div>
              </Td>
              <Td>{r.supervisor_name ?? "-"}</Td>
              <Td>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone="success">{r.finals} submitted</Badge>
                  {r.drafts > 0 && <Badge tone="warning">{r.drafts} draft</Badge>}
                </div>
              </Td>
              <Td className="tabular-nums">
                {r.average === null ? "-" : `${formatScore(r.average)}${r.grade ? ` · ${r.grade}` : ""}`}
              </Td>
              <Td>
                {r.published ? (
                  <Badge tone="success">Published</Badge>
                ) : (
                  <span className="text-subtle">Not published</span>
                )}
              </Td>
              <Td className="text-right">
                <Link href={`/coordinator/evaluations/${r.thesis_id}?student=${r.student_id}`}>
                  <Button size="sm" variant={stateOf(r) === "ready" ? "primary" : "secondary"}>
                    {stateOf(r) === "ready" ? "Review and publish" : "Open"}
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
