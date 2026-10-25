"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeCheck, CalendarClock, CheckCircle2, Clock, FileText, ListChecks, MessageSquare, Send, Target, UserCircle } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatCard } from "@/components/ui/StatCard";
import { ApiError, apiGet, errorMessage } from "@/lib/apiClient";
import { daysAgoLabel, dueLabel } from "@/lib/format";
import { STATUS_TONE } from "@/lib/mock/shared";
import {
  STUDENT_DEADLINES, STUDENT_FEEDBACK, STUDENT_MILESTONES, STUDENT_THESIS,
} from "@/lib/mock/studentDemo";
import { Student } from "@/lib/types";

// profile: undefined = still loading, null = the student has not created one yet
function ProfileBanner({ profile }: { profile: Student | null | undefined }) {
  if (profile === undefined) return null;

  if (profile === null) {
    return (
      <Card className="mb-6 border-brand/30 bg-brand/5">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <UserCircle className="mt-0.5 h-5 w-5 text-brand" />
            <div>
              <div className="font-medium">Complete your profile</div>
              <p className="text-sm text-subtle">Add your department, program and CGPA so you can be matched with a supervisor.</p>
            </div>
          </div>
          <Link href="/student/profile"><Button>Complete profile</Button></Link>
        </div>
      </Card>
    );
  }

  if (!profile.cgpa_verified) {
    return (
      <Card className="mb-6 border-warning/30 bg-warning/5">
        <div className="flex items-start gap-3 p-5">
          <Clock className="mt-0.5 h-5 w-5 text-warning" />
          <div>
            <div className="font-medium">Your CGPA is waiting for verification</div>
            <p className="text-sm text-subtle">A coordinator will check it against official records. Supervisor allocation only uses verified CGPAs.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="mb-6 flex items-center gap-2 text-sm text-success">
      <BadgeCheck className="h-4 w-4" /> Profile complete and CGPA verified
    </div>
  );
}

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Student | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Student>("/api/v1/students/me")
      .then(setProfile)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setProfile(null);
        else setError(errorMessage(e));
      });
  }, []);

  const completed = STUDENT_MILESTONES.filter((m) => m.status === "Completed").length;
  const inProgress = STUDENT_MILESTONES.filter((m) => m.status === "In progress");
  const nextDeadline = Math.min(...STUDENT_DEADLINES.map((d) => d.daysLeft));
  const firstName = user?.full_name.split(" ")[0] ?? "";

  return (
    <>
      <PageHeader title={`Welcome back, ${firstName}`} description="Your thesis at a glance." />
      {error && <Alert>{error}</Alert>}
      <ProfileBanner profile={profile} />

      <SectionTitle title="My thesis" demo first />
      <Card className="mb-6">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
          <ProgressRing value={STUDENT_THESIS.progress} label="complete" />
          <div className="flex-1 space-y-3">
            <Badge tone="brand">{STUDENT_THESIS.status}</Badge>
            <h2 className="text-xl font-semibold leading-snug">{STUDENT_THESIS.title}</h2>
            <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-subtle">Supervisor</dt><dd className="font-medium">{STUDENT_THESIS.supervisor}</dd></div>
              <div><dt className="text-subtle">Current milestone</dt><dd className="font-medium">{inProgress[0]?.title ?? "None"}</dd></div>
            </dl>
          </div>
        </div>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Overall progress" value={`${STUDENT_THESIS.progress}%`} icon={Target} tone="brand" />
        <StatCard label="Milestones completed" value={`${completed}/${STUDENT_MILESTONES.length}`} icon={CheckCircle2} tone="success" />
        <StatCard label="Next deadline" value={nextDeadline === 0 ? "Today" : `${nextDeadline} days`} icon={CalendarClock} tone="warning" />
        <StatCard label="Pending submissions" value={inProgress.length} icon={Send} tone="info" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Milestones" description="Progress on each stage of your thesis" action={<DemoBadge />} />
          <ul className="divide-y divide-line">
            {STUDENT_MILESTONES.map((m) => (
              <li key={m.title} className="px-5 py-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-subtle" />
                    <span className="font-medium">{m.title}</span>
                    <Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge>
                  </div>
                  <span className="text-xs text-subtle">{m.status === "Completed" ? "Finished" : dueLabel(m.daysLeft)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <ProgressBar value={m.progress} max={100} />
                  <span className="w-10 text-right text-xs font-medium tabular-nums">{m.progress}%</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Upcoming" action={<DemoBadge />} />
            <ul className="divide-y divide-line">
              {STUDENT_DEADLINES.slice().sort((a, b) => a.daysLeft - b.daysLeft).map((d) => (
                <li key={d.title} className="flex items-start gap-3 px-5 py-3.5 text-sm">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    {d.kind === "meeting" ? <CalendarClock className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="font-medium">{d.title}</div>
                    <div className={d.daysLeft <= 3 ? "text-xs font-medium text-warning" : "text-xs text-subtle"}>{dueLabel(d.daysLeft)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Latest feedback" action={<DemoBadge />} />
            <ul className="divide-y divide-line">
              {STUDENT_FEEDBACK.map((f) => (
                <li key={f.about} className="px-5 py-3.5 text-sm">
                  <div className="mb-1.5 flex items-center gap-2">
                    <Avatar name={f.from} className="h-7 w-7 text-[10px]" />
                    <div className="leading-tight">
                      <div className="font-medium">{f.from}</div>
                      <div className="text-xs text-subtle">{f.about} · {daysAgoLabel(f.daysAgo)}</div>
                    </div>
                    <MessageSquare className="ml-auto h-4 w-4 text-subtle" />
                  </div>
                  <p className="text-subtle">{f.text}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}