"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { ReportSheet } from "@/components/reports/ReportSheet";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPost, errorMessage } from "@/lib/apiClient";
import { downloadFile } from "@/lib/download";
import { RATING_LABEL, REPORT_LABEL, REPORT_TONE, formatDate, formatDateTime } from "@/lib/reportStatus";
import { Rating, WeeklyReport } from "@/lib/types";
const RATINGS: Rating[] = ["poor", "average", "good", "excellent"];
export default function ReviewReportPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"sign" | "return" | null>(null);
  const base = `/api/v1/reports/${params.id}`;
  const load = useCallback(async () => {
        try {
      setReport(await apiGet<WeeklyReport>(base));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [base]);
  useEffect(() => { load(); }, [load]);
  async function sign(e: FormEvent) {
    e.preventDefault();
    if (!rating) return;
    setBusy("sign");
    try {
      setReport(await apiPost<WeeklyReport>(`${base}/sign`, { rating, comment }));
      toast.success("Report signed");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }
  async function sendBack() {
    setBusy("return");
    try {
      setReport(await apiPost<WeeklyReport>(`${base}/return`, { reason }));
      toast.success("Report returned to the student");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }
  async function download() {
    if (!report) return;
    try {
      await downloadFile(`${base}/pdf`, `weekly-report-${report.meeting_date.slice(0, 10)}.pdf`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  if (error) return <Alert>{error}</Alert>;
  if (!report) return <Spinner className="mt-20 h-8 w-8" />;
  const names = report.header.students.map((s) => s.name).join(", ");
  return (
    <>
      <PageHeader
        title={`${names}: ${formatDate(report.meeting_date)}`}
        description="Read the report. Sign it with a rating, or return it with a reason."
        actions={
          <>
            <Badge tone={REPORT_TONE[report.status]}>{REPORT_LABEL[report.status]}</Badge>
            <Link href="/supervisor/reports">
              <Button variant="secondary" size="sm"><ArrowLeft className="h-4 w-4" />All reports</Button>
            </Link>
            <Button variant="secondary" size="sm" onClick={download}><Download className="h-4 w-4" />PDF</Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0"><ReportSheet report={report} /></div>
        <div className="space-y-6">
          {report.status === "submitted" && (
            <>
              <Card>
                <CardHeader
                  title="Sign the report"
                  description="Your name and today's date are printed on the sheet."
                />
                <CardContent>
                  <form className="space-y-4" onSubmit={sign}>
                    <div>
                      <div className="mb-2 text-sm font-medium">Comments on weekly progress</div>
                      <div className="grid grid-cols-2 gap-2">
                        {RATINGS.map((r) => (
                          <Button
                            key={r}
                            type="button"
                                                    variant={rating === r ? "primary" : "secondary"}
                            onClick={() => setRating(r)}
                          >
                            {RATING_LABEL[r]}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Field label="Short comment" hint="Optional. It is printed on the sheet (160 characters).">
                      <Input value={comment} maxLength={160} onChange={(e) => setComment(e.target.value)} />
                    </Field>
                    <Button type="submit" loading={busy === "sign"} disabled={!rating || busy !== null}>
                      Sign report
                    </Button>
                  </form>
                </CardContent>
              </Card>
              <Card>
                <CardHeader
                  title="Return for changes"
                  description="The student edits the report and submits it again."
                />
                <CardContent className="space-y-4">
                  <Field label="What should change?">
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
                  </Field>
                  <Button
                    variant="secondary"
                    loading={busy === "return"}
                    disabled={!reason.trim() || busy !== null}
                    onClick={sendBack}
                  >
                    Return to the student
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
          {report.status === "signed" && (
            <Card>
              <CardHeader title="Signed" />
              <CardContent className="space-y-1 text-sm">
                <div>Rating: <b>{report.rating ? RATING_LABEL[report.rating] : "-"}</b></div>
                {report.supervisor_comment && <div className="text-subtle">{report.supervisor_comment}</div>}
                <div className="text-xs text-subtle">
                  {report.signed_by_name}{report.signed_at ? `, ${formatDateTime(report.signed_at)}` : ""}
                </div>
              </CardContent>
            </Card>
          )}
          {report.status === "returned" && (
            <Card>
              <CardHeader title="Returned to the student" />
              <CardContent className="whitespace-pre-line text-sm text-subtle">{report.returned_reason}</CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}