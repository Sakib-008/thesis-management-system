"use client";
import { FormEvent, useState } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DecisionToggle, Decision } from "@/components/ui/DecisionToggle";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Field, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Td } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { daysAgoLabel } from "@/lib/format";
import { QueueItem, REVIEW_QUEUE } from "@/lib/mock/coordinatorDemo";
import { PROPOSAL_STATUS_TONE, ProposalStatus } from "@/lib/mock/thesisDemo";
type Filter = "review" | "revision" | "approved" | "all";
const awaiting = (s: ProposalStatus) => s === "Submitted" || s === "Under review";
const MATCHES: Record<Filter, (p: QueueItem) => boolean> = {
  review: (p) => awaiting(p.status),
  revision: (p) => p.status === "Revision required",
  approved: (p) => p.status === "Approved",
  all: () => true,
};
export default function CoordinatorProposalsPage() {
  const toast = useToast();
  const [items, setItems] = useState(REVIEW_QUEUE);
  const [filter, setFilter] = useState<Filter>("review");
  const [open, setOpen] = useState<QueueItem | null>(null);
  const [decision, setDecision] = useState<Decision>("approve");
  const [comment, setComment] = useState("");
  const count = (f: Filter) => items.filter(MATCHES[f]).length;
  const visible = items.filter(MATCHES[filter]);
  function review(p: QueueItem) {
    setOpen(p);
    setDecision("approve");
    setComment("");
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!open) return;
    const status: ProposalStatus = decision === "approve" ? "Approved" : "Revision required";
    setItems((list) => list.map((p) => (p.id === open.id ? { ...p, status } : p)));
    toast.success(`${open.student}'s proposal: ${status.toLowerCase()} (demo: not saved yet)`);
    setOpen(null);
  }
  return (
    <>
      <PageHeader
        title="Proposals"
        description="Review every submitted proposal. Approved proposals move on to supervisor allocation."
      />
      <DemoBanner />
      <Tabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { id: "review", label: "Needs review", count: count("review") },
          { id: "revision", label: "Revision required", count: count("revision") },
          { id: "approved", label: "Approved", count: count("approved") },
          { id: "all", label: "All", count: items.length },
        ]}
      />
      <Card>
        <Table
          headers={["Student", "Proposal", "Fields", "Best AI match", "Submitted", "Status", ""]}
          emptyText={visible.length === 0 ? "No proposals in this view." : undefined}
        >
          {visible.map((p) => (
            <tr key={p.id} className="hover:bg-ink/[0.02]">
              <Td className="font-medium">{p.student}</Td>
              <Td className="max-w-[240px] truncate">{p.title}</Td>
              <Td>
                <div className="flex flex-wrap gap-1.5">
                  {p.fields.map((f) => <Badge key={f} tone="brand">{f}</Badge>)}
                </div>
                 </Td>
              <Td className="text-subtle">{p.topMatch.name} ({p.topMatch.score}%)</Td>
              <Td className="text-subtle">{daysAgoLabel(p.daysAgo)}</Td>
              <Td><Badge tone={PROPOSAL_STATUS_TONE[p.status]}>{p.status}</Badge></Td>
              <Td className="text-right">
                <Button size="sm" variant={awaiting(p.status) ? "primary" : "secondary"} onClick={() => review(p)}>
                  {awaiting(p.status) ? "Review" : "View"}
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
      <Modal
        open={open !== null}
        title="Review proposal"
        onClose={() => setOpen(null)}
        footer={
          open && awaiting(open.status) ? (
            <>
              <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              <Button type="submit" form="coordinator-review-form">Submit review</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setOpen(null)}>Close</Button>
          )
        }
      >
        {open && (
          <div className="space-y-4 text-sm">
            <div>
              <div className="font-semibold">{open.title}</div>
              <div className="text-xs text-subtle">{open.student} · {daysAgoLabel(open.daysAgo)}</div>
            </div>
            <p className="text-subtle">{open.abstract}</p>
            <div className="flex flex-wrap gap-1.5">
              {open.fields.map((f) => <Badge key={f} tone="brand">{f}</Badge>)}
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-brand/5 px-3 py-2">
              <Sparkles className="h-4 w-4 text-brand" />
              <span>Best AI match: <strong>{open.topMatch.name}</strong> ({open.topMatch.score}%)</span>
            </div>
            {awaiting(open.status) && (
              <form id="coordinator-review-form" className="space-y-4 border-t border-line pt-4" onSubmit={submit}>
                <DecisionToggle value={decision} onChange={setDecision} />
                <Field
                  label="Comment for the student"
                  hint={decision === "revise" ? "Say what needs to change." : "Optional."}
                >
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required={decision === "revise"}
                  />
                </Field>
              </form>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}