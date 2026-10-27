"use client";

import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { FilePicker } from "@/components/ui/FilePicker";
import { Field, Textarea } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { daysAgoLabel, dueLabel } from "@/lib/format";
import { STATUS_TONE } from "@/lib/mock/shared";
import { MILESTONE_SUBMISSIONS, MILESTONES } from "@/lib/mock/thesisDemo";

export default function SubmitMilestonePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const milestone = MILESTONES.find((m) => String(m.id) === params.id) ?? MILESTONES[0];
  const history = MILESTONE_SUBMISSIONS[milestone.id] ?? [];
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    toast.success(`Work submitted for "${milestone.title}" (demo: not saved yet)`);
    router.push("/student/milestones");
  }

  return (
    <>
      <PageHeader title={milestone.title} description="Submit your work for this milestone." />
      <DemoBanner />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader title="About this milestone" />
            <CardContent className="space-y-3 text-sm">
              <Badge tone={STATUS_TONE[milestone.status]}>{milestone.status}</Badge>
              <p className="text-subtle">{milestone.description}</p>
              <p className="font-medium">{milestone.status === "Completed" ? "Finished" : dueLabel(milestone.daysLeft)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Previous submissions" />
            {history.length === 0 ? (
              <p className="px-5 py-6 text-sm text-subtle">Nothing submitted yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {history.map((h) => (
                  <li key={h.version} className="px-5 py-3.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Version {h.version}</span>
                      <Badge tone={h.status === "Approved" ? "success" : h.status === "Under review" ? "info" : "warning"}>{h.status}</Badge>
                    </div>
                    <p className="mt-1 text-subtle">{h.note}</p>
                    <p className="text-xs text-subtle">{daysAgoLabel(h.daysAgo)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit lg:col-span-2">
          <CardHeader title="New submission" description="Upload a new version. Your supervisor is notified when you submit." />
          <CardContent>
            <form className="space-y-5" onSubmit={submit}>
              <div>
                <div className="mb-1.5 text-sm font-medium">Document</div>
                <FilePicker accept=".pdf,.doc,.docx" onChange={setFile} />
                <p className="mt-1.5 text-xs text-subtle">PDF or Word document.</p>
              </div>
              <Field label="Notes for your supervisor" hint="What changed since the last version?">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <Button type="submit" disabled={!file}>Submit work</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}