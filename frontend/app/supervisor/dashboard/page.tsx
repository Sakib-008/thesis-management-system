"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, ClipboardList, FileSearch, UserCircle, Users } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatCard } from "@/components/ui/StatCard";
import { Table, Td } from "@/components/ui/Table";
import { ApiError, apiGet, errorMessage } from "@/lib/apiClient";
import { daysAgoLabel, dueLabel, inDaysLabel } from "@/lib/format";
import { STATUS_TONE } from "@/lib/mock/shared";
import { SUPERVISOR_MEETINGS, SUPERVISOR_REVIEWS, SUPERVISOR_STUDENTS } from "@/lib/mock/supervisorDemo";
import { Supervisor } from "@/lib/types";

// profile: undefined = still loading, null = the supervisor has not created one yet
function CapacityCard({ profile }: { profile: Supervisor | null | undefined }) {
  if (profile === undefined) return null;

  if (profile === null) {
    return (
      <Card className="mb-6 border-brand/30 bg-brand/5">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <UserCircle className="mt-0.5 h-5 w-5 text-brand" />
            <div>
              <div className="font-medium">Create your research profile</div>
              <p className="text-sm text-subtle">Choose your designation and research fields so students can be matched to you.</p>
            </div>
          </div>
          <Link href="/supervisor/profile"><Button>Create profile</Button></Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader title="Your supervision capacity" action={<Badge tone="brand">{profile.designation.name}</Badge>} />
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-subtle">Students supervised</span>
            <span className="font-medium">{profile.current_count} / {profile.capacity}</span>
          </div>
          <ProgressBar value={profile.current_count} max={profile.capacity} />
          <p className="mt-2 text-xs text-subtle">{profile.capacity - profile.current_count} slot(s) available</p>
        </div>
        <div>
          <div className="mb-2 text-sm text-subtle">Research fields</div>
          <div className="flex flex-wrap gap-2">
            {profile.fields.length === 0
              ? <Link href="/supervisor/profile" className="text-sm font-medium text-brand hover:underline">Add research fields to be matched</Link>
              : profile.fields.map((f) => <Badge key={f.id} tone="brand">{f.name}</Badge>)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SupervisorDashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Supervisor | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Supervisor>("/api/v1/supervisors/me")
      .then(setProfile)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setProfile(null);
        else setError(errorMessage(e));
      });
  }, []);

  const overdue = SUPERVISOR_STUDENTS.filter((s) => s.status === "Overdue").length;
  const firstName = user?.full_name.split(" ")[0] ?? "";

  return (
    <>
      <PageHeader title={`Welcome back, ${firstName}`} description="Your students, reviews and meetings." />
      {error && <Alert>{error}</Alert>}
      <CapacityCard profile={profile} />

      <SectionTitle title="Supervision overview" demo first />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students supervised" value={SUPERVISOR_STUDENTS.length} icon={Users} tone="brand" />
        <StatCard label="Pending reviews" value={SUPERVISOR_REVIEWS.length} icon={FileSearch} tone="info" />
        <StatCard label="Upcoming meetings" value={SUPERVISOR_MEETINGS.length} icon={CalendarClock} tone="success" />
        <StatCard label="Overdue milestones" value={overdue} icon={AlertTriangle} tone="warning" />
      </div>

      <Card className="mb-6">
        <CardHeader title="My students" description="Progress of every thesis you supervise" action={<DemoBadge />} />
        <Table headers={["Student", "Thesis", "Progress", "Status", "Next deadline"]}>
          {SUPERVISOR_STUDENTS.map((s) => (
            <tr key={s.name} className="hover:bg-ink/[0.02]">
              <Td>
                <div className="flex items-center gap-3"><Avatar name={s.name} /><span className="font-medium">{s.name}</span></div>
              </Td>
              <Td className="max-w-[260px] truncate text-subtle">{s.thesis}</Td>
              <Td>
                <div className="flex w-36 items-center gap-2">
                  <ProgressBar value={s.progress} max={100} />
                  <span className="w-9 text-xs font-medium tabular-nums">{s.progress}%</span>
                </div>
              </Td>
              <Td><Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge></Td>
              <Td className={s.nextDueDays < 0 ? "font-medium text-danger" : "text-subtle"}>{dueLabel(s.nextDueDays)}</Td>
            </tr>
          ))}
        </Table>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Waiting for your review" action={<DemoBadge />} />
          <ul className="divide-y divide-line">
            {SUPERVISOR_REVIEWS.map((r) => (
              <li key={r.item} className="flex items-center gap-3 px-5 py-3.5 text-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info"><ClipboardList className="h-4 w-4" /></div>
                <div className="flex-1">
                  <div className="font-medium">{r.item}</div>
                  <div className="text-xs text-subtle">{r.student}</div>
                </div>
                <span className="text-xs text-subtle">{daysAgoLabel(r.daysAgo)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Upcoming meetings" action={<DemoBadge />} />
          <ul className="divide-y divide-line">
            {SUPERVISOR_MEETINGS.map((m) => (
              <li key={m.student} className="flex items-center gap-3 px-5 py-3.5 text-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success"><CalendarClock className="h-4 w-4" /></div>
                <div className="flex-1">
                  <div className="font-medium">{m.topic}</div>
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
    </>
  );
}