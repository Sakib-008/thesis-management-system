"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarClock, MapPin } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPost, errorMessage } from "@/lib/apiClient";
import {
  MEETING_LABEL, MEETING_TONE, REPORT_LABEL, REPORT_TONE, formatDateTime, fromDateTimeInputs, toDateTimeInputs,
} from "@/lib/reportStatus";
import { Meeting, MeetingStatus } from "@/lib/types";

type Tab = "requests" | "upcoming" | "held" | "other";
type Action = { kind: "accept" | "decline" | "record"; meeting: Meeting } | null;

const TAB_STATUS: Record<Tab, MeetingStatus[]> = {
  requests: ["requested"],
  upcoming: ["scheduled"],
  held: ["completed"],
  other: ["declined", "cancelled"],
};

export default function SupervisorMeetingsPage() {
  const toast = useToast();
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("requests");
  const [action, setAction] = useState<Action>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    date: "", time: "", location: "", reason: "", discussion: "", decisions: "", nextDate: "", nextTime: "10:00",
  });

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

  const all = meetings ?? [];
  const inTab = (t: Tab) => all.filter((m) => TAB_STATUS[t].includes(m.status));
  const visible = inTab(tab).sort((a, b) =>
    tab === "requests" || tab === "upcoming"
      ? a.meeting_date.localeCompare(b.meeting_date)
      : b.meeting_date.localeCompare(a.meeting_date),
  );

  function open(kind: "accept" | "decline" | "record", meeting: Meeting) {
    const { date, time } = toDateTimeInputs(meeting.meeting_date);
    setForm({
      date, time, location: meeting.location, reason: "", discussion: "", decisions: "", nextDate: "",
      nextTime: "10:00",
    });
    setAction({ kind, meeting });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!action) return;
    const base = `/api/v1/meetings/${action.meeting.id}`;
    setBusy(true);
    try {
      if (action.kind === "accept") {
        await apiPost(`${base}/accept`, {
          meeting_date: fromDateTimeInputs(form.date, form.time),
          location: form.location,
        });
        toast.success("Meeting scheduled");
      } else if (action.kind === "decline") {
        await apiPost(`${base}/decline`, { reason: form.reason });
        toast.success("Request declined");
      } else {
        await apiPost(`${base}/complete`, {
          discussion: form.discussion,
          decisions: form.decisions,
          next_meeting_date: form.nextDate ? fromDateTimeInputs(form.nextDate, form.nextTime) : null,
        });
        toast.success("Meeting recorded. The student can now write the weekly report.");
      }
      setAction(null);
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

  const titles = { accept: "Accept the meeting", decline: "Decline the request", record: "Record the meeting" };

  return (
    <>
      <PageHeader
        title="Meetings"
        description={
          "Answer meeting requests and record what was discussed. " +
          "Recording a meeting lets the student write the report."
        }
      />
      {error && <Alert>{error}</Alert>}
      {meetings === null && <Spinner className="mt-10 h-8 w-8" />}

      {meetings !== null && (
        <>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "requests", label: "Requests", count: inTab("requests").length },
              { id: "upcoming", label: "Upcoming", count: inTab("upcoming").length },
              { id: "held", label: "Held", count: inTab("held").length },
              { id: "other", label: "Declined or cancelled", count: inTab("other").length },
            ]}
          />
          {visible.length === 0 && <p className="text-sm text-subtle">Nothing here.</p>}
          <div className="space-y-4">
            {visible.map((m) => (
              <Card key={m.id}>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{m.student_names.join(", ")}</div>
                      <div className="text-subtle">{m.agenda}</div>
                    </div>
                    <Badge tone={MEETING_TONE[m.status]}>{MEETING_LABEL[m.status]}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-subtle">
                    <span className="flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" />{formatDateTime(m.meeting_date)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {m.mode === "online" ? "Online" : "In person"}{m.location ? ` · ${m.location}` : ""}
                    </span>
                  </div>

                  {m.status === "requested" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => open("accept", m)}>Accept</Button>
                      <Button size="sm" variant="secondary" onClick={() => open("decline", m)}>Decline</Button>
                    </div>
                  )}
                  {m.status === "scheduled" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => open("record", m)}>Record meeting</Button>
                      <Button size="sm" variant="secondary" onClick={() => cancel(m.id)}>Cancel</Button>
                    </div>
                  )}
                  {m.status === "completed" && (
                    <div className="space-y-2 border-t border-line pt-3">
                      <p className="whitespace-pre-line text-subtle">{m.discussion}</p>
                      <div className="flex flex-wrap items-center gap-3">
                        {m.report_status ? (
                          <Badge tone={REPORT_TONE[m.report_status]}>Report: {REPORT_LABEL[m.report_status]}</Badge>
                        ) : (
                          <Badge tone="warning">Report not written yet</Badge>
                        )}
                        {m.report_id && m.report_status !== "draft" && (
                          <Link href={`/supervisor/reports/${m.report_id}`}>
                            <Button size="sm" variant="secondary">Open report</Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                  {m.status === "declined" && <p className="text-subtle">Reason given: {m.decline_reason}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Modal
        open={action !== null}
        title={action ? titles[action.kind] : ""}
        onClose={() => setAction(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAction(null)}>Cancel</Button>
            <Button type="submit" form="meeting-action-form" loading={busy}>
              {action?.kind === "decline" ? "Decline" : action?.kind === "record" ? "Save" : "Accept"}
            </Button>
          </>
        }
      >
        {action && (
          <form id="meeting-action-form" className="space-y-4" onSubmit={submit}>
            <div className="text-sm">
              <div className="font-medium">{action.meeting.student_names.join(", ")}</div>
              <div className="text-subtle">{action.meeting.agenda}</div>
            </div>

            {action.kind === "accept" && (
              <>
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
                <Field label="Place or link" hint="Change the time or place if you need to.">
                  <Input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    maxLength={200}
                  />
                </Field>
              </>
            )}

            {action.kind === "decline" && (
              <Field label="Reason" hint="The student reads this. You can suggest another time.">
                <Textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  required
                />
              </Field>
            )}

            {action.kind === "record" && (
              <>
                <Field label="What was discussed" hint="At least a short note.">
                  <Textarea
                    value={form.discussion}
                    onChange={(e) => setForm({ ...form, discussion: e.target.value })}
                    required
                    minLength={10}
                  />
                </Field>
                <Field label="Decisions" hint="Optional.">
                  <Textarea
                    value={form.decisions}
                    onChange={(e) => setForm({ ...form, decisions: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Next meeting" hint="Optional.">
                    <Input
                      type="date"
                      value={form.nextDate}
                      onChange={(e) => setForm({ ...form, nextDate: e.target.value })}
                    />
                  </Field>
                  <Field label="Time">
                    <Input
                      type="time"
                      value={form.nextTime}
                      onChange={(e) => setForm({ ...form, nextTime: e.target.value })}
                    />
                  </Field>
                </div>
              </>
            )}
          </form>
        )}
      </Modal>
    </>
  );
}