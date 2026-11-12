"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Download, MessageSquareWarning, Send } from "lucide-react";
import { ReportSheet } from "@/components/reports/ReportSheet";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiGet, apiPost, apiPut, errorMessage } from "@/lib/apiClient";
import { downloadFile } from "@/lib/download";
import {
  MAX_A, MAX_B, MAX_ITEM, REPORT_LABEL, REPORT_TONE, formatDate, formatDateTime,
} from "@/lib/reportStatus";
import { Meeting, WeeklyReport } from "@/lib/types";
const EMPTY = { section_a: "", section_b: "", next_works: ["", "", ""] };
export default function ReportEditorPage() {
  const params = useParams<{ meetingId: string }>();
  const toast = useToast();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const base = `/api/v1/meetings/${params.meetingId}`;
  const fill = (r: WeeklyReport) =>
    setForm({
      section_a: r.section_a,
      section_b: r.section_b,
      next_works: [0, 1, 2].map((i) => r.next_works[i] ?? ""),
    });
      const load = useCallback(async () => {
    try {
      setMeeting(await apiGet<Meeting>(base));
      try {
        const existing = await apiGet<WeeklyReport>(`${base}/report`);
        setReport(existing);
        fill(existing);
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e;
        // No report yet: opening the editor starts an empty draft, which also gives us the sheet header.
        const created = await apiPut<WeeklyReport>(`${base}/report`, EMPTY);
        setReport(created);
        fill(created);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [base]);
  useEffect(() => { load(); }, [load]);
  const editable = report !== null && (report.status === "draft" || report.status === "returned");
  async function save(thenSubmit: boolean) {
    setBusy(thenSubmit ? "submit" : "save");
    try {
      setReport(await apiPut<WeeklyReport>(`${base}/report`, form));
      if (thenSubmit) {
        setReport(await apiPost<WeeklyReport>(`${base}/report/submit`));
        toast.success("Report submitted. Your supervisor can now sign it.");
      } else {
        toast.success("Draft saved");
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  async function download() {
    if (!report) return;
    try {
      await downloadFile(`/api/v1/reports/${report.id}/pdf`, `weekly-report-${report.meeting_date.slice(0, 10)}.pdf`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  if (error) return <Alert>{error}</Alert>;
  if (!meeting || !report) return <Spinner className="mt-20 h-8 w-8" />;
  const heldAt = meeting.completed_at ? formatDateTime(meeting.completed_at) : "";
  const preview = { ...report, ...form, next_works: form.next_works.filter((item) => item.trim() !== "") };
  const missingId = report.header.students.some((s) => !s.student_number);
  const setItem = (i: number, value: string) =>
    setForm((f) => ({ ...f, next_works: f.next_works.map((item, j) => (j === i ? value : item)) }));
  return (
    <>
      <PageHeader
        title={`Weekly report: ${formatDate(meeting.meeting_date)}`}
        description={`Meeting held ${heldAt}. ${meeting.agenda}`}
        actions={
          <>
            <Badge tone={REPORT_TONE[report.status]}>{REPORT_LABEL[report.status]}</Badge>
            <Link href="/student/reports">
              <Button variant="secondary" size="sm"><ArrowLeft className="h-4 w-4" />All reports</Button>
            </Link>
            <Button variant="secondary" size="sm" onClick={download}>
              <Download className="h-4 w-4" />PDF
            </Button>
          </>
        }
      />
      {report.status === "returned" && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
          <MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <div className="font-medium">Your supervisor returned this report</div>
            <p className="mt-1 whitespace-pre-line text-subtle">{report.returned_reason}</p>
          </div>
        </div>
      )}
            {missingId && editable && (
        <div className="mb-6">
          <Alert>
            Your Student ID is missing, and it is printed on the report.{" "}
            <Link href="/student/profile" className="font-medium underline">Add it in My profile</Link>{" "}
            before you submit.
          </Alert>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        {editable ? (
          <Card className="h-fit">
            <CardHeader title="Write your report" description="It follows the department's weekly progress sheet." />
            <CardContent className="space-y-4">
              <Field
                label="A. Summary of works performed in the previous week"
                hint={`${form.section_a.length} / ${MAX_A}`}
              >
                <Textarea
                  className="min-h-[130px]"
                  value={form.section_a}
                  maxLength={MAX_A}
                  onChange={(e) => setForm({ ...form, section_a: e.target.value })}
                />
              </Field>
              <Field label="B. Description of current week's activity" hint={`${form.section_b.length} / ${MAX_B}`}>
                <Textarea
                  className="min-h-[190px]"
                  value={form.section_b}
                  maxLength={MAX_B}
                  onChange={(e) => setForm({ ...form, section_b: e.target.value })}
                />
              </Field>
              <div className="space-y-3">
                <div className="text-sm font-medium">C. Proposed works for the next week</div>
                {form.next_works.map((item, i) => (
                  <Field key={i} label={`${i + 1}.`} hint={i === 0 ? "At least one. Up to three." : undefined}>
                    <Input value={item} maxLength={MAX_ITEM} onChange={(e) => setItem(i, e.target.value)} />
                  </Field>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 border-t border-line pt-4">
                <Button loading={busy === "submit"} disabled={busy !== null} onClick={() => save(true)}>
                  <Send className="h-4 w-4" />Submit for signature
                </Button>
                <Button
                  variant="secondary"
                  loading={busy === "save"}
                  disabled={busy !== null}
                  onClick={() => save(false)}
                >
                  Save draft
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="h-fit">
            <CardHeader
              title={report.status === "signed" ? "Signed by your supervisor" : "Waiting for your supervisor"}
              description={
                report.status === "signed"
                  ? "This report is final and can no longer be changed."
                  : "You cannot change a report once it is submitted, unless your supervisor returns it."
              }
            />
          </Card>
        )}
        <div className="min-w-0">
          <ReportSheet report={preview} />
        </div>
      </div>
    </>
  );
}