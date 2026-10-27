import Link from "next/link";
import { History, MessageSquareText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusTimeline } from "@/components/ui/StatusTimeline";
import { daysAgoLabel } from "@/lib/format";
import {
  PROPOSAL, PROPOSAL_STATUS_TONE, PROPOSAL_STEPS, PROPOSAL_VERSIONS, proposalStep,
} from "@/lib/mock/thesisDemo";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-sm font-semibold">{title}</h3>
      <div className="text-sm text-subtle">{children}</div>
    </div>
  );
}

export default function ProposalPage() {
  const step = proposalStep(PROPOSAL.status);
  return (
    <>
      <PageHeader
        title={PROPOSAL.title}
        description="Your thesis proposal and its review status."
        actions={
          <>
            <Badge tone={PROPOSAL_STATUS_TONE[PROPOSAL.status]}>{PROPOSAL.status}</Badge>
            <Link href="/student/proposal/1/recommendations">
              <Button variant="secondary" size="sm"><Sparkles className="h-4 w-4" />AI recommendations</Button>
            </Link>
          </>
        }
      />
      <DemoBanner />

      <Card className="mb-6">
        <CardHeader title="Review progress" />
        <CardContent><StatusTimeline steps={PROPOSAL_STEPS} current={step} warning={PROPOSAL.status === "Revision required"} /></CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Proposal" />
          <CardContent className="space-y-5">
            <Section title="Abstract">{PROPOSAL.abstract}</Section>
            <Section title="Problem statement">{PROPOSAL.problemStatement}</Section>
            <Section title="Objectives">
              <ul className="list-disc space-y-1 pl-5">{PROPOSAL.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
            </Section>
            <Section title="Methodology">{PROPOSAL.methodology}</Section>
            <Section title="Expected outcome">{PROPOSAL.expectedOutcome}</Section>
            <Section title="References">{PROPOSAL.references}</Section>
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              {PROPOSAL.fields.map((f) => <Badge key={f} tone="brand">{f}</Badge>)}
              {PROPOSAL.keywords.map((k) => <Badge key={k}>{k}</Badge>)}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Reviewer comment" />
            <CardContent className="flex gap-3 text-sm">
              <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
              <p className="text-subtle">{PROPOSAL.reviewerComment}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Version history" />
            <ul className="divide-y divide-line">
              {PROPOSAL_VERSIONS.map((v) => (
                <li key={v.version} className="flex items-start gap-3 px-5 py-3.5 text-sm">
                  <History className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
                  <div>
                    <div className="font-medium">Version {v.version}</div>
                    <div className="text-subtle">{v.note}</div>
                    <div className="text-xs text-subtle">{daysAgoLabel(v.daysAgo)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}