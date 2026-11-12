"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Download, Info } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Td } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { apiGet, errorMessage } from "@/lib/apiClient";
import { downloadFile } from "@/lib/download";
import { REPORT_LABEL, REPORT_TONE, formatDate } from "@/lib/reportStatus";
import { Proposal, ReportTask } from "@/lib/types";
// A submitted or signed report can no longer be changed by the student.
const isFinal = (status: ReportTask["report_status"]) => status === "submitted" || status === "signed";
export default function StudentReportsPage() {
  const toast = useToast();
  const [tasks, setTasks] = useState<ReportTask[] | null>(null);
  const [proposalId, setProposalId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setTasks(await apiGet<ReportTask[]>("/api/v1/reports/tasks"));
      setProposalId((await apiGet<Proposal>("/api/v1/proposals/me").catch(() => null))?.id ?? null);
    } catch (e) {
      setError(errorMessage(e));
      setTasks([]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function pack(onlySigned: boolean) {
    if (proposalId === null) return;
    try {
      await downloadFile(
        `/api/v1/proposals/${proposalId}/reports/pdf?only_signed=${onlySigned}`,
        onlySigned ? "signed-weekly-reports.pdf" : "weekly-reports.pdf",
      );
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  const todo = (tasks ?? []).filter((t) => t.report_status === null || t.report_status === "draft" ||
    t.report_status === "returned").length;
  return (
    <>
      <PageHeader
        title="Weekly reports"
        description="After every meeting you write a short report in the department's weekly progress sheet."
        actions={
          <>
            <Button variant="secondary" onClick={() => pack(false)} disabled={proposalId === null}>
              <Download className="h-4 w-4" />All reports (PDF)
            </Button>
            <Button onClick={() => pack(true)} disabled={proposalId === null}>
              <Download className="h-4 w-4" />Signed reports (PDF)
            </Button>
          </>
        }
      />
      {error && <Alert>{error}</Alert>}
      <div
        className={
          "mb-6 flex items-start gap-2 rounded-lg border border-line bg-surface " +
          "px-3 py-2.5 text-sm text-subtle"
        }
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          Your supervisor signs each report. Print the PDF pack and bring it to the progress and final defense.
          {todo > 0 && (
            <> <b className="text-ink">{todo} report{todo === 1 ? "" : "s"} still to write or finish.</b></>
          )}
        </div>
      </div>
      <Card>
        <Table
                  headers={["Meeting", "Held", "Report due", "Status", ""]}
          loading={tasks === null}
          emptyText={
            tasks !== null && tasks.length === 0
              ? "No reports yet. A report becomes available after your supervisor records a meeting."
              : undefined
          }
        >
          {(tasks ?? []).map((t) => (
            <tr key={t.meeting_id}>
              <Td className="font-medium">{formatDate(t.meeting_date)}</Td>
              <Td className="text-subtle">{t.completed_at ? formatDate(t.completed_at) : "-"}</Td>
              <Td className="text-subtle">{t.due_at ? formatDate(t.due_at) : "-"}</Td>
              <Td>
                <div className="flex flex-wrap items-center gap-2">
                  {t.report_status ? (
                    <Badge tone={REPORT_TONE[t.report_status]}>{REPORT_LABEL[t.report_status]}</Badge>
                  ) : (
                    <Badge tone="warning">Not started</Badge>
                  )}
                  {t.overdue && <Badge tone="danger">Overdue</Badge>}
                </div>
              </Td>
              <Td className="text-right">
                <Link href={`/student/reports/${t.meeting_id}`}>
                  <Button size="sm" variant={isFinal(t.report_status) ? "secondary" : "primary"}>
                    {isFinal(t.report_status) ? "Open" : "Write"}
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