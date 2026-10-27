"use client";

import { FormEvent, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Field, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Td } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { daysAgoLabel } from "@/lib/format";
import { SUPERVISOR_PROPOSALS } from "@/lib/mock/supervisorDemo";
import { PROPOSAL_STATUS_TONE, ProposalStatus } from "@/lib/mock/thesisDemo";
import { cn } from "@/lib/cn";

type Decision = "approve" | "revise";

export default function SupervisorProposalsPage() {
  const toast = useToast();
  const [proposals, setProposals] = useState(SUPERVISOR_PROPOSALS);
  const [reviewing, setReviewing] = useState<(typeof SUPERVISOR_PROPOSALS)[number] | null>(null);
  const [decision, setDecision] = useState<Decision>("approve");
  const [comment, setComment] = useState("");

  const awaiting = (s: ProposalStatus) => s === "Submitted" || s === "Under review";

  function open(p: (typeof SUPERVISOR_PROPOSALS)[number]) {
    setReviewing(p);
    setDecision("approve");
    setComment("");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!reviewing) return;
    const status: ProposalStatus = decision === "approve" ? "Approved" : "Revision required";
    setProposals((list) => list.map((p) => (p.id === reviewing.id ? { ...p, status } : p)));
    toast.success(`${decision === "approve" ? "Approved" : "Revision requested for"} "${reviewing.title}" (demo: not saved yet)`);
    setReviewing(null);
  }

  const waitingCount = proposals.filter((p) => awaiting(p.status)).length;

  return (
    <>
      <PageHeader title="Proposals" description={`${waitingCount} proposal${waitingCount === 1 ? "" : "s"} waiting for your review.`} />
      <DemoBanner />

      <Card>
        <Table headers={["Student", "Proposal", "Research fields", "Submitted", "Status", ""]}>
          {proposals.map((p) => (
            <tr key={p.id} className="hover:bg-ink/[0.02]">
              <Td className="font-medium">{p.student}</Td>
              <Td className="max-w-[260px] truncate">{p.title}</Td>
              <Td>
                <div className="flex flex-wrap gap-1.5">{p.fields.map((f) => <Badge key={f} tone="brand">{f}</Badge>)}</div>
              </Td>
              <Td className="text-subtle">{daysAgoLabel(p.daysAgo)}</Td>
              <Td><Badge tone={PROPOSAL_STATUS_TONE[p.status]}>{p.status}</Badge></Td>
              <Td className="text-right">
                <Button size="sm" variant={awaiting(p.status) ? "primary" : "secondary"} onClick={() => open(p)}>
                  {awaiting(p.status) ? "Review" : "View"}
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal open={reviewing !== null} title="Review proposal" onClose={() => setReviewing(null)}
        footer={
          reviewing && awaiting(reviewing.status) ? (
            <>
              <Button variant="secondary" onClick={() => setReviewing(null)}>Cancel</Button>
              <Button type="submit" form="review-proposal-form">Submit review</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setReviewing(null)}>Close</Button>
          )
        }>
        {reviewing && (
          <div className="space-y-4 text-sm">
            <div>
              <div className="font-semibold">{reviewing.title}</div>
              <div className="text-xs text-subtle">{reviewing.student} · {daysAgoLabel(reviewing.daysAgo)}</div>
            </div>
            <p className="text-subtle">{reviewing.abstract}</p>
            <div className="flex flex-wrap gap-1.5">{reviewing.fields.map((f) => <Badge key={f} tone="brand">{f}</Badge>)}</div>

            {awaiting(reviewing.status) && (
              <form id="review-proposal-form" className="space-y-4 border-t border-line pt-4" onSubmit={submit}>
                <div className="grid grid-cols-2 gap-2">
                  {([["approve", "Approve", Check], ["revise", "Request revision", RotateCcw]] as const).map(([value, label, Icon]) => (
                    <button key={value} type="button" aria-pressed={decision === value} onClick={() => setDecision(value)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                        decision === value ? "border-brand bg-brand/10 text-brand" : "border-line text-subtle hover:bg-ink/5",
                      )}>
                      <Icon className="h-4 w-4" />{label}
                    </button>
                  ))}
                </div>
                <Field label="Comment for the student" hint={decision === "revise" ? "Say what needs to change." : "Optional."}>
                  <Textarea value={comment} onChange={(e) => setComment(e.target.value)} required={decision === "revise"} />
                </Field>
              </form>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}