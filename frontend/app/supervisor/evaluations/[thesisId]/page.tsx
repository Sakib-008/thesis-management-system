"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ResultPanel } from "@/components/evaluation/ResultPanel";
import { ScoreForm } from "@/components/evaluation/ScoreForm";
import { StudentSwitcher } from "@/components/evaluation/StudentSwitcher";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { apiGet, errorMessage } from "@/lib/apiClient";
import { studentUrl } from "@/lib/evaluationUi";
import { EvaluationDetailView } from "@/lib/types";

export default function EvaluateThesisPage() {
  const params = useParams<{ thesisId: string }>();
  const router = useRouter();
  const studentId = useSearchParams().get("student");
  const [detail, setDetail] = useState<EvaluationDetailView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDetail(await apiGet<EvaluationDetailView>(studentUrl(params.thesisId, studentId)));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [params.thesisId, studentId]);

  useEffect(() => { load(); }, [load]);

  if (error) return <Alert>{error}</Alert>;
  if (!detail) return <Spinner className="mt-20 h-8 w-8" />;

  return (
    <>
      <PageHeader
        title={detail.student_name}
        description={`${detail.student_number ? detail.student_number + " · " : ""}${detail.title}`}
        actions={
          <Link href="/supervisor/evaluations">
            <Button variant="secondary" size="sm"><ArrowLeft className="h-4 w-4" />All evaluations</Button>
          </Link>
        }
      />
      <StudentSwitcher
        team={detail.team}
        current={detail.student_id}
        onSelect={(id) => router.replace(`/supervisor/evaluations/${params.thesisId}?student=${id}`)}
      />
      <div className="space-y-6">
        <ScoreForm key={`${detail.student_id}-${detail.mine.status}-${detail.mine.id}`} detail={detail} onChanged={load} />
        <ResultPanel result={detail.result} />
      </div>
    </>
  );
}
