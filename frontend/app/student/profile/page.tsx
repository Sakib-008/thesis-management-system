"use client";

import { FormEvent, useEffect, useState } from "react";
import { BadgeCheck, Clock, Info } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiGet, apiPut, errorMessage } from "@/lib/apiClient";
import { NamedRef, Program, Student } from "@/lib/types";

export default function StudentProfilePage() {
  const toast = useToast();
  const [departments, setDepartments] = useState<NamedRef[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [form, setForm] = useState({ department_id: "", program_id: "", batch: "", cgpa: "" });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  function fill(s: Student) {
    setStudent(s);
    setForm({
      department_id: String(s.department.id),
      program_id: String(s.program.id),
      batch: s.batch,
      cgpa: String(s.cgpa),
    });
  }

  useEffect(() => {
    (async () => {
      try {
        const [d, p] = await Promise.all([
          apiGet<NamedRef[]>("/api/v1/departments"),
          apiGet<Program[]>("/api/v1/programs"),
        ]);
        setDepartments(d);
        setPrograms(p);
        try {
          fill(await apiGet<Student>("/api/v1/students/me"));
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await apiPut<Student>("/api/v1/students/me", {
        department_id: Number(form.department_id),
        program_id: Number(form.program_id),
        batch: form.batch,
        cgpa: Number(form.cgpa),
      });
      fill(result);
      toast.success("Profile saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const programOptions = programs.filter((p) => String(p.department_id) === form.department_id);

  if (!ready) return <Spinner className="mt-20 h-8 w-8" />;

  return (
    <>
      <PageHeader title="My profile" description="Your academic details. Supervisor allocation uses your verified CGPA." />
      {loadError && <Alert>{loadError}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Academic details" />
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
              <Field label="Department">
                <Select value={form.department_id} required
                  onChange={(e) => setForm({ ...form, department_id: e.target.value, program_id: "" })}>
                  <option value="">Select…</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </Field>
              <Field label="Program">
                <Select value={form.program_id} required disabled={!form.department_id}
                  onChange={(e) => setForm({ ...form, program_id: e.target.value })}>
                  <option value="">Select…</option>
                  {programOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
              <Field label="Batch" hint="For example 2022">
                <Input value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} required maxLength={20} />
              </Field>
              <Field label="CGPA" hint="Between 0.00 and 4.00">
                <Input type="number" step="0.01" min={0} max={4} value={form.cgpa}
                  onChange={(e) => setForm({ ...form, cgpa: e.target.value })} required />
              </Field>
              <div className="sm:col-span-2">
                <Button type="submit" loading={saving}>Save profile</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader title="CGPA verification" />
          <CardContent className="space-y-4 text-sm">
            {!student ? (
              <p className="flex gap-2 text-subtle"><Info className="mt-0.5 h-4 w-4 shrink-0" />Save your profile to submit your CGPA for verification.</p>
            ) : student.cgpa_verified ? (
              <div className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                <div>
                  <Badge tone="success">Verified</Badge>
                  <p className="mt-2 text-subtle">A coordinator has confirmed your CGPA.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <div>
                  <Badge tone="warning">Waiting for verification</Badge>
                  <p className="mt-2 text-subtle">A coordinator will check your CGPA against official records.</p>
                </div>
              </div>
            )}
            <p className="border-t border-line pt-4 text-xs text-subtle">
              Changing your CGPA later means a coordinator has to verify it again.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}