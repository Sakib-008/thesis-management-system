"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DuplicateSettingsCard } from "@/components/duplicates/DuplicateSettingsCard";
import { CriteriaCard } from "@/components/evaluation/CriteriaCard";
import { GradingCard } from "@/components/evaluation/GradingCard";
import { ReportSettingsCard } from "@/components/reports/ReportSettingsCard";
import { Field, Input, Select } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPut, errorMessage } from "@/lib/apiClient";
import { RecommendationSettings } from "@/lib/types";

const DEFAULTS: RecommendationSettings = {
  weight_field: 40, weight_semantic: 40, weight_availability: 20,
  top_n: 5, min_score: 30, cos_lo: 0.1, cos_hi: 0.7,
};

type WeightKey = "weight_field" | "weight_semantic" | "weight_availability";

const WEIGHT_FIELDS: { key: WeightKey; label: string; hint: string }[] = [
  {
    key: "weight_field",
    label: "Research field match",
    hint: "Overlap between proposal fields and supervisor fields",
  },
  {
    key: "weight_semantic",
    label: "Expertise similarity",
    hint: "How close the proposal text is to the supervisor's expertise",
  },
  { key: "weight_availability", label: "Availability", hint: "Free supervision capacity" },
];

export default function SettingsPage() {
  const toast = useToast();
  const [cfg, setCfg] = useState<RecommendationSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<RecommendationSettings>("/api/v1/settings/recommendation")
      .then(setCfg)
      .catch((e) => setLoadError(errorMessage(e)));
  }, []);

  function setNumber(key: keyof RecommendationSettings, raw: string, whole: boolean) {
    const n = Number(raw) || 0;
    setCfg((c) => (c ? { ...c, [key]: whole ? Math.max(0, Math.round(n)) : n } : c));
  }

  async function save() {
    if (!cfg) return;
    setSaving(true);
    try {
      setCfg(await apiPut<RecommendationSettings>("/api/v1/settings/recommendation", cfg));
      toast.success("Settings saved. They apply the next time recommendations are generated.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const weightSum = cfg ? cfg.weight_field + cfg.weight_semantic + cfg.weight_availability : 0;
  const rangeOk = cfg ? cfg.cos_lo < cfg.cos_hi : false;

  return (
    <>
      <PageHeader title="System settings" description="Tune how supervisor recommendations and grading work." />
      {loadError && <Alert>{loadError}</Alert>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-fit">
          <CardHeader
            title="AI recommendation"
            description="Weights, list length and the minimum score. Saved settings are used for new recommendations."
          />
          {!cfg ? (
            <Spinner className="mx-auto my-10 h-6 w-6" />
          ) : (
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
                        value={cfg[f.key]}
                        onChange={(e) => setNumber(f.key, e.target.value, true)}
                      />
                      <span className="text-sm text-subtle">%</span>
                    </div>
                  </div>
                  <ProgressBar value={cfg[f.key]} max={100} />
                </div>
              ))}

              <div className="flex items-center gap-2 border-t border-line pt-4 text-sm">
                Total
                <Badge tone={weightSum === 100 ? "success" : "danger"}>{weightSum}%</Badge>
                {weightSum !== 100 && <span className="text-xs text-danger">Must be exactly 100%</span>}
              </div>

              <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                <Field label="Supervisors shown" hint="How many recommendations are listed.">
                  <Select
                    value={cfg.top_n}
                    onChange={(e) => setNumber("top_n", e.target.value, true)}
                  >
                    {[3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                  </Select>
                </Field>
                <Field label="Minimum match score (%)" hint="Below this, a supervisor is not used for allocation.">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={cfg.min_score}
                    onChange={(e) => setNumber("min_score", e.target.value, true)}
                  />
                </Field>
                <Field label="Cosine range: lower" hint="Cosine at or below this scores 0.">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    max={1}
                    value={cfg.cos_lo}
                    onChange={(e) => setNumber("cos_lo", e.target.value, false)}
                  />
                </Field>
                <Field label="Cosine range: upper" hint="Cosine at or above this scores 100.">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    max={1}
                    value={cfg.cos_hi}
                    onChange={(e) => setNumber("cos_hi", e.target.value, false)}
                  />
                </Field>
              </div>
              {!rangeOk && <p className="text-xs text-danger">The lower cosine value must be below the upper one.</p>}

              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <Button variant="secondary" size="sm" onClick={() => setCfg(DEFAULTS)}>
                  <RotateCcw className="h-3.5 w-3.5" />Reset to defaults
                </Button>
                <Button size="sm" loading={saving} disabled={weightSum !== 100 || !rangeOk} onClick={save}>
                  Save settings
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        <CriteriaCard />
        <GradingCard />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <DuplicateSettingsCard />
        <ReportSettingsCard />
      </div>
    </>
  );
}
