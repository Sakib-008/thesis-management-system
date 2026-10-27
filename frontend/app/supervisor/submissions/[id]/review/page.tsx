"use client";

import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, Download, FileText, RotateCcw } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Field, Textarea } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { daysAgoLabel } from "@/lib/format";
import { SUBMISSIONS_TO_REVIEW } from "@/lib/mock/supervisorDemo";

type Decision = "approve" | "revise";

export default function ReviewSubmissionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const submission = SUBMISSIONS_TO_REVIEW.find((s) => String(s.id) === params.id) ?? SUBMISSIONS_TO_REVIEW[0];
  const [decision, setDecision] = useState<Decision>("approve");
  const [feedback, setFeedback] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    toast.success(
      decision === "approve"
        ? `Approved ${submission.milestone} v${submission.version} (demo: not saved yet)`
        : `Revision requested from ${submission.student} (demo: not saved yet)`,
    );
    router.push("/supervisor/milestones");
  }

  return (
    <>
      <PageHeader title={`${submission.milestone}, version ${submission.version}`} description={`Submitted by ${submission.student}`} />
      <DemoBanner />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Submission" />
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <Avatar name={submission.student} />
                <div>
                  <div className="font-medium">{submission.student}</div>
                  <div className="text-xs text-subtle">{daysAgoLabel(submission.daysAgo)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-line p-3">
                <FileText className="h-5 w-5 text-subtle" />
                <span className="flex-1 truncate">{submission.file}</span>
                <Button variant="ghost" size="sm" onClick={() => toast.success("Download is a demo for now")}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">Student's note</div>
                <p className="text-subtle">{submission.note}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit lg:col-span-2">
          <CardHeader title="Your review" description="The student is notified as soon as you submit." />
          <CardContent>
            <form className="space-y-5" onSubmit={submit}>
              <div className="grid gap-2 sm:grid-cols-2">
                {([["approve", "Approve", Check], ["revise", "Request revision", RotateCcw]] as const).map(([value, label, Icon]) => (
                  <button key={value} type="button" aria-pressed={decision === value} onClick={() => setDecision(value)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors",
                      decision === value ? "border-brand bg-brand/10 text-brand" : "border-line text-subtle hover:bg-ink/5",
                    )}>
                    <Icon className="h-4 w-4" />{label}
                  </button>
                ))}
              </div>
              <Field label="Feedback" hint="One point per line. Students see each line as a separate item.">
                <Textarea className="min-h-[160px]" value={feedback} onChange={(e) => setFeedback(e.target.value)}
                  required={decision === "revise"} placeholder={"Add recent references\nClarify the research gap"} />
              </Field>
              <div className="flex gap-3">
                <Button type="submit">Submit review</Button>
                <Button variant="secondary" onClick={() => router.push("/supervisor/milestones")}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}