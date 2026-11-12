"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Users } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Table, Td } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { apiGet, errorMessage } from "@/lib/apiClient";
import { downloadFile } from "@/lib/download";
import { ReportOverviewRow } from "@/lib/types";
export default function ProgressReportsPage() {
    const toast = useToast();
    const [rows, setRows] = useState<ReportOverviewRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        apiGet<ReportOverviewRow[]>("/api/v1/reports/overview")
            .then(setRows)
            .catch((e) => { setError(errorMessage(e)); setRows([]); });
    }, []);
    async function pack(row: ReportOverviewRow) {
        try {
            await downloadFile(`/api/v1/proposals/${row.proposal_id}/reports/pdf`, "weekly-reports.pdf");
        } catch (e) {
            toast.error(errorMessage(e));
        }
    }
    const all = rows ?? [];
    const sum = (pick: (r: ReportOverviewRow) => number) => all.reduce((total, r) => total + pick(r), 0);
    return (
        <>
            <PageHeader
                title="Progress reports"
                description="Who is keeping up with their weekly reports. Students with overdue reports are listed first."
            />
            {error && <Alert>{error}</Alert>}
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
                <StatCard label="Theses with a supervisor" value={all.length} icon={Users} tone="info" />
                <StatCard label="Reports signed" value={sum((r) => r.reports_signed)} icon={CheckCircle2} tone="success" />
                <StatCard label="Overdue reports" value={sum((r) => r.overdue)} icon={AlertTriangle} tone="warning" />
            </div>
            <Card>
                <Table
                    headers={["Student", "Supervisor", "Meetings held", "Reports in", "Signed", "Overdue", ""]}
                    loading={rows === null}
                    emptyText={rows !== null && rows.length === 0 ? "No student has a supervisor yet." : undefined}
                >
                    {all.map((r) => (
                        <tr key={r.proposal_id}>
                            <Td>
                                <div className="font-medium">{r.student_names.join(", ")}</div>
                                <div className="max-w-[240px] truncate text-xs text-subtle">{r.title}</div>
                            </Td>
                            <Td>{r.supervisor_name ?? "-"}</Td>
                            <Td className="tabular-nums">{r.meetings_completed}</Td>
                            <Td className="tabular-nums">{r.reports_submitted}</Td>
                            <Td className="tabular-nums">{r.reports_signed}</Td>
                            <Td>
                                {r.overdue > 0 ? (
                                    <Badge tone="danger">{r.overdue} overdue</Badge>
                                ) : (
                                    <Badge tone="success">None</Badge>
                                )}
                            </Td>
                            <Td className="text-right">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={r.reports_submitted === 0}
                                    onClick={() => pack(r)}
                                >
                                    <Download className="h-3.5 w-3.5" />Pack (PDF)
                                </Button>
                            </Td>
                        </tr>
                    ))}
                </Table>
            </Card>
        </>
    );
}