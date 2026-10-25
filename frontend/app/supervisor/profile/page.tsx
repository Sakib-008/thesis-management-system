"use client";

import { FormEvent, useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Select, Textarea } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiGet, apiPost, apiPut, errorMessage } from "@/lib/apiClient";
import { Designation, NamedRef, Supervisor } from "@/lib/types";

export default function SupervisorProfilePage() {
  const toast = useToast();
  const [departments, setDepartments] = useState<NamedRef[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [allFields, setAllFields] = useState<NamedRef[]>([]);
  const [profile, setProfile] = useState<Supervisor | null>(null);
  const [form, setForm] = useState({ department_id: "", designation_id: "", expertise: "", field_ids: [] as number[] });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  function fill(s: Supervisor) {
    setProfile(s);
    setForm({
      department_id: String(s.department.id),
      designation_id: String(s.designation.id),
      expertise: s.expertise,
      field_ids: s.fields.map((f) => f.id),
    });
  }

  useEffect(() => {
    (async () => {
      try {
        const [d, g, f] = await Promise.all([
          apiGet<NamedRef[]>("/api/v1/departments"),
          apiGet<Designation[]>("/api/v1/supervisor-designations"),
          apiGet<NamedRef[]>("/api/v1/research-fields"),
        ]);
        setDepartments(d);
        setDesignations(g);
        setAllFields(f);
        try {
          fill(await apiGet<Supervisor>("/api/v1/supervisors/me"));
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 404)) throw e; // 404 just means "no profile yet"
        }
      } catch (e) {
        setLoadError(errorMessage(e));
      } finally {
        setReady(true);
      }
    })();
  }, []);

  function toggleField(id: number) {
    setForm((f) => ({
      ...f,
      field_ids: f.field_ids.includes(id) ? f.field_ids.filter((x) => x !== id) : [...f.field_ids, id],
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const base = {
        department_id: Number(form.department_id),
        expertise: form.expertise,
        field_ids: form.field_ids,
      };
      const result = profile
        ? await apiPut<Supervisor>("/api/v1/supervisors/me", base)
        : await apiPost<Supervisor>("/api/v1/supervisors/me", { ...base, designation_id: Number(form.designation_id) });
      fill(result);
      toast.success(profile ? "Profile updated" : "Profile created");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <Spinner className="mt-20 h-8 w-8" />;

  return (
    <>
      <PageHeader title="Research profile" description="Your research fields and expertise are used to match students to you." />
      {loadError && <Alert>{loadError}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={profile ? "Edit profile" : "Create your profile"} />
          <CardContent>
            <form className="space-y-5" onSubmit={onSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Department">
                  <Select value={form.department_id} required onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                    <option value="">Select…</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                </Field>
                {!profile && (
                  <Field label="Designation" hint="You cannot change this later; an admin can.">
                    <Select value={form.designation_id} required onChange={(e) => setForm({ ...form, designation_id: e.target.value })}>
                      <option value="">Select…</option>
                      {designations.map((d) => <option key={d.id} value={d.id}>{d.name} (up to {d.default_capacity})</option>)}
                    </Select>
                  </Field>
                )}
              </div>

              <div>
                <div className="mb-2 text-sm font-medium">Research fields</div>
                <div className="flex flex-wrap gap-2">
                  {allFields.map((f) => {
                    const on = form.field_ids.includes(f.id);
                    return (
                      <button key={f.id} type="button" onClick={() => toggleField(f.id)} aria-pressed={on}
                        className={
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                          (on ? "border-brand bg-brand/10 text-brand" : "border-line text-subtle hover:bg-ink/5")
                        }>
                        {f.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Field label="Research interests, expertise and keywords" hint="Written in your own words; the AI reads this to find good matches.">
                <Textarea value={form.expertise} maxLength={2000} onChange={(e) => setForm({ ...form, expertise: e.target.value })}
                  placeholder="e.g. Convolutional neural networks, object detection, traffic sign recognition…" />
              </Field>

              <Button type="submit" loading={saving}>{profile ? "Save changes" : "Create profile"}</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader title="Supervision capacity" />
          <CardContent className="space-y-4 text-sm">
            {profile ? (
              <>
                <Badge tone="brand">{profile.designation.name}</Badge>
                <div>
                  <div className="mb-2 flex justify-between">
                    <span className="text-subtle">Students supervised</span>
                    <span className="font-medium">{profile.current_count} / {profile.capacity}</span>
                  </div>
                  <ProgressBar value={profile.current_count} max={profile.capacity} />
                </div>
                <p className="border-t border-line pt-4 text-xs text-subtle">Only an admin can change your designation or capacity.</p>
              </>
            ) : (
              <p className="text-subtle">Choose your designation to set your capacity: Professor 5, Associate 4, Assistant 3, Lecturer 2 (defaults).</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}