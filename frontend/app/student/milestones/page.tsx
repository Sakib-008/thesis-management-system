import Link from "next/link";
import { CalendarClock, Upload } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { dueLabel } from "@/lib/format";
import { STATUS_TONE } from "@/lib/mock/shared";
import { MILESTONES } from "@/lib/mock/thesisDemo";

export default function MilestonesPage() {
  const done = MILESTONES.filter((m) => m.status === "Completed").length;
  const average = Math.round(MILESTONES.reduce((sum, m) => sum + m.progress, 0) / MILESTONES.length);

  return (
    <>
      <PageHeader title="Milestones" description="The stages your supervisor set for your thesis. Submit your work for each one." />
      <DemoBanner />

      <Card className="mb-6">
        <div className="flex items-center gap-6 p-5">
          <ProgressRing value={average} size={96} stroke={8} />
          <div>
            <div className="text-lg font-semibold">{done} of {MILESTONES.length} milestones completed</div>
            <p className="text-sm text-subtle">Overall progress is the average across all milestones.</p>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {MILESTONES.map((m) => (
          <Card key={m.id}>
            <div className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{m.title}</h3>
                  <Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge>
                </div>
                <p className="text-sm text-subtle">{m.description}</p>
                <div className="flex items-center gap-3">
                  <ProgressBar value={m.progress} max={100} />
                  <span className="w-10 text-right text-xs font-medium tabular-nums">{m.progress}%</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-subtle">
                  <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{m.status === "Completed" ? "Finished" : dueLabel(m.daysLeft)}</span>
                  <span>{m.submissions} submission{m.submissions === 1 ? "" : "s"}</span>
                </div>
              </div>
              <Link href={`/student/milestones/${m.id}/submit`}>
                <Button variant={m.status === "Completed" ? "secondary" : "primary"} size="sm">
                  <Upload className="h-4 w-4" />{m.status === "Completed" ? "View" : "Submit work"}
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}