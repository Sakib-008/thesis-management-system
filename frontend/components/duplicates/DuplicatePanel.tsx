"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, GitCompare } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge, Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Form";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPost, errorMessage } from "@/lib/apiClient";
import { STATUS_LABEL } from "@/lib/proposalStatus";
import { DuplicateMatch, Proposal } from "@/lib/types";

const LEVEL: Record<string, { label: string; tone: Tone }> = {
  high: { label: "Likely duplicate", tone: "danger" },
  possible: { label: "Possible duplicate", tone: "warning" },
};

const DECISION: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Needs your decision", tone: "info" },
  dismissed: { label: "Not a duplicate", tone: "neutral" },
  confirmed: { label: "Confirmed duplicate", tone: "danger" },
};

const DEFAULT_NOTE =
  "Your idea is very similar to an existing proposal. Please change its focus or scope and resubmit.";

function Column({ heading, proposal }: { heading: string; proposal: Proposal }) {
  const objectives = proposal.objectives.split("\n").map((line) => line.trim()).filter(Boolean);
  return (
    <div className="min-w-0 space-y-3 rounded-lg border border-line p-3 text-sm">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-subtle">{heading}</div>
        <div className="mt-1 font-medium">{proposal.title}</div>
        <div className="text-xs text-subtle">
          {proposal.student?.full_name} · {STATUS_LABEL[proposal.status]}
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold">Abstract</div>
        <p className="whitespace-pre-line text-subtle">{proposal.abstract}</p>
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold">Objectives</div>
        <ul className="list-disc space-y-0.5 pl-5 text-subtle">
          {objectives.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {proposal.fields.map((f) => <Badge key={f.id} tone="brand">{f.name}</Badge>)}
      </div>
    </div>
  );
}

// For coordinators: proposals that look too similar to this one, a side-by-side comparison, and the decision.
export function DuplicatePanel({ proposal, awaiting, onChanged }: {
  proposal: Proposal;
  awaiting: boolean; // is the proposal still waiting for a review decision?
  onChanged: () => void;
}) {
  const toast = useToast();
  const [items, setItems] = useState<DuplicateMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<number | null>(null); // the match whose comparison is open
  const [revising, setRevising] = useState<number | null>(null); // the match whose revision form is open
  const [note, setNote] = useState(DEFAULT_NOTE);
  const base = `/api/v1/proposals/${proposal.id}/duplicates`;

  const load = useCallback(async () => {
    try {
      setItems(await apiGet<DuplicateMatch[]>(base));
    } catch (e) {
      setError(errorMessage(e));
      setItems([]);
    }
  }, [base]);

  useEffect(() => {
    setItems(null);
    setError(null);
    setShown(null);
    setRevising(null);
    load();
  }, [load]);

  async function runCheck() {
    setBusy(true);
    setError(null);
    try {
      setItems(await apiPost<DuplicateMatch[]>(`${base}/check`));
      toast.success("Duplicate check finished");
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: number, decision: "dismissed" | "confirmed") {
    setBusy(true);
    try {
      const comment = decision === "confirmed" ? note : "";
      setItems(await apiPost<DuplicateMatch[]>(`${base}/${id}/decision`, { decision, comment }));
      toast.success(decision === "confirmed" ? "Revision requested" : "Marked as not a duplicate");
      setRevising(null);
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <Copy className="h-4 w-4 text-brand" />Duplicate check
        </div>
        <Button size="sm" variant="secondary" loading={busy && revising === null} onClick={runCheck}>
          Run check
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}
      {items === null && <Spinner className="mx-auto my-4 h-6 w-6" />}
      {items !== null && items.length === 0 && !error && (
        <p className="text-sm text-subtle">
          No similar proposals found. The check runs by itself when a proposal is submitted.
        </p>
      )}

      {(items ?? []).map((m) => (
        <div key={m.id} className="space-y-3 rounded-lg border border-line p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={LEVEL[m.level].tone}>{LEVEL[m.level].label}</Badge>
                <Badge tone={DECISION[m.decision].tone}>{DECISION[m.decision].label}</Badge>
              </div>
              <div className="mt-2 font-medium">{m.matched.title}</div>
              <div className="text-xs text-subtle">
                {m.matched.student?.full_name} · {m.method === "title" ? "Same title" : "Similar content"}
              </div>
            </div>
            <div className="w-28 text-right">
              <div className="text-2xl font-semibold">{Math.round(m.similarity)}%</div>
              <ProgressBar value={m.similarity} max={100} />
            </div>
          </div>

          <Button size="sm" variant="secondary" onClick={() => setShown(shown === m.id ? null : m.id)}>
            <GitCompare className="h-3.5 w-3.5" />{shown === m.id ? "Hide comparison" : "Compare"}
          </Button>

          {shown === m.id && (
            <div className="grid gap-3 md:grid-cols-2">
              <Column heading="This proposal" proposal={proposal} />
              <Column heading="Existing proposal" proposal={m.matched} />
            </div>
          )}

          {m.decision === "pending" && awaiting && revising !== m.id && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" loading={busy} onClick={() => decide(m.id, "dismissed")}>
                Not a duplicate
              </Button>
              <Button size="sm" onClick={() => { setNote(DEFAULT_NOTE); setRevising(m.id); }}>
                Request revision: duplicate
              </Button>
            </div>
          )}

          {revising === m.id && (
            <div className="space-y-3 rounded-lg bg-ink/5 p-3">
              <Field label="Message to the student" hint="The student sees this message, not the other proposal.">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <div className="flex gap-2">
                <Button size="sm" loading={busy} disabled={!note.trim()} onClick={() => decide(m.id, "confirmed")}>
                  Send revision request
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setRevising(null)}>Cancel</Button>
              </div>
            </div>
          )}

          {m.decision !== "pending" && m.decision_note && (
            <p className="text-xs text-subtle">Note: {m.decision_note}</p>
          )}
        </div>
      ))}
    </div>
  );
}