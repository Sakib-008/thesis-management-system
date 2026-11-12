"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FolderOpen, Upload } from "lucide-react";
import { DownloadButton } from "@/components/supervision/DownloadButton";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilePicker } from "@/components/ui/FilePicker";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { apiGet, errorMessage } from "@/lib/apiClient";
import { timeAgo } from "@/lib/format";
import { ACCEPT_FILES, DOCUMENT_TYPE_LABEL, formatBytes } from "@/lib/supervisionUi";
import { apiUpload } from "@/lib/upload";
import { DocumentTypeValue, DocumentVersionItem, ThesisDocument } from "@/lib/types";

type Dialog = { kind: "new" } | { kind: "version"; doc: ThesisDocument } | null;

export default function StudentDocumentsPage() {
  const toast = useToast();
  const [docs, setDocs] = useState<ThesisDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [form, setForm] = useState({ title: "", type: "report" as DocumentTypeValue, note: "" });
  const [file, setFile] = useState<File | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [versions, setVersions] = useState<DocumentVersionItem[]>([]);

  const load = useCallback(async () => {
    try {
      setDocs(await apiGet<ThesisDocument[]>("/api/v1/documents"));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
      setDocs([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openDialog(next: Dialog) {
    setForm({ title: "", type: "report", note: "" });
    setFile(null);
    setPickerKey((k) => k + 1);
    setDialog(next);
  }

  async function showVersions(doc: ThesisDocument) {
    if (openId === doc.id) {
      setOpenId(null);
      return;
    }
    try {
      setVersions(await apiGet<DocumentVersionItem[]>(`/api/v1/documents/${doc.id}/versions`));
      setOpenId(doc.id);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!dialog || !file) return;
    const data = new FormData();
    data.append("note", form.note);
    data.append("file", file);
    setBusy(true);
    try {
      if (dialog.kind === "new") {
        data.append("title", form.title);
        data.append("type", form.type);
        await apiUpload("/api/v1/documents", data);
        toast.success("Document uploaded");
      } else {
        await apiUpload(`/api/v1/documents/${dialog.doc.id}/versions`, data);
        toast.success("New version uploaded");
        setOpenId(null);
      }
      setDialog(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Documents"
        description="Your thesis files. Upload a new version whenever you change one, and nothing is overwritten."
        actions={
          <Button onClick={() => openDialog({ kind: "new" })}>
            <Upload className="h-4 w-4" />Upload document
          </Button>
        }
      />
      {error && <Alert>{error}</Alert>}
      {docs === null && <Spinner className="mt-10 h-8 w-8" />}

      {docs !== null && docs.length === 0 && !error && (
        <Card>
          <EmptyState
            icon={FolderOpen}
            title="No documents yet"
            description="Upload a report draft, slides or other files for your supervisor."
          />
        </Card>
      )}

      <div className="space-y-4">
        {(docs ?? []).map((d) => (
          <Card key={d.id}>
            <div className="space-y-3 p-5 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{d.title}</h3>
                    <Badge tone="brand">{DOCUMENT_TYPE_LABEL[d.type]}</Badge>
                    <Badge>Version {d.latest?.version_no ?? 0}</Badge>
                  </div>
                  {d.latest && (
                    <div className="mt-1 text-xs text-subtle">
                      {d.latest.original_name} · {formatBytes(d.latest.size_bytes)} ·{" "}
                      {d.latest.uploaded_by_name} · {timeAgo(d.latest.uploaded_at)}
                    </div>
                  )}
                  {d.latest?.note && <p className="mt-1 text-subtle">{d.latest.note}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {d.latest && (
                    <DownloadButton
                      path={`/api/v1/documents/${d.id}/versions/${d.latest.version_no}/download`}
                      filename={d.latest.original_name}
                      label="Download"
                    />
                  )}
                  <Button size="sm" variant="secondary" onClick={() => openDialog({ kind: "version", doc: d })}>
                    New version
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => showVersions(d)}>
                    {openId === d.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    History ({d.version_count})
                  </Button>
                </div>
              </div>

              {openId === d.id && (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {versions.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                      <div>
                        <div className="font-medium">Version {v.version_no}</div>
                        <div className="text-xs text-subtle">
                          {v.original_name} · {formatBytes(v.size_bytes)} · {v.uploaded_by_name} ·{" "}
                          {timeAgo(v.uploaded_at)}
                        </div>
                        {v.note && <div className="text-xs text-subtle">{v.note}</div>}
                      </div>
                      <DownloadButton
                        path={`/api/v1/documents/${d.id}/versions/${v.version_no}/download`}
                        filename={v.original_name}
                        label="Download"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={dialog !== null}
        title={dialog?.kind === "version" ? `New version of ${dialog.doc.title}` : "Upload a document"}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
            <Button type="submit" form="document-form" loading={busy} disabled={!file}>Upload</Button>
          </>
        }
      >
        <form id="document-form" className="space-y-4" onSubmit={upload}>
          {dialog?.kind === "new" && (
            <>
              <Field label="Title">
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  minLength={3}
                  maxLength={200}
                />
              </Field>
              <Field label="Type">
                <Select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as DocumentTypeValue })}
                >
                  {Object.entries(DOCUMENT_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
            </>
          )}
          <div className="space-y-1.5">
            <div className="text-sm font-medium">File</div>
            <FilePicker key={pickerKey} accept={ACCEPT_FILES} onChange={setFile} />
            <p className="text-xs text-subtle">PDF, Word, PowerPoint, Excel, zip, images or text. Up to 20 MB.</p>
          </div>
          <Field label="Note" hint="Optional. What changed in this version?">
            <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </form>
      </Modal>
    </>
  );
}