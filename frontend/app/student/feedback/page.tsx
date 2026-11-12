"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { FeedbackNotes } from "@/components/supervision/FeedbackNotes";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPost, errorMessage } from "@/lib/apiClient";
import { FeedbackEntry } from "@/lib/types";

type Tab = "open" | "resolved" | "all";

export default function StudentFeedbackPage() {
  const toast = useToast();
  const [items, setItems] = useState<FeedbackEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("open");

  const load = useCallback(async () => {
    try {
      setItems(await apiGet<FeedbackEntry[]>("/api/v1/feedback"));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
      setItems([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function resolve(id: number) {
    try {
      await apiPost(`/api/v1/feedback/${id}/resolve`);
      toast.success("Marked as resolved");
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const all = items ?? [];
  const count = (t: Tab) => (t === "all" ? all.length : all.filter((f) => f.status === t).length);
  const visible = tab === "all" ? all : all.filter((f) => f.status === tab);

  return (
    <>
      <PageHeader
        title="Feedback"
        description={
          "Comments from your supervisor on the work you handed in. " +
          "Mark each one as resolved when you have dealt with it."
        }
      />
      {error && <Alert>{error}</Alert>}
      {items === null && <Spinner className="mt-10 h-8 w-8" />}

      {items !== null && (
        <>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "open", label: "To act on", count: count("open") },
              { id: "resolved", label: "Resolved", count: count("resolved") },
              { id: "all", label: "All", count: count("all") },
            ]}
          />
          {visible.length === 0 && (
            <Card>
              <EmptyState
                icon={MessageSquareText}
                title={tab === "open" ? "Nothing to act on" : "No feedback here"}
                description="Feedback appears when your supervisor reviews your work."
              />
            </Card>
          )}
          <div className="space-y-4">
            {visible.map((f) => (
              <Card key={f.id}>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{f.milestone_title}</h3>
                    <Link href={`/student/milestones/${f.milestone_id}/submit`}>
                      <Button size="sm" variant="secondary">Open milestone</Button>
                    </Link>
                  </div>
                  <FeedbackNotes items={[f]} onResolve={resolve} />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}