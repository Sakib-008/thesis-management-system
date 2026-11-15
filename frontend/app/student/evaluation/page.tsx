"use client";
import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import { ResultPanel } from "@/components/evaluation/ResultPanel";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { apiGet, errorMessage } from "@/lib/apiClient";
import { ThesisResultView } from "@/lib/types";

export default function StudentEvaluationPage() {
  const [result, setResult] = useState<ThesisResultView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<ThesisResultView>("/api/v1/evaluation/my-result")
      .then(setResult)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <>
      <PageHeader title="Evaluation" description="Your final thesis result, criterion by criterion." />
      {error && <Alert>{error}</Alert>}
      {!result && !error && <Spinner className="mt-10 h-8 w-8" />}
      {result && !result.published && (
        <Card>
          <EmptyState
            icon={Award}
            title="Your result is not published yet"
            description={
              "After your thesis is evaluated, the coordinator publishes the result. " +
              "It will appear here."
            }
          />
        </Card>
      )}
      {result && <ResultPanel result={result} />}
    </>
  );
}
