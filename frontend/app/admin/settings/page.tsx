"use client";
import { useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Field, Input, Select } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useToast } from "@/components/ui/Toast";
import { EVALUATION } from "@/lib/mock/thesisDemo";
const DEFAULT_WEIGHTS = { field: 40, semantic: 40, workload: 20 };
type Weights = typeof DEFAULT_WEIGHTS;
const WEIGHT_FIELDS: { key: keyof Weights; label: string; hint: string }[] = [
  { key: "field", label: "Research field match", hint: "Overlap between proposal fields and supervisor fields" },
  {
    key: "semantic",
    label: "Expertise similarity",
    hint: "How close the proposal text is to the supervisor's expertise",
  },
  { key: "workload", label: "Availability", hint: "Free supervision capacity" },
];
interface Criterion { id: number; name: string; max: number }
export default function SettingsPage() {
  const toast = useToast();
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [topN, setTopN] = useState("5");
  const [criteria, setCriteria] = useState<Criterion[]>(
    EVALUATION.criteria.map((c, i) => ({ id: i, name: c.name, max: c.max })),
  );
  const weightSum = weights.field + weights.semantic + weights.workload;
  const criteriaTotal = criteria.reduce((sum, c) => sum + c.max, 0);
  function setWeight(key: keyof Weights, raw: string) {
    const value = Math.min(100, Math.max(0, Math.round(Number(raw) || 0)));
    setWeights((w) => ({ ...w, [key]: value }));
  }
  function updateCriterion(id: number, change: Partial<Criterion>) {
    setCriteria((list) => list.map((c) => (c.id === id ? { ...c, ...change } : c)));
  }
  return (
    <>
      <PageHeader title="System settings" description="Tune how supervisor recommendations and grading work." />
      <DemoBanner>
        These controls are a preview. Changes are not saved yet; they become real when the AI engine and
        evaluation backend are built.
      </DemoBanner>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-fit">
          <CardHeader
            title="AI recommendation weights"
            description="How much each factor counts. Must add up to 100."
          />
          <CardContent className="space-y-5">
            {WEIGHT_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">{f.label}</div>
                                        <div className="text-xs text-subtle">{f.hint}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      compact
                      type="number"
                      min={0}
                      max={100}
                      className="w-20"
                      value={weights[f.key]}
                      onChange={(e) => setWeight(f.key, e.target.value)}
                    />
                    <span className="text-sm text-subtle">%</span>
                  </div>
                </div>
                <ProgressBar value={weights[f.key]} max={100} />
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <div className="flex items-center gap-2 text-sm">
                Total
                <Badge tone={weightSum === 100 ? "success" : "danger"}>{weightSum}%</Badge>
                {weightSum !== 100 && <span className="text-xs text-danger">Must be exactly 100%</span>}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setWeights(DEFAULT_WEIGHTS)}>
                  <RotateCcw className="h-3.5 w-3.5" />Reset
                </Button>
                <Button
                  size="sm"
                  disabled={weightSum !== 100}
                  onClick={() => toast.success("Weights saved (demo: not saved yet)")}
                >
                  Save weights
                </Button>
              </div>
            </div>
            <div className="border-t border-line pt-4">
              <Field label="Supervisors shown per proposal" hint="How many recommendations the AI lists.">
                <Select className="w-32" value={topN} onChange={(e) => setTopN(e.target.value)}>
                  {["3", "5", "10"].map((n) => <option key={n}>{n}</option>)}
                </Select>
              </Field>
            </div>
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader
            title="Evaluation criteria"
            description="What a thesis is graded on. Marks must add up to 100."
          />
          <CardContent className="space-y-3">
            {criteria.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <Input
                  value={c.name}
                  onChange={(e) => updateCriterion(c.id, { name: e.target.value })}
                  aria-label="Criterion name"
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="w-20"
                  value={c.max}
                  onChange={(e) => updateCriterion(c.id, { max: Math.max(0, Number(e.target.value) || 0) })}
                  aria-label="Maximum marks"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-8 px-0 text-danger hover:bg-danger/10"
                  aria-label="Remove criterion"
                  onClick={() => setCriteria((list) => list.filter((x) => x.id !== c.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
                            size="sm"
              onClick={() => setCriteria((list) => [...list, { id: Date.now(), name: "", max: 0 }])}
            >
              <Plus className="h-4 w-4" />Add criterion
            </Button>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <div className="flex items-center gap-2 text-sm">
                Total marks
                <Badge tone={criteriaTotal === 100 ? "success" : "danger"}>{criteriaTotal}</Badge>
                {criteriaTotal !== 100 && <span className="text-xs text-danger">Must be exactly 100</span>}
              </div>
              <Button
                size="sm"
                disabled={criteriaTotal !== 100 || criteria.some((c) => !c.name.trim())}
                onClick={() => toast.success("Criteria saved (demo: not saved yet)")}
              >
                Save criteria
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}