"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiGet, apiPost, apiPut, errorMessage } from "@/lib/apiClient";
import { isEditable } from "@/lib/proposalStatus";
import { NamedRef, Proposal } from "@/lib/types";

const EMPTY = {
   title: "", abstract: "", problem_statement: "", objectives: "", methodology: "",
   expected_outcome: "", references_text: "", keywords: "", field_ids: [] as number[],
};
type FormState = typeof EMPTY;

export default function ProposalEditorPage() {
  const router = useRouter();
  const toast = useToast();
  const [fields, setFields] = useState<NamedRef[]>([]);
  const [existing, setExisting] = useState<Proposal | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);

    useEffect(() => {
      (async () => {
        try {
          setFields(await apiGet<NamedRef[]>("/api/v1/research-fields"));
          try {
            const p = await apiGet<Proposal>("/api/v1/proposals/me");
            if (!isEditable(p.status)) {
              router.replace(`/student/proposal/${p.id}`); // already submitted: nothing to edit
              return;
            }
            setExisting(p);
            setForm({
              title: p.title, abstract: p.abstract, problem_statement: p.problem_statement,
              objectives: p.objectives, methodology: p.methodology, expected_outcome: p.expected_outcome,
              references_text: p.references_text, keywords: p.keywords.join(", "),
              field_ids: p.fields.map((f) => f.id),
            });
          } catch (e) {
            if (!(e instanceof ApiError && e.status === 404)) throw e; // 404 just means "no proposal yet"
          }
        } catch (e) {
          setLoadError(errorMessage(e));
        } finally {
          setReady(true);
        }
      })();
    }, [router]);

    const set = (key: keyof FormState) => (e: { target: { value: string } }) =>



    setForm((f) => ({ ...f, [key]: e.target.value }));

  function toggleField(id: number) {
    setForm((f) => ({
      ...f,
      field_ids: f.field_ids.includes(id) ? f.field_ids.filter((x) => x !== id) : [...f.field_ids, id],
    }));
  }

  async function save(thenSubmit: boolean) {
    setBusy(thenSubmit ? "submit" : "save");
    try {
      const payload = { ...form, keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean) };
      const saved = await apiPut<Proposal>("/api/v1/proposals/me", payload);
      setExisting(saved);
      if (thenSubmit) {
        const submitted = await apiPost<Proposal>("/api/v1/proposals/me/submit");
        toast.success("Proposal submitted for review");
        router.push(`/student/proposal/${submitted.id}`);
      } else {
        toast.success("Draft saved");
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save(true);
  }

  if (!ready) return <Spinner className="mt-20 h-8 w-8" />;

  const review = existing?.status === "revision_required" ? existing.latest_review : null;

  return (
    <>
      <PageHeader
         title={existing ? "Edit your proposal" : "New thesis proposal"}
         description="Describe your idea. You do not choose a supervisor; the coordinator assigns one."
      />
      {loadError && <Alert>{loadError}</Alert>}

      {review && (
         <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
           <MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
           <div>
             <div className="font-medium">Your coordinator asked for changes</div>
             <p className="mt-1 whitespace-pre-line text-subtle">{review.comment}</p>
           </div>
         </div>
      )}

      <form onSubmit={onSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Proposal details" />
            <CardContent className="space-y-4">
              <Field label="Thesis title">
                <Input value={form.title} onChange={set("title")} maxLength={255} />
              </Field>
              <Field label="Abstract" hint="At least 40 characters to submit.">
                <Textarea value={form.abstract} onChange={set("abstract")} />
              </Field>
              <Field label="Problem statement">
                <Textarea value={form.problem_statement} onChange={set("problem_statement")} />
              </Field>
              <Field label="Objectives" hint="One objective per line.">
                <Textarea value={form.objectives} onChange={set("objectives")} />
              </Field>
              <Field label="Methodology">
                <Textarea value={form.methodology} onChange={set("methodology")} />
              </Field>
              <Field label="Expected outcome (optional)">
                <Textarea value={form.expected_outcome} onChange={set("expected_outcome")} />
              </Field>
              <Field label="References (optional)">
                <Textarea value={form.references_text} onChange={set("references_text")} />
              </Field>
            </CardContent>
          </Card>




               <div className="space-y-6">
                 <Card>
                   <CardHeader
                      title="Research fields"
                      description="Pick every field your thesis touches (at least one)."
                   />
                   <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {fields.map((f) => {
                          const on = form.field_ids.includes(f.id);
                          return (
                             <button
                               key={f.id}
                               type="button"
                               aria-pressed={on}
                               onClick={() => toggleField(f.id)}
                               className={
                                 "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                                 (on ? "border-brand bg-brand/10 text-brand" : "border-line text-subtle hover:bg-ink/5")
                               }
                             >
                               {f.name}
                             </button>
                          );
                        })}
                      </div>
                   </CardContent>
                 </Card>

                 <Card>
                   <CardHeader title="Keywords" />
                   <CardContent>
                     <Field label="Keywords" hint="Separated by commas.">
                        <Input value={form.keywords} onChange={set("keywords")} placeholder="CNN, traffic signs" />
                     </Field>
                   </CardContent>
                 </Card>

                 <div className="flex gap-3">
                    <Button type="submit" className="flex-1" loading={busy === "submit"} disabled={busy !== null}>
                      Submit for review
                    </Button>
                    <Button variant="secondary" loading={busy === "save"} disabled={busy !== null}
                      onClick={() => save(false)}>
                      Save draft
                    </Button>
                 </div>
                 <p className="text-xs text-subtle">
                    A student profile is required first.{" "}
                    <Link href="/student/profile" className="font-medium text-brand hover:underline">Open profile</Link>
                 </p>
               </div>
             </div>
           </form>
         </>
    );
}
