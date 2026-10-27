"use client";

import { FormEvent, useState } from "react";
import { CalendarClock, CalendarPlus, Check, CheckCircle2, ListTodo, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { daysAgoLabel, inDaysLabel } from "@/lib/format";
import {
  MEETING_REQUESTS, SUPERVISOR_MEETINGS, SUPERVISOR_PAST_MEETINGS, SUPERVISOR_STUDENTS,
} from "@/lib/mock/supervisorDemo";

const EMPTY = { student: SUPERVISOR_STUDENTS[0].name, topic: "", discussion: "", decisions: "", actions: "", next: "" };
const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

export default function SupervisorMeetingsPage() {
  const toast = useToast();
  const [requests, setRequests] = useState(MEETING_REQUESTS);
  const [upcoming, setUpcoming] = useState(SUPERVISOR_MEETINGS);
  const [past, setPast] = useState(SUPERVISOR_PAST_MEETINGS);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  function answer(id: number, accept: boolean) {
    const request = requests.find((r) => r.id === id);
    if (!request) return;
    setRequests((list) => list.filter((r) => r.id !== id));
    if (accept) setUpcoming((list) => [...list, { student: request.student, topic: request.topic, inDays: request.inDays, time: request.time }]);
    toast.success(accept ? `Meeting with ${request.student} confirmed (demo)` : `Request from ${request.student} declined (demo)`);
  }

  function record(e: FormEvent) {
    e.preventDefault();
    setPast([{
      id: Date.now(), student: form.student, topic: form.topic, daysAgo: 0,
      discussion: form.discussion, decisions: lines(form.decisions), actions: lines(form.actions),
    }, ...past]);
    toast.success("Meeting recorded (demo: not saved yet)");
    setOpen(false);
    setForm(EMPTY);
  }

  return (
    <>
      <PageHeader
        title="Meetings"
        description="Confirm requests, see what is coming up, and keep a record of every meeting."
        actions={<Button onClick={() => setOpen(true)}><CalendarPlus className="h-4 w-4" />Record meeting</Button>}
      />
      <DemoBanner />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          {requests.length > 0 && (
            <Card className="border-warning/30">
              <CardHeader title="Meeting requests" description={`${requests.length} waiting for you`} />
              <ul className="divide-y divide-line">
                {requests.map((r) => (
                  <li key={r.id} className="space-y-3 px-5 py-4 text-sm">
                    <div>
                      <div className="font-medium">{r.student}: {r.topic}</div>
                      <div className="flex items-center gap-1.5 text-xs text-subtle"><CalendarClock className="h-3.5 w-3.5" />{inDaysLabel(r.inDays)} · {r.time}</div>
                      <p className="mt-1 text-subtle">{r.agenda}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => answer(r.id, true)}><Check className="h-3.5 w-3.5" />Confirm</Button>
                      <Button size="sm" variant="secondary" onClick={() => answer(r.id, false)}><X className="h-3.5 w-3.5" />Decline</Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Upcoming" />
            <ul className="divide-y divide-line">
              {upcoming.slice().sort((a, b) => a.inDays - b.inDays).map((m) => (
                <li key={`${m.student}-${m.topic}`} className="flex items-center gap-3 px-5 py-3.5 text-sm">
                  <Avatar name={m.student} className="h-8 w-8 text-[10px]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{m.topic}</div>
                    <div className="text-xs text-subtle">{m.student}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-medium">{inDaysLabel(m.inDays)}</div>
                    <div className="text-subtle">{m.time}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">Meeting records</h2>
          {past.map((m) => (
            <Card key={m.id}>
              <CardContent className="space-y-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{m.topic}</h3>
                    <div className="text-xs text-subtle">{m.student}</div>
                  </div>
                  <Badge>{daysAgoLabel(m.daysAgo)}</Badge>
                </div>
                {m.discussion && <p className="text-subtle">{m.discussion}</p>}
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

      <Modal open={open} title="Record a meeting" onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="record-meeting-form">Save record</Button>
          </>
        }>
        <form id="record-meeting-form" className="space-y-4" onSubmit={record}>
          <Field label="Student">
            <Select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })}>
              {SUPERVISOR_STUDENTS.map((s) => <option key={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Topic"><Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} required /></Field>
          <Field label="Discussion"><Textarea value={form.discussion} onChange={(e) => setForm({ ...form, discussion: e.target.value })} /></Field>
          <Field label="Decisions" hint="One per line"><Textarea value={form.decisions} onChange={(e) => setForm({ ...form, decisions: e.target.value })} /></Field>
          <Field label="Action items" hint="One per line"><Textarea value={form.actions} onChange={(e) => setForm({ ...form, actions: e.target.value })} /></Field>
          <Field label="Next meeting"><Input type="date" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} /></Field>
        </form>
      </Modal>
    </>
  );
}