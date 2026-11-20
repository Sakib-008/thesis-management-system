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
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatCard } from "@/components/ui/StatCard";
import { Table, Td } from "@/components/ui/Table";
import { ApiError, apiGet, errorMessage } from "@/lib/apiClient";
import { timeAgo } from "@/lib/format";
import { formatDateTime } from "@/lib/reportStatus";
import { MilestoneSubmission, Meeting, Supervisor, ThesisProgress } from "@/lib/types";

interface DashboardStats {
  students_count: number;
  pending_reviews: number;
  upcoming_meetings: number;
  overdue_milestones: number;
  waiting_reports: number;
}

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
              <p className="text-sm text-subtle">
                Choose your designation and research fields so students can be matched to you.
              </p>
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
            {profile.fields.length === 0 ? (
              <Link href="/supervisor/profile" className="text-sm font-medium text-brand hover:underline">
                Add research fields to be matched
              </Link>
            ) : (
              profile.fields.map((f) => <Badge key={f.id} tone="brand">{f.name}</Badge>)
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SupervisorDashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Supervisor | null | undefined>(undefined);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [students, setStudents] = useState<ThesisProgress[]>([]);
  const [reviews, setReviews] = useState<MilestoneSubmission[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Supervisor>("/api/v1/supervisors/me")
      .then(setProfile)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setProfile(null);
        else setError(errorMessage(e));
      });
    Promise.all([
      apiGet<DashboardStats>("/api/v1/dashboard/supervisor"),
      apiGet<ThesisProgress[]>("/api/v1/milestones/progress"),
      apiGet<MilestoneSubmission[]>("/api/v1/submissions?status=submitted"),
      apiGet<Meeting[]>("/api/v1/meetings"),
    ])
      .then(([s, p, r, m]) => {
        setStats(s);
        setStudents(p);
        setReviews(r);
        const upcoming = m.filter((x) => x.status === "scheduled");
        upcoming.sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
        setMeetings(upcoming);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const firstName = user?.full_name.split(" ")[0] ?? "";

  return (
    <>
      <PageHeader title={`Welcome back, ${firstName}`} description="Your students, reviews and meetings." />
      {error && <Alert>{error}</Alert>}
      <CapacityCard profile={profile} />
      <SectionTitle title="Supervision overview" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students supervised" value={stats?.students_count ?? "-"} icon={Users} tone="brand" />
        <StatCard label="Pending reviews" value={stats?.pending_reviews ?? "-"} icon={FileSearch} tone="info" />
        <StatCard
          label="Upcoming meetings"
          value={stats?.upcoming_meetings ?? "-"}
          icon={CalendarClock}
          tone="success"
        />
        <StatCard
          label="Overdue milestones"
          value={stats?.overdue_milestones ?? "-"}
          icon={AlertTriangle}
          tone="warning"
        />
      </div>
      <Card className="mb-6">
        <CardHeader title="My students" description="Progress of every thesis you supervise" />
        <Table
          headers={["Student", "Thesis", "Progress", "Status", "Next deadline"]}
          emptyText={students.length === 0 ? "No students assigned yet." : undefined}
        >
          {students.map((s) => (
            <tr key={s.thesis_id} className="hover:bg-ink/[0.02]">
              <Td>
                <div className="flex items-center gap-3">
                  <Avatar name={s.student_names[0] ?? "?"} />
                  <span className="font-medium">{s.student_names.join(", ")}</span>
                </div>
              </Td>
              <Td className="max-w-[260px] truncate text-subtle">{s.title}</Td>
              <Td>
                <div className="flex w-36 items-center gap-2">
                  <ProgressBar value={s.completed} max={Math.max(s.total, 1)} />
                  <span className="w-9 text-xs font-medium tabular-nums">{s.percent}%</span>
                </div>
              </Td>
              <Td>
                {s.overdue > 0 ? (
                  <Badge tone="danger">{s.overdue} overdue</Badge>
                ) : s.revision_required > 0 ? (
                  <Badge tone="warning">{s.revision_required} to revise</Badge>
                ) : (
                  <Badge tone="success">On track</Badge>
                )}
              </Td>
              <Td className="text-subtle">
                {s.next_deadline
                  ? new Date(s.next_deadline).toLocaleDateString(undefined, { dateStyle: "medium" })
                  : "-"}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Waiting for your review" />
          {reviews.length === 0 ? (
            <p className="px-5 py-6 text-sm text-subtle">Nothing waiting for review.</p>
          ) : (
            <ul className="divide-y divide-line">
              {reviews.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3.5 text-sm">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{r.milestone_title}</div>
                    <div className="text-xs text-subtle">{r.student_names.join(", ")}</div>
                  </div>
                  <span className="text-xs text-subtle">{timeAgo(r.submitted_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Upcoming meetings" />
          {meetings.length === 0 ? (
            <p className="px-5 py-6 text-sm text-subtle">No meetings scheduled.</p>
          ) : (
            <ul className="divide-y divide-line">
              {meetings.slice(0, 6).map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3.5 text-sm">
                  <div
                    className={
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success"
                    }
                  >
                    <CalendarClock className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{m.agenda}</div>
                    <div className="text-xs text-subtle">{m.student_names.join(", ")}</div>
                  </div>
                  <div className="text-right text-xs font-medium">{formatDateTime(m.meeting_date)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
