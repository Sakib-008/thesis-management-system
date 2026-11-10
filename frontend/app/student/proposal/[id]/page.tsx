"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { History, MessageSquareText, Pencil, Send, Sparkles } from "lucide-react";
import { ProposalDetails } from "@/components/proposals/ProposalDetails";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StatusTimeline } from "@/components/ui/StatusTimeline";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPost, errorMessage } from "@/lib/apiClient";
import { timeAgo } from "@/lib/format";
import {
  isEditable, STATUS_BADGE, STATUS_LABEL, timelineStep, TIMELINE_STEPS,
} from "@/lib/proposalStatus";
import { MyAssignment, Proposal, ProposalVersion } from "@/lib/types";

export default function ProposalPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [versions, setVersions] = useState<ProposalVersion[]>([]);
  const [assignment, setAssignment] = useState<MyAssignment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setProposal(await apiGet<Proposal>(`/api/v1/proposals/${params.id}`));
      setVersions(await apiGet<ProposalVersion[]>(`/api/v1/proposals/${params.id}/versions`));
      // 404 simply means that no supervisor has been assigned yet
      setAssignment(await apiGet<MyAssignment>(`/api/v1/proposals/${params.id}/assignment`).catch(() => null));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    setSubmitting(true);
    try {
      await apiPost("/api/v1/proposals/me/submit");
      toast.success("Proposal submitted for review");
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <Alert>{error}</Alert>;
  if (!proposal) return <Spinner className="mt-20 h-8 w-8" />;

  const editable = isEditable(proposal.status);
  const review = proposal.latest_review;

  return (
    <>
      <PageHeader
        title={proposal.title || "Untitled proposal"}
        description="Your thesis proposal and its review status."
        actions={
          <>
            <Badge tone={STATUS_BADGE[proposal.status]}>{STATUS_LABEL[proposal.status]}</Badge>
            {editable && (
              <Link href="/student/proposal/new">
                <Button variant="secondary" size="sm"><Pencil className="h-4 w-4" />Edit</Button>
              </Link>
            )}
            {editable && (
              <Button size="sm" onClick={submit} loading={submitting}>
                <Send className="h-4 w-4" />Submit for review
              </Button>
            )}
            <Link href={`/student/proposal/${proposal.id}/recommendations`}>
              <Button variant="secondary" size="sm">
                <Sparkles className="h-4 w-4" />AI recommendations
              </Button>
            </Link>
          </>
        }
      />

      <Card className="mb-6">
        <CardHeader title="Review progress" />
        <CardContent>
          <StatusTimeline
            steps={TIMELINE_STEPS}
            current={timelineStep(proposal.status)}
            warning={proposal.status === "revision_required"}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Proposal" />
          <CardContent><ProposalDetails proposal={proposal} /></CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Your supervisor" />
            <CardContent className="text-sm">
              {assignment ? (
                <div className="flex items-center gap-3">
                  <Avatar name={assignment.supervisor_name.replace("Dr. ", "")} className="h-10 w-10" />
                  <div>
                    <div className="font-medium">{assignment.supervisor_name}</div>
                    <div className="text-xs text-subtle">{assignment.designation}</div>
                    <div className="text-xs text-subtle">{assignment.email}</div>
                  </div>
                </div>
              ) : (
                <p className="text-subtle">
                  {proposal.status === "approved"
                    ? "Waiting for the coordinator to assign a supervisor."
                    : "A supervisor is assigned after your proposal is approved."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Coordinator feedback" />
            <CardContent className="text-sm">
              {review ? (
                <div className="flex gap-3">
                  <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
                  <div>
                    <Badge tone={review.decision === "approved" ? "success" : "warning"}>
                      {review.decision === "approved" ? "Approved" : "Revision requested"}
                    </Badge>
                    {review.reason === "duplicate" && (
                      <div className="mt-2">
                        <Badge tone="danger">Too similar to an existing proposal</Badge>
                      </div>
                    )}
                    <p className="mt-2 whitespace-pre-line text-subtle">
                      {review.comment || "No comment was added."}
                    </p>
                    <p className="mt-2 text-xs text-subtle">
                      {review.reviewer?.full_name ?? "Coordinator"} · {timeAgo(review.created_at)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-subtle">No feedback yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Version history" description="A new version is saved each time you submit." />
            {versions.length === 0 ? (
              <p className="px-5 py-6 text-sm text-subtle">Nothing submitted yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-start gap-3 px-5 py-3.5 text-sm">
                    <History className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
                    <div>
                      <div className="font-medium">Version {v.version_no}</div>
                      <div className="text-xs text-subtle">Submitted {timeAgo(v.created_at)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
