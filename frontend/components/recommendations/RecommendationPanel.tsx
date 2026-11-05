"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { RecommendationCards } from "@/components/recommendations/RecommendationCards";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPost, errorMessage } from "@/lib/apiClient";
import { timeAgo } from "@/lib/format";
import { Recommendation } from "@/lib/types";

// For coordinators: shows the stored AI recommendations of a proposal and lets them generate or refresh them.
export function RecommendationPanel({ proposalId }: { proposalId: number }) {
  const toast = useToast();
  const [items, setItems] = useState<Recommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await apiGet<Recommendation[]>(`/api/v1/proposals/${proposalId}/recommendations`));
    } catch (e) {
      setError(errorMessage(e));
      setItems([]);
    }
  }, [proposalId]);

  useEffect(() => {
    setItems(null);
    setError(null);
    load();
  }, [load]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      setItems(await apiPost<Recommendation[]>(`/api/v1/proposals/${proposalId}/recommendations`));
      toast.success("Recommendations updated");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const hasItems = items !== null && items.length > 0;

  return (
    <div className="space-y-3 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 text-brand" />AI supervisor recommendations
        </div>
        <Button size="sm" variant={hasItems ? "secondary" : "primary"} loading={busy} onClick={generate}>
          {hasItems ? <><RefreshCw className="h-3.5 w-3.5" />Refresh</> : "Generate"}
        </Button>
      </div>

      {busy && (
        <p className="text-xs text-subtle">The first run downloads the AI model and can take a minute.</p>
      )}
      {error && <Alert>{error}</Alert>}
      {items === null && <Spinner className="mx-auto my-6 h-6 w-6" />}
      {items !== null && items.length === 0 && !error && (
        <p className="text-sm text-subtle">Not generated yet. Press Generate to rank the supervisors.</p>
      )}
      {hasItems && (
        <>
          <RecommendationCards items={items} />
          <p className="text-xs text-subtle">Generated {timeAgo(items[0].generated_at)}.</p>
        </>
      )}
    </div>
  );
}