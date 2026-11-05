"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPut, errorMessage } from "@/lib/apiClient";
import { DuplicateSettings } from "@/lib/types";

const DEFAULTS: DuplicateSettings = { high_threshold: 85, possible_threshold: 70 };

export function DuplicateSettingsCard() {
  const toast = useToast();
  const [cfg, setCfg] = useState<DuplicateSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<DuplicateSettings>("/api/v1/settings/duplicate")
      .then(setCfg)
      .catch((e) => setLoadError(errorMessage(e)));
  }, []);

  const set = (key: keyof DuplicateSettings, raw: string) =>
    setCfg((c) => (c ? { ...c, [key]: Math.max(0, Math.round(Number(raw) || 0)) } : c));

  const valid =
    cfg !== null && cfg.possible_threshold >= 1 && cfg.possible_threshold < cfg.high_threshold &&
    cfg.high_threshold <= 100;

  async function save() {
    if (!cfg) return;
    setSaving(true);
    try {
      setCfg(await apiPut<DuplicateSettings>("/api/v1/settings/duplicate", cfg));
      toast.success("Saved. The new thresholds apply the next time a check runs.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="h-fit">
      <CardHeader
        title="Duplicate check"
        description="How similar a new proposal must be to an existing one before the coordinator is warned."
      />
      {loadError && <div className="p-5"><Alert>{loadError}</Alert></div>}
      {!cfg && !loadError && <Spinner className="mx-auto my-10 h-6 w-6" />}
      {cfg && (
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Likely duplicate from (%)" hint="Same idea. Shown in red.">
              <Input type="number" min={1} max={100} value={cfg.high_threshold}
                onChange={(e) => set("high_threshold", e.target.value)} />
            </Field>
            <Field label="Possible duplicate from (%)" hint="Worth a look. Shown in amber.">
              <Input type="number" min={1} max={100} value={cfg.possible_threshold}
                onChange={(e) => set("possible_threshold", e.target.value)} />
            </Field>
          </div>
          {!valid && (
            <p className="text-xs text-danger">The possible threshold must be lower than the likely threshold.</p>
          )}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="secondary" size="sm" onClick={() => setCfg(DEFAULTS)}>
              <RotateCcw className="h-3.5 w-3.5" />Reset to defaults
            </Button>
            <Button size="sm" loading={saving} disabled={!valid} onClick={save}>Save settings</Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}