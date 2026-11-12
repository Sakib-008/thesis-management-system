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
import { timeAgo } from "@/lib/format";
import { RATING_LABEL, REPORT_LABEL, REPORT_TONE, formatDate } from "@/lib/reportStatus";
import { ReportStatus, WeeklyReport } from "@/lib/types";
type Tab = "submitted" | "signed" | "returned";
export default function SupervisorReportsPage() {
  const [reports, setReports] = useState<WeeklyReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("submitted");
  useEffect(() => {
    apiGet<WeeklyReport[]>("/api/v1/reports")
      .then(setReports)
      .catch((e) => { setError(errorMessage(e)); setReports([]); });
  }, []);
  const all = reports ?? [];
  const count = (s: ReportStatus) => all.filter((r) => r.status === s).length;
  const visible = all.filter((r) => r.status === tab);
  return (
    <>
      <PageHeader
        title="Weekly reports"
        description="Read your students' weekly reports. Sign each one with a rating, or return it for changes."
             />
      {error && <Alert>{error}</Alert>}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "submitted", label: "To sign", count: count("submitted") },
          { id: "signed", label: "Signed", count: count("signed") },
          { id: "returned", label: "Returned", count: count("returned") },
        ]}
      />
      <Card>
        <Table
          headers={["Student", "Meeting", "Submitted", "Status", ""]}
          loading={reports === null}
          emptyText={reports !== null && visible.length === 0 ? "No reports in this view." : undefined}
        >
          {visible.map((r) => (
            <tr key={r.id}>
              <Td className="font-medium">{r.header.students.map((s) => s.name).join(", ")}</Td>
              <Td className="text-subtle">{formatDate(r.meeting_date)}</Td>
              <Td className="text-subtle">{r.submitted_at ? timeAgo(r.submitted_at) : "-"}</Td>
              <Td>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={REPORT_TONE[r.status]}>{REPORT_LABEL[r.status]}</Badge>
                  {r.rating && <Badge>{RATING_LABEL[r.rating]}</Badge>}
                </div>
              </Td>
              <Td className="text-right">
                <Link href={`/supervisor/reports/${r.id}`}>
                  <Button size="sm" variant={r.status === "submitted" ? "primary" : "secondary"}>
                    {r.status === "submitted" ? "Review" : "Open"}
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