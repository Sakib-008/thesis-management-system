"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPut, errorMessage } from "@/lib/apiClient";
import { GradeBand } from "@/lib/types";

interface Row {
  min: string;
  grade: string;
}

const toRows = (bands: GradeBand[]): Row[] => bands.map((b) => ({ min: String(b.min), grade: b.grade }));

// What is wrong with the scale as typed, or null when it can be saved.
function findProblem(rows: Row[]): string | null {
  const mins = rows.map((r) => Number(r.min));
  const grades = rows.map((r) => r.grade.trim().toLowerCase());
  if (rows.length < 2) return "Add at least two grades.";
  if (rows.some((r) => r.grade.trim() === "" || r.min.trim() === "" || Number.isNaN(Number(r.min)))) {
    return "Fill in every row.";
  }
  if (mins.some((m) => m < 0 || m > 100)) return "A minimum must be from 0 to 100.";
  if (new Set(mins).size !== mins.length) return "Two grades start at the same score.";
  if (new Set(grades).size !== grades.length) return "Each grade can appear only once.";
  if (!mins.includes(0)) return "One grade must start at 0, so that every score earns a grade.";
  return null;
}

export function GradingCard() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<{ bands: GradeBand[] }>("/api/v1/evaluation/grading")
      .then((r) => setRows(toRows(r.bands)))
      .catch((e) => setLoadError(errorMessage(e)));
  }, []);

  const problem = rows === null ? null : findProblem(rows);

  async function save() {
    if (!rows) return;
    setSaving(true);
    try {
      const body = { bands: rows.map((r) => ({ min: Number(r.min), grade: r.grade.trim() })) };
      setRows(toRows((await apiPut<{ bands: GradeBand[] }>("/api/v1/evaluation/grading", body)).bands));
      toast.success("Grading scale saved. Published results keep the grade they were published with.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="h-fit">
      <CardHeader
        title="Grading scale"
        description="A score of at least the minimum earns the grade. The lowest grade must start at 0."
      />
      {loadError && <div className="p-5"><Alert>{loadError}</Alert></div>}
      {!rows && !loadError && <Spinner className="mx-auto my-10 h-6 w-6" />}
      {rows && (
        <CardContent className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={r.min}
                aria-label="Minimum score"
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, min: e.target.value } : x)))}
              />
              <Input
                value={r.grade}
                maxLength={5}
                aria-label="Grade"
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)))}
              />
              <Button
                size="sm"
                variant="ghost"
                className="text-danger hover:bg-danger/10"
                aria-label="Remove grade"
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setRows([...rows, { min: "", grade: "" }])}>
            <Plus className="h-4 w-4" />Add a grade
          </Button>
          {problem && <p className="text-xs text-warning">{problem}</p>}
          <div className="flex justify-end border-t border-line pt-4">
            <Button size="sm" loading={saving} disabled={problem !== null} onClick={save}>Save scale</Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
