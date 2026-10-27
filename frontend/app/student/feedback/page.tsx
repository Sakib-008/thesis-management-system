import Link from "next/link";
import { ArrowRight, CircleDot } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { daysAgoLabel } from "@/lib/format";
import { FEEDBACK_THREADS, OUTCOME_TONE } from "@/lib/mock/thesisDemo";

export default function FeedbackPage() {
  return (
    <>
      <PageHeader title="Feedback" description="Your supervisor's feedback on everything you have submitted, newest first." />
      <DemoBanner />

      <div className="space-y-4">
        {FEEDBACK_THREADS.map((t) => (
          <Card key={t.id}>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={t.from.replace("Dr. ", "")} />
                  <div>
                    <div className="font-semibold">{t.submission}</div>
                    <div className="text-xs text-subtle">{t.from} · {daysAgoLabel(t.daysAgo)}</div>
                  </div>
                </div>
                <Badge tone={OUTCOME_TONE[t.outcome]}>{t.outcome}</Badge>
              </div>
              <ul className="space-y-2 text-sm">
                {t.points.map((p) => (
                  <li key={p} className="flex gap-2"><CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-subtle" /><span>{p}</span></li>
                ))}
              </ul>
              {t.outcome === "Revision required" && (
                <Link href="/student/milestones">
                  <Button variant="secondary" size="sm">Resubmit revised work<ArrowRight className="h-4 w-4" /></Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}