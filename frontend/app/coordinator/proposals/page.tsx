"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DecisionToggle, Decision } from "@/components/ui/DecisionToggle";
import { Field, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Td } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { DuplicatePanel } from "@/components/duplicates/DuplicatePanel";
import { ProposalDetails } from "@/components/proposals/ProposalDetails";
import { RecommendationPanel } from "@/components/recommendations/RecommendationPanel";
import { apiGet, apiPost, errorMessage } from "@/lib/apiClient";
import { timeAgo } from "@/lib/format";
import { awaitingReview, STATUS_BADGE, STATUS_LABEL } from "@/lib/proposalStatus";
import { DuplicateFlag, Proposal } from "@/lib/types";

type Filter = "review" | "duplicates" | "revision" | "approved" | "all";

export default function CoordinatorProposalsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Proposal[] | null>(null);
  const [flags, setFlags] = useState<Record<number, DuplicateFlag>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("review");
  const [open, setOpen] = useState<Proposal | null>(null);
  const [decision, setDecision] = useState<Decision>("approve");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (): Promise<Proposal[]> => {
    try {
      const [list, pending] = await Promise.all([
        apiGet<Proposal[]>("/api/v1/proposals"),
        apiGet<DuplicateFlag[]>("/api/v1/duplicates/pending"),
      ]);
      setItems(list);
      setFlags(Object.fromEntries(pending.map((f) => [f.proposal_id, f])));
      setLoadError(null);
      return list;
    } catch (e) {
      setLoadError(errorMessage(e));
      setItems([]);
      return [];
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // After something changes inside the dialog: reload the lists and the proposal being viewed.
  const refreshOpen = useCallback(async () => {
    const list = await load();
    setOpen((current) => (current ? list.find((p) => p.id === current.id) ?? null : null));
  }, [load]);

  const matches = (f: Filter, p: Proposal) => {
    switch (f) {
      case "review": return awaitingReview(p.status);
      case "duplicates": return flags[p.id] !== undefined;
      case "revision": return p.status === "revision_required";
      case "approved": return p.status === "approved";
      default: return true;
    }
  };

  const all = items ?? [];
  const visible = all.filter((p) => matches(filter, p));
  const count = (f: Filter) => all.filter((p) => matches(f, p)).length;

  function openReview(p: Proposal) {
    setOpen(p);
    setDecision("approve");
    setComment("");
  }

  async function markUnderReview() {
    if (!open) return;
    setBusy(true);
    try {
      setOpen(await apiPost<Proposal>(`/api/v1/proposals/${open.id}/start-review`));
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitReview(e: FormEvent) {
    e.preventDefault();
    if (!open) return;
    setBusy(true);
    try {
      await apiPost(`/api/v1/proposals/${open.id}/review`, {
        decision: decision === "approve" ? "approved" : "revision_required",
        comment,
      });
      toast.success(decision === "approve" ? "Proposal approved" : "Revision requested");
      setOpen(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Proposals"
        description="Review every submitted proposal. Approved proposals move on to supervisor allocation."
      />
      {loadError && <Alert>{loadError}</Alert>}

      <Tabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { id: "review", label: "Needs review", count: count("review") },
          { id: "duplicates", label: "Possible duplicates", count: count("duplicates") },
          { id: "revision", label: "Revision required", count: count("revision") },
          { id: "approved", label: "Approved", count: count("approved") },
          { id: "all", label: "All", count: all.length },
        ]}
      />

      <Card>
        <Table
          headers={["Student", "Proposal", "Fields", "Submitted", "Version", "Status", ""]}
          loading={items === null}
          emptyText={items !== null && visible.length === 0 ? "No proposals in this view." : undefined}
        >
          {visible.map((p) => (
            <tr key={p.id} className="hover:bg-ink/[0.02]">
              <Td className="font-medium">{p.student?.full_name ?? "Unknown"}</Td>
              <Td className="max-w-[260px]">
                <div className="truncate">{p.title || "Untitled"}</div>
                {flags[p.id] && (
                  <div className="mt-1">
                    <Badge tone={flags[p.id].level === "high" ? "danger" : "warning"}>
                      {flags[p.id].level === "high" ? "Likely" : "Possible"} duplicate ·{" "}
                      {Math.round(flags[p.id].similarity)}%
                    </Badge>
                  </div>
                )}
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1.5">
                  {p.fields.map((f) => <Badge key={f.id} tone="brand">{f.name}</Badge>)}
                </div>
              </Td>
              <Td className="text-subtle">{p.submitted_at ? timeAgo(p.submitted_at) : "-"}</Td>
              <Td className="text-subtle">v{p.version_count}</Td>
              <Td><Badge tone={STATUS_BADGE[p.status]}>{STATUS_LABEL[p.status]}</Badge></Td>
              <Td className="text-right">
                <Button size="sm" variant={awaitingReview(p.status) ? "primary" : "secondary"}
                  onClick={() => openReview(p)}>
                  {awaitingReview(p.status) ? "Review" : "View"}
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal
        open={open !== null}
        size="lg"
        title="Review proposal"
        onClose={() => setOpen(null)}
        footer={
          open && awaitingReview(open.status) ? (
            <>
              <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              {open.status !== "under_review" && (
                <Button variant="secondary" loading={busy} onClick={markUnderReview}>Mark under review</Button>
              )}
              <Button type="submit" form="review-form" loading={busy}>Submit review</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setOpen(null)}>Close</Button>
          )
        }
      >
        {open && (
          <div className="space-y-5">
            <div>
              <div className="font-semibold">{open.title || "Untitled"}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-subtle">
                {open.student?.full_name} · version {open.version_count}
                <Badge tone={STATUS_BADGE[open.status]}>{STATUS_LABEL[open.status]}</Badge>
              </div>
            </div>

            {open.latest_review && (
              <div className="rounded-lg bg-ink/5 p-3 text-sm">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">
                  Earlier decision (version {open.latest_review.version_no})
                </div>
                <p className="whitespace-pre-line">{open.latest_review.comment || "No comment."}</p>
              </div>
            )}

            <ProposalDetails proposal={open} />

            <DuplicatePanel proposal={open} awaiting={awaitingReview(open.status)} onChanged={refreshOpen} />

            <RecommendationPanel proposalId={open.id} />

            {awaitingReview(open.status) && (
              <form id="review-form" className="space-y-4 border-t border-line pt-4" onSubmit={submitReview}>
                <DecisionToggle value={decision} onChange={setDecision} />
                <Field
                  label="Comment for the student"
                  hint={decision === "revise" ? "Required: say what needs to change." : "Optional."}
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