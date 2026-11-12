"use client";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarClock, CalendarPlus, CheckCircle2, ClipboardList, MapPin } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPost, errorMessage } from "@/lib/apiClient";
import {
  MEETING_LABEL, MEETING_TONE, REPORT_LABEL, REPORT_TONE, formatDateTime, fromDateTimeInputs,
} from "@/lib/reportStatus";
import { Meeting } from "@/lib/types";
const EMPTY = { date: "", time: "10:00", mode: "in_person", location: "", agenda: "" };
export default function StudentMeetingsPage() {
  const toast = useToast();
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setMeetings(await apiGet<Meeting[]>("/api/v1/meetings"));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
      setMeetings([]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function request(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiPost("/api/v1/meetings", {
        meeting_date: fromDateTimeInputs(form.date, form.time),
        agenda: form.agenda,
        mode: form.mode,
        location: form.location,
      });
      toast.success("Meeting requested. Your supervisor will answer it.");
      setOpen(false);
      setForm(EMPTY);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function cancel(id: number) {
    try {
      await apiPost(`/api/v1/meetings/${id}/cancel`);
      toast.success("Meeting cancelled");
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
    const all = meetings ?? [];
  const upcoming = all
    .filter((m) => m.status === "requested" || m.status === "scheduled")
    .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
  const past = all.filter((m) => m.status !== "requested" && m.status !== "scheduled");
  return (
    <>
      <PageHeader
        title="Meetings"
        description="Request meetings with your supervisor. After each meeting you write a weekly report."
        actions={<Button onClick={() => setOpen(true)}><CalendarPlus className="h-4 w-4" />Request meeting</Button>}
      />
      {error && <Alert>{error}</Alert>}
      {meetings === null && <Spinner className="mt-10 h-8 w-8" />}
      {meetings !== null && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="h-fit">
            <CardHeader title="Upcoming" />
            {upcoming.length === 0 ? (
              <p className="px-5 py-6 text-sm text-subtle">Nothing planned. Request a meeting to get started.</p>
            ) : (
              <ul className="divide-y divide-line">
                {upcoming.map((m) => (
                  <li key={m.id} className="space-y-2 px-5 py-4 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{m.agenda}</span>
                      <Badge tone={MEETING_TONE[m.status]}>{MEETING_LABEL[m.status]}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-subtle">
                      <CalendarClock className="h-3.5 w-3.5" />{formatDateTime(m.meeting_date)}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-subtle">
                      <MapPin className="h-3.5 w-3.5" />
                      {m.mode === "online" ? "Online" : "In person"}{m.location ? ` · ${m.location}` : ""}
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => cancel(m.id)}>Cancel</Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <div className="space-y-5 lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">Past meetings</h2>
            {past.length === 0 && <p className="text-sm text-subtle">No past meetings yet.</p>}
            {past.map((m) => (
              <Card key={m.id}>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{m.agenda}</h3>
                      <div className="text-xs text-subtle">{formatDateTime(m.meeting_date)}</div>
                    </div>
                    <Badge tone={MEETING_TONE[m.status]}>{MEETING_LABEL[m.status]}</Badge>
                  </div>
                  {m.status === "declined" && (
                    <p className="text-subtle">Your supervisor wrote: {m.decline_reason}</p>
                  )}
                  {m.status === "completed" && (
                    <>
                      <p className="whitespace-pre-line text-subtle">{m.discussion}</p>
                      {m.decisions && (
                        <div>
                          <div
                            className={
                              "mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase " +
                              "tracking-wide text-subtle"
                            }
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />Decisions
                          </div>
                          <p className="whitespace-pre-line">{m.decisions}</p>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
                        <ClipboardList className="h-4 w-4 text-subtle" />
                        {m.report_status ? (
                          <Badge tone={REPORT_TONE[m.report_status]}>Report: {REPORT_LABEL[m.report_status]}</Badge>
                        ) : (
                          <Badge tone="warning">Report not written yet</Badge>
                        )}
                                                <Link href={`/student/reports/${m.id}`}>
                          <Button size="sm" variant={m.report_status ? "secondary" : "primary"}>
                            {m.report_status === "submitted" || m.report_status === "signed"
                              ? "View report"
                              : "Write report"}
                          </Button>
                        </Link>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      <Modal
        open={open}
        title="Request a meeting"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="request-meeting-form" loading={busy}>Send request</Button>
          </>
        }
      >
        <form id="request-meeting-form" className="space-y-4" onSubmit={request}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </Field>
            <Field label="Time">
              <Input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                required
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="How">
              <Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                <option value="in_person">In person</option>
                <option value="online">Online</option>
              </Select>
            </Field>
            <Field label="Place or link" hint="Optional">
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                maxLength={200}
              />
            </Field>
          </div>
          <Field label="Agenda" hint="What you want to discuss.">
            <Textarea
              value={form.agenda}
              onChange={(e) => setForm({ ...form, agenda: e.target.value })}
              required
              minLength={3}
            />
          </Field>
        </form>
      </Modal>
    </>
  );
}