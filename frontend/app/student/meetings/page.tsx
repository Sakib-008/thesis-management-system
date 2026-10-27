"use client";

import { FormEvent, useState } from "react";
import { CalendarClock, CalendarPlus, CheckCircle2, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { daysAgoLabel, inDaysLabel } from "@/lib/format";
import { PAST_MEETINGS, UPCOMING_MEETINGS } from "@/lib/mock/thesisDemo";

export default function StudentMeetingsPage() {
  const toast = useToast();
  const [upcoming, setUpcoming] = useState(UPCOMING_MEETINGS);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: "", time: "10:00", agenda: "" });

  function request(e: FormEvent) {
    e.preventDefault();
    const inDays = Math.max(0, Math.ceil((new Date(form.date).getTime() - Date.now()) / 86_400_000));
    setUpcoming([...upcoming, { id: Date.now(), topic: "Requested meeting", inDays, time: form.time, status: "Requested", agenda: form.agenda }]);
    toast.success("Meeting requested. Your supervisor will confirm (demo: not saved yet)");
    setOpen(false);
    setForm({ date: "", time: "10:00", agenda: "" });
  }

  return (
    <>
      <PageHeader
        title="Meetings"
        description="Upcoming meetings with your supervisor and the notes from past ones."
        actions={<Button onClick={() => setOpen(true)}><CalendarPlus className="h-4 w-4" />Request meeting</Button>}
      />
      <DemoBanner />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="h-fit">
          <CardHeader title="Upcoming" />
          <ul className="divide-y divide-line">
            {upcoming.slice().sort((a, b) => a.inDays - b.inDays).map((m) => (
              <li key={m.id} className="px-5 py-4 text-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-medium">{m.topic}</span>
                  <Badge tone={m.status === "Confirmed" ? "success" : "warning"}>{m.status}</Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-subtle"><CalendarClock className="h-3.5 w-3.5" />{inDaysLabel(m.inDays)} · {m.time}</div>
                {m.agenda && <p className="mt-2 text-subtle">{m.agenda}</p>}
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">Past meetings</h2>
          {PAST_MEETINGS.map((m) => (
            <Card key={m.id}>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{m.topic}</h3>
                  <span className="text-xs text-subtle">{daysAgoLabel(m.daysAgo)}</span>
                </div>
                <p className="text-subtle">{m.discussion}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-subtle"><CheckCircle2 className="h-3.5 w-3.5" />Decisions</div>
                    <ul className="list-disc space-y-1 pl-5">{m.decisions.map((d) => <li key={d}>{d}</li>)}</ul>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-subtle"><ListTodo className="h-3.5 w-3.5" />Action items</div>
                    <ul className="list-disc space-y-1 pl-5">{m.actions.map((a) => <li key={a}>{a}</li>)}</ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Modal open={open} title="Request a meeting" onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="request-meeting-form">Send request</Button>
          </>
        }>
        <form id="request-meeting-form" className="space-y-4" onSubmit={request}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></Field>
            <Field label="Time"><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required /></Field>
          </div>
          <Field label="Agenda"><Textarea value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} required /></Field>
        </form>
      </Modal>
    </>
  );
}