import Link from "next/link";
import { CalendarClock, ListChecks, Mail } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { dueLabel } from "@/lib/format";
import { STATUS_TONE } from "@/lib/mock/shared";
import { SUPERVISOR_STUDENTS } from "@/lib/mock/supervisorDemo";

export default function SupervisorStudentsPage() {
  return (
    <>
      <PageHeader title="My students" description="Everyone you supervise, with progress on their thesis." />
      <DemoBanner />

      <div className="grid gap-5 md:grid-cols-2">
        {SUPERVISOR_STUDENTS.map((s) => (
          <Card key={s.id}>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} className="h-11 w-11" />
                  <div>
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-subtle">{s.program} · Batch {s.batch}</div>
                  </div>
                </div>
                <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
              </div>

              <p className="text-sm font-medium leading-snug">{s.thesis}</p>

              <div>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="text-subtle">Overall progress</span>
                  <span className="font-medium tabular-nums">{s.progress}%</span>
                </div>
                <ProgressBar value={s.progress} max={100} />
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-subtle">
                <span className="flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5" />{s.milestonesDone}/{s.milestonesTotal} milestones done</span>
                <span className={s.nextDueDays < 0 ? "flex items-center gap-1.5 font-medium text-danger" : "flex items-center gap-1.5"}>
                  <CalendarClock className="h-3.5 w-3.5" />{dueLabel(s.nextDueDays)}
                </span>
                <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{s.email}</span>
              </div>

              <div className="border-t border-line pt-4">
                <Link href="/supervisor/milestones"><Button variant="secondary" size="sm">Manage milestones</Button></Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}