"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { RecommendationCards } from "@/components/recommendations/RecommendationCards";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { apiGet, errorMessage } from "@/lib/apiClient";
import { Recommendation } from "@/lib/types";

export default function RecommendationsPage() {
  const params = useParams<{ id: string }>();
  const [items, setItems] = useState<Recommendation[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Recommendation[]>(`/api/v1/proposals/${params.id}/recommendations`)
      .then(setItems)
      .catch((e) => {
        setMessage(errorMessage(e));
        setItems([]);
      });
  }, [params.id]);

  return (
    <>
      <PageHeader
        title="AI supervisor recommendations"
        description="How the system ranked supervisors for your proposal, and why. Read-only: you do not choose."
      />

      <div
        className={
          "mb-6 flex items-start gap-2 rounded-lg border border-line bg-surface " +
          "px-3 py-2.5 text-sm text-subtle"
        }
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          The AI only recommends. The thesis coordinator makes the final assignment, and can choose differently.
          Scores combine research-field match, expertise similarity and supervisor availability.
        </div>
      </div>

      {items === null && <Spinner className="mt-10 h-8 w-8" />}
      {message && (
        <div className="rounded-lg border border-line bg-surface p-6 text-center text-sm text-subtle">{message}</div>
      )}
      {items !== null && items.length === 0 && !message && (
        <div className="rounded-lg border border-line bg-surface p-6 text-center text-sm text-subtle">
          No recommendations have been generated for this proposal yet.
        </div>
      )}
      {items !== null && items.length > 0 && <RecommendationCards items={items} />}
    </>
  );
}