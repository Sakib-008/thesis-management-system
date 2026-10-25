"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost, errorMessage } from "@/lib/apiClient";
import { NamedRef } from "@/lib/types";
import { Alert } from "./Alert";
import { Button } from "./Button";
import { Card } from "./Card";
import { ConfirmDialog, TextPromptDialog } from "./dialogs";
import { PageHeader } from "./PageHeader";
import { Table, Td } from "./Table";
import { useToast } from "./Toast";

// One reusable screen for any "list of names" resource (departments, research fields).
export default function NameListManager({ title, singular, description, endpoint, deleteWarning }: {
  title: string;
  singular: string;
  description: string;
  endpoint: string;
  deleteWarning: string;
}) {
  const toast = useToast();
  const [items, setItems] = useState<NamedRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<NamedRef | null>(null);
  const [deleting, setDeleting] = useState<NamedRef | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await apiGet<NamedRef[]>(endpoint));
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

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

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add {singular}</Button>}
      />
      {loadError && <Alert>{loadError}</Alert>}

      <Card>
        <Table headers={["Name", ""]} loading={loading} emptyText={!loading && items.length === 0 ? `No ${title.toLowerCase()} yet.` : undefined}>
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-ink/[0.02]">
              <Td className="font-medium">{item.name}</Td>
              <Td className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setRenaming(item)}><Pencil className="h-3.5 w-3.5" />Rename</Button>
                  <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10" onClick={() => setDeleting(item)}>
                    <Trash2 className="h-3.5 w-3.5" />Delete
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <TextPromptDialog open={adding} title={`Add ${singular}`} label="Name" confirmLabel="Add"
        onCancel={() => setAdding(false)}
        onSubmit={(name) => { setAdding(false); run(() => apiPost(endpoint, { name }), `${title} updated`); }} />

      <TextPromptDialog open={renaming !== null} title={`Rename ${singular}`} label="New name"
        initial={renaming?.name ?? ""}
        onCancel={() => setRenaming(null)}
        onSubmit={(name) => {
          const target = renaming;
          setRenaming(null);
          if (target && name !== target.name) run(() => apiPatch(`${endpoint}/${target.id}`, { name }), "Renamed");
        }} />

      <ConfirmDialog open={deleting !== null} danger confirmLabel="Delete" title={`Delete ${singular}?`}
        message={deleting ? `"${deleting.name}" will be deleted. ${deleteWarning}` : ""}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) run(() => apiDelete(`${endpoint}/${target.id}`), "Deleted");
        }} />
    </>
  );
}