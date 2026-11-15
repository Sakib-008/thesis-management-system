"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPut, errorMessage } from "@/lib/apiClient";
import { CriteriaSet } from "@/lib/types";

interface Row {
  id?: number;
  name: string;
  description: string;
  weight: string;
  is_active: boolean;
}

const toRows = (set: CriteriaSet): Row[] => set.criteria.map((c) => ({ ...c, weight: String(c.weight) }));

export function CriteriaCard() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<CriteriaSet>("/api/v1/evaluation/criteria")
      .then((set) => setRows(toRows(set)))
      .catch((e) => setLoadError(errorMessage(e)));
  }, []);

  const total = (rows ?? []).filter((r) => r.is_active).reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
  const rounded = Math.round(total * 100) / 100;
  const complete = (rows ?? []).every((r) => r.name.trim().length >= 3 && Number(r.weight) > 0);
  const valid = rows !== null && rows.length > 0 && complete && Math.abs(rounded - 100) < 0.01;

  const change = (i: number, patch: Partial<Row>) =>
    setRows((current) => (current ?? []).map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    if (!rows) return;
    setSaving(true);
    try {
      const body = { criteria: rows.map((r) => ({ ...r, weight: Number(r.weight) })) };
      setRows(toRows(await apiPut<CriteriaSet>("/api/v1/evaluation/criteria", body)));
      toast.success("Criteria saved. Evaluations already made keep the criteria they were made with.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="h-fit">
      <CardHeader
        title="Evaluation criteria"
        description="What a thesis is marked on and how much each part counts. Active weights must total 100."
      />
      {loadError && <div className="p-5"><Alert>{loadError}</Alert></div>}
      {!rows && !loadError && <Spinner className="mx-auto my-10 h-6 w-6" />}
      {rows && (
        <CardContent className="space-y-4">
          {rows.map((r, i) => (
            <div key={r.id ?? `new-${i}`} className="space-y-2 rounded-lg border border-line p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_90px]">
                <Input
                  value={r.name}
                  maxLength={150}
                  placeholder="Name of the criterion"
                  aria-label="Name of the criterion"
                  onChange={(e) => change(i, { name: e.target.value })}
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={r.weight}
                  aria-label="Weight in percent"
                  onChange={(e) => change(i, { weight: e.target.value })}
                />
              </div>
              <Input
                value={r.description}
                maxLength={500}
                placeholder="What the evaluator looks for (optional)"
                aria-label="Description"
                onChange={(e) => change(i, { description: e.target.value })}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={r.is_active}
                    onChange={(e) => change(i, { is_active: e.target.checked })}
                  />
                  Active
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:bg-danger/10"
                  aria-label="Remove criterion"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setRows([...rows, { name: "", description: "", weight: "", is_active: true }])}
          >
            <Plus className="h-4 w-4" />Add a criterion
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <Badge tone={Math.abs(rounded - 100) < 0.01 ? "success" : "warning"}>
              Active weights add up to {rounded}
            </Badge>
            <Button size="sm" loading={saving} disabled={!valid} onClick={save}>Save criteria</Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
