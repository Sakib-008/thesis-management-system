"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog, TextPromptDialog } from "@/components/ui/dialogs";
import { Field, Input, Select } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Td } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { apiDelete, apiGet, apiPatch, apiPost, errorMessage } from "@/lib/apiClient";
import { NamedRef, Program } from "@/lib/types";

export default function ProgramsPage() {
  const toast = useToast();
  const [departments, setDepartments] = useState<NamedRef[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", department_id: "" });
  const [renaming, setRenaming] = useState<Program | null>(null);
  const [deleting, setDeleting] = useState<Program | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([
        apiGet<NamedRef[]>("/api/v1/departments"),
        apiGet<Program[]>("/api/v1/programs"),
      ]);
      setDepartments(d);
      setPrograms(p);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function run(action: () => Promise<unknown>, successMessage: string) {
    try {
      await action();
      toast.success(successMessage);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  function add(e: FormEvent) {
    e.preventDefault();
    setAdding(false);
    run(() => apiPost("/api/v1/programs", { name: form.name, department_id: Number(form.department_id) }), "Program added");
    setForm({ name: "", department_id: "" });
  }

  const deptName = (id: number) => departments.find((d) => d.id === id)?.name ?? "—";

  return (
    <>
      <PageHeader
        title="Programs"
        description="Degree programs offered by each department. Students pick one on their profile."
        actions={<Button onClick={() => setAdding(true)} disabled={departments.length === 0}><Plus className="h-4 w-4" />Add program</Button>}
      />
      {loadError && <Alert>{loadError}</Alert>}
      {!loading && departments.length === 0 && <Alert tone="info">Create a department first, then you can add programs to it.</Alert>}

      <Card>
        <Table headers={["Program", "Department", ""]} loading={loading} emptyText={!loading && programs.length === 0 ? "No programs yet." : undefined}>
          {programs.map((p) => (
            <tr key={p.id} className="hover:bg-ink/[0.02]">
              <Td className="font-medium">{p.name}</Td>
              <Td><Badge tone="brand">{deptName(p.department_id)}</Badge></Td>
              <Td className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setRenaming(p)}><Pencil className="h-3.5 w-3.5" />Rename</Button>
                  <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10" onClick={() => setDeleting(p)}>
                    <Trash2 className="h-3.5 w-3.5" />Delete
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal open={adding} title="Add program" onClose={() => setAdding(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="submit" form="add-program-form">Add</Button>
          </>
        }>
        <form id="add-program-form" className="space-y-4" onSubmit={add}>
          <Field label="Department">
            <Select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} required>
              <option value="">Select…</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Program name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} placeholder="e.g. BSc in Computer Science" />
          </Field>
        </form>
      </Modal>

      <TextPromptDialog open={renaming !== null} title="Rename program" label="New name" initial={renaming?.name ?? ""}
        onCancel={() => setRenaming(null)}
        onSubmit={(name) => {
          const target = renaming;
          setRenaming(null);
          if (target && name !== target.name) run(() => apiPatch(`/api/v1/programs/${target.id}`, { name }), "Renamed");
        }} />

      <ConfirmDialog open={deleting !== null} danger confirmLabel="Delete" title="Delete program?"
        message={deleting ? `"${deleting.name}" will be deleted. This only works if no student uses it.` : ""}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) run(() => apiDelete(`/api/v1/programs/${target.id}`), "Deleted");
        }} />
    </>
  );
}