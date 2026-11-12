"use client";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPut, errorMessage } from "@/lib/apiClient";
import { ReportSettings } from "@/lib/types";
export function ReportSettingsCard() {
  const toast = useToast();
  const [cfg, setCfg] = useState<ReportSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    apiGet<ReportSettings>("/api/v1/settings/reports")
      .then(setCfg)
      .catch((e) => setLoadError(errorMessage(e)));
  }, []);
  const valid =
    cfg !== null && cfg.university_name.trim().length >= 2 && cfg.course_code.trim().length >= 1 &&
    cfg.sheet_title.trim().length >= 2 && cfg.due_days >= 1 && cfg.due_days <= 60;
  async function save() {
    if (!cfg) return;
    setSaving(true);
    try {
      setCfg(await apiPut<ReportSettings>("/api/v1/settings/reports", cfg));
      toast.success("Saved. New PDFs use the new wording.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
              setSaving(false);
    }
  }
  return (
    <Card className="h-fit">
      <CardHeader
        title="Weekly report sheet"
        description="The heading of the printed sheet and how long students have to write a report."
      />
      {loadError && <div className="p-5"><Alert>{loadError}</Alert></div>}
      {!cfg && !loadError && <Spinner className="mx-auto my-10 h-6 w-6" />}
      {cfg && (
        <CardContent className="space-y-4">
          <Field label="University name" hint="Printed under the department name.">
            <Input
              value={cfg.university_name}
              maxLength={120}
              onChange={(e) => setCfg({ ...cfg, university_name: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Course code" hint="For example CSE 3200.">
              <Input
                value={cfg.course_code}
                maxLength={30}
                onChange={(e) => setCfg({ ...cfg, course_code: e.target.value })}
              />
            </Field>
            <Field label="Days to write a report" hint="After the meeting is recorded.">
              <Input
                type="number"
                min={1}
                max={60}
                value={cfg.due_days}
                onChange={(e) => setCfg({ ...cfg, due_days: Math.round(Number(e.target.value)) || 0 })}
              />
            </Field>
          </div>
          <Field label="Sheet title" hint="Printed after the course code.">
            <Input
              value={cfg.sheet_title}
              maxLength={120}
              onChange={(e) => setCfg({ ...cfg, sheet_title: e.target.value })}
            />
          </Field>
          <p className="text-xs text-subtle">
            The department name on each sheet comes from the student's department.
          </p>
          <div className="flex justify-end border-t border-line pt-4">
            <Button size="sm" loading={saving} disabled={!valid} onClick={save}>Save settings</Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}