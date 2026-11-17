"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Award, BadgeCheck, CalendarClock, CheckCircle2, Clock, ListChecks, MessageSquare, Send, Target, UserCircle,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatCard } from "@/components/ui/StatCard";
import { ApiError, apiGet, errorMessage } from "@/lib/apiClient";
import { formatDay } from "@/lib/supervisionUi";
import { Student } from "@/lib/types";

interface StudentStats {
  has_thesis: boolean;
  thesis_title: string | null;
  supervisor_name: string | null;
  milestones_total: number;
  milestones_completed: number;
  progress_percent: number;
  next_deadline: string | null;
  next_deadline_label: string | null;
  upcoming_meeting: string | null;
  open_feedback: number;
  overdue_reports: number;
  result_published: boolean;
}

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
              <p className="text-sm text-subtle">
                Add your department, program and CGPA so you can be matched with a supervisor.
              </p>
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
            <p className="text-sm text-subtle">
              A coordinator will check it against official records. Supervisor allocation only uses verified CGPAs.
            </p>
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
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Student>("/api/v1/students/me")
      .then(setProfile)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setProfile(null);
        else setError(errorMessage(e));
      });
    apiGet<StudentStats>("/api/v1/dashboard/student")
      .then(setStats)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const firstName = user?.full_name.split(" ")[0] ?? "";

  return (
    <>
      <PageHeader title={`Welcome back, ${firstName}`} description="Your thesis at a glance." />
      {error && <Alert>{error}</Alert>}
      <ProfileBanner profile={profile} />
      {stats && !stats.has_thesis && (
        <Card className="mb-6">
          <EmptyState
            icon={ListChecks}
            title="No thesis yet"
            description="Submit and get a proposal approved to start tracking milestones, meetings and reports here."
          />
        </Card>
      )}
      {stats && stats.has_thesis && (
        <>
          <SectionTitle title="My thesis" />
          <Card className="mb-6">
            <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
              <ProgressRing value={stats.progress_percent} label="complete" />
              <div className="flex-1 space-y-3">
                <Badge tone="brand">In progress</Badge>
                <h2 className="text-xl font-semibold leading-snug">{stats.thesis_title}</h2>
                <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-subtle">Supervisor</dt>
                    <dd className="font-medium">{stats.supervisor_name ?? "Not assigned yet"}</dd>
                  </div>
                  <div>
                    <dt className="text-subtle">Next milestone</dt>
                    <dd className="font-medium">{stats.next_deadline_label ?? "None"}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </Card>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Overall progress" value={`${stats.progress_percent}%`} icon={Target} tone="brand" />
            <StatCard
              label="Milestones completed"
              value={`${stats.milestones_completed}/${stats.milestones_total}`}
              icon={CheckCircle2}
              tone="success"
            />
            <StatCard
              label="Next deadline"
              value={stats.next_deadline ? formatDay(stats.next_deadline) : "None"}
              icon={CalendarClock}
              tone="warning"
            />
            <StatCard label="Comments to act on" value={stats.open_feedback} icon={Send} tone="info" />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Keep going" description="A few things worth checking today" />
              <ul className="divide-y divide-line">
                <li className="flex items-center gap-3 px-5 py-4 text-sm">
                  <ListChecks className="h-4 w-4 text-subtle" />
                  <span className="flex-1">Milestones completed so far</span>
                  <span className="font-medium">{stats.milestones_completed} of {stats.milestones_total}</span>
                </li>
                <li className="flex items-center gap-3 px-5 py-4 text-sm">
                  <MessageSquare className="h-4 w-4 text-subtle" />
                  <span className="flex-1">Supervisor comments to act on</span>
                  <Link href="/student/feedback" className="font-medium text-brand hover:underline">
                    {stats.open_feedback}
                  </Link>
                </li>
                <li className="flex items-center gap-3 px-5 py-4 text-sm">
                  <CalendarClock className="h-4 w-4 text-subtle" />
                  <span className="flex-1">Weekly reports overdue</span>
                  <Link href="/student/reports" className="font-medium text-brand hover:underline">
                    {stats.overdue_reports}
                  </Link>
                </li>
                {stats.result_published && (
                  <li className="flex items-center gap-3 px-5 py-4 text-sm">
                    <Award className="h-4 w-4 text-subtle" />
                    <span className="flex-1">Your evaluation result is published</span>
                    <Link href="/student/evaluation" className="font-medium text-brand hover:underline">
                      View
                    </Link>
                  </li>
                )}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Upcoming meeting" />
              {stats.upcoming_meeting ? (
                <div className="flex items-start gap-3 px-5 py-4 text-sm">
                  <div
                    className={
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand"
                    }
                  >
                    <CalendarClock className="h-4 w-4" />
                  </div>
                  <div className="font-medium">{formatDay(stats.upcoming_meeting)}</div>
                </div>
              ) : (
                <p className="px-5 py-6 text-sm text-subtle">No meeting scheduled yet.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
