"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarClock, Flag, MessageSquareText, Upload } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Spinner } from "@/components/ui/Spinner";
import { apiGet, errorMessage } from "@/lib/apiClient";
import {
  MILESTONE_LABEL, MILESTONE_TONE, dueText, formatDay, isOpenForWork,
} from "@/lib/supervisionUi";
import { Milestone, ThesisProgress } from "@/lib/types";

export default function MilestonesPage() {
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [progress, setProgress] = useState<ThesisProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<Milestone[]>("/api/v1/milestones"),
      apiGet<ThesisProgress[]>("/api/v1/milestones/progress"),
    ])
      .then(([list, summary]) => {
        setMilestones(list);
        setProgress(summary[0] ?? null);
      })
      .catch((e) => {
        setError(errorMessage(e));
        setMilestones([]);
      });
  }, []);

  return (
    <>
      <PageHeader
        title="Milestones"
        description="The stages your supervisor set for your thesis. Hand in your work for each one."
      />
      {error && <Alert>{error}</Alert>}
      {milestones === null && <Spinner className="mt-10 h-8 w-8" />}

      {milestones !== null && milestones.length === 0 && !error && (
        <Card>
          <EmptyState
            icon={Flag}
            title="No milestones yet"
            description="Your supervisor plans the milestones of your thesis. They will appear here."
          />
        </Card>
      )}

      {progress && progress.total > 0 && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center gap-6 p-5">
            <ProgressRing value={progress.percent} size={96} stroke={8} />
            <div className="space-y-2">
              <div className="text-lg font-semibold">
                {progress.completed} of {progress.total} milestones completed
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="info">{progress.in_review} waiting for review</Badge>
                <Badge tone="warning">{progress.revision_required} with changes requested</Badge>
                <Badge tone={progress.overdue > 0 ? "danger" : "neutral"}>{progress.overdue} overdue</Badge>
              </div>
              {progress.next_deadline && (
                <p className="text-sm text-subtle">Next deadline: {formatDay(progress.next_deadline)}</p>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {(milestones ?? []).map((m) => (
          <Card key={m.id}>
            <div className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{m.title}</h3>
                  <Badge tone={MILESTONE_TONE[m.status]}>{MILESTONE_LABEL[m.status]}</Badge>
                  {m.overdue && <Badge tone="danger">Overdue</Badge>}
                  {m.open_feedback_count > 0 && (
                    <Badge tone="warning">
                      <MessageSquareText className="mr-1 h-3 w-3" />
                      {m.open_feedback_count} comment{m.open_feedback_count === 1 ? "" : "s"} to act on
                    </Badge>
                  )}
                </div>
                {m.description && <p className="text-sm text-subtle">{m.description}</p>}
                <div className="flex flex-wrap items-center gap-4 text-xs text-subtle">
                  <span className="flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" />{dueText(m)} · {formatDay(m.deadline)}
                  </span>
                  <span>{m.submissions_count} submission{m.submissions_count === 1 ? "" : "s"}</span>
                </div>
              </div>
              <Link href={`/student/milestones/${m.id}/submit`}>
                <Button size="sm" variant={isOpenForWork(m.status) ? "primary" : "secondary"}>
                  <Upload className="h-4 w-4" />{isOpenForWork(m.status) ? "Submit work" : "View"}
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}