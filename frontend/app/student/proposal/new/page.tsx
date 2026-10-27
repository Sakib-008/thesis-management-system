"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { FilePicker } from "@/components/ui/FilePicker";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiGet, errorMessage } from "@/lib/apiClient";
import { NamedRef } from "@/lib/types";

export default function NewProposalPage() {
  const router = useRouter();
  const toast = useToast();
  const [fields, setFields] = useState<NamedRef[]>([]);
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", abstract: "", problem: "", objectives: "", methodology: "", outcome: "", keywords: "", references: "",
    field_ids: [] as number[],
  });

  // The research fields are real data from the backend; the rest of this screen is a demo.
  useEffect(() => {
    apiGet<NamedRef[]>("/api/v1/research-fields").then(setFields).catch((e) => setFieldsError(errorMessage(e)));
  }, []);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function toggleField(id: number) {
    setForm((f) => ({
      ...f,
      field_ids: f.field_ids.includes(id) ? f.field_ids.filter((x) => x !== id) : [...f.field_ids, id],
    }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    toast.success("Proposal submitted (demo: not saved yet)");
    router.push("/student/proposal/1");
  }

  return (
    <>
      <PageHeader title="New thesis proposal" description="Describe your idea. You do not choose a supervisor; the coordinator assigns one with AI-assisted matching." />
      <DemoBanner>Research fields come from the real system. The proposal itself is not saved yet; that arrives with the proposals backend.</DemoBanner>
      {fieldsError && <Alert>{fieldsError}</Alert>}

      <form onSubmit={submit}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader title="Proposal details" />
              <CardContent className="space-y-4">
                <Field label="Thesis title"><Input value={form.title} onChange={set("title")} required maxLength={255} /></Field>
                <Field label="Abstract"><Textarea value={form.abstract} onChange={set("abstract")} required /></Field>
                <Field label="Problem statement"><Textarea value={form.problem} onChange={set("problem")} required /></Field>
                <Field label="Objectives" hint="One objective per line"><Textarea value={form.objectives} onChange={set("objectives")} required /></Field>
                <Field label="Methodology"><Textarea value={form.methodology} onChange={set("methodology")} required /></Field>
                <Field label="Expected outcome"><Textarea value={form.outcome} onChange={set("outcome")} /></Field>
                <Field label="References"><Textarea value={form.references} onChange={set("references")} /></Field>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Research fields" description="Pick every field your thesis touches. This drives supervisor matching." />
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {fields.map((f) => {
                    const on = form.field_ids.includes(f.id);
                    return (
                      <button key={f.id} type="button" aria-pressed={on} onClick={() => toggleField(f.id)}
                        className={"rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                          (on ? "border-brand bg-brand/10 text-brand" : "border-line text-subtle hover:bg-ink/5")}>
                        {f.name}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Keywords and document" />
              <CardContent className="space-y-4">
                <Field label="Keywords" hint="Separated by commas"><Input value={form.keywords} onChange={set("keywords")} placeholder="CNN, traffic signs" /></Field>
                <div>
                  <div className="mb-1.5 text-sm font-medium">Proposal document</div>
                  <FilePicker accept=".pdf,.doc,.docx" />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button type="submit" className="flex-1">Submit proposal</Button>
              <Button variant="secondary" onClick={() => toast.success("Draft saved (demo)")}>Save draft</Button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}