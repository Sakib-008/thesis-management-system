"use client";

import { FormEvent, useState } from "react";
import { Download, FileText, Upload } from "lucide-react";
import { Badge, Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { FilePicker } from "@/components/ui/FilePicker";
import { Field, Select } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Td } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { daysAgoLabel } from "@/lib/format";
import { DOCUMENTS } from "@/lib/mock/thesisDemo";

const TYPES = ["Proposal", "Literature review", "Progress report", "Thesis draft", "Final thesis", "Presentation", "Supporting document"];
const STATUS_TONE: Record<string, Tone> = { Approved: "success", "Under review": "info", Submitted: "brand" };

export default function DocumentsPage() {
  const toast = useToast();
  const [docs, setDocs] = useState(DOCUMENTS);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(TYPES[3]);
  const [file, setFile] = useState<File | null>(null);

  function upload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    const sameName = docs.filter((d) => d.name === file.name).length;
    setDocs([{ id: Date.now(), name: file.name, type, version: sameName + 1, daysAgo: 0, status: "Submitted" }, ...docs]);
    toast.success(`${file.name} uploaded (demo: not saved yet)`);
    setOpen(false);
    setFile(null);
  }

  return (
    <>
      <PageHeader
        title="Documents"
        description="Everything you have uploaded for your thesis, with versions. Only you and your supervisor can see these."
        actions={<Button onClick={() => setOpen(true)}><Upload className="h-4 w-4" />Upload document</Button>}
      />
      <DemoBanner />

      <Card>
        <Table headers={["Document", "Type", "Version", "Uploaded", "Status", ""]}>
          {docs.map((d) => (
            <tr key={d.id} className="hover:bg-ink/[0.02]">
              <Td>
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-subtle" /><span className="font-medium">{d.name}</span>
                </div>
              </Td>
              <Td className="text-subtle">{d.type}</Td>
              <Td><Badge>v{d.version}</Badge></Td>
              <Td className="text-subtle">{daysAgoLabel(d.daysAgo)}</Td>
              <Td><Badge tone={STATUS_TONE[d.status] ?? "neutral"}>{d.status}</Badge></Td>
              <Td className="text-right">
                <Button variant="ghost" size="sm" onClick={() => toast.success("Download is a demo for now")}>
                  <Download className="h-3.5 w-3.5" />Download
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal open={open} title="Upload document" onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="upload-form" disabled={!file}>Upload</Button>
          </>
        }>
        <form id="upload-form" className="space-y-4" onSubmit={upload}>
          <Field label="Document type">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <div>
            <div className="mb-1.5 text-sm font-medium">File</div>
            <FilePicker accept=".pdf,.doc,.docx,.ppt,.pptx" onChange={setFile} />
            <p className="mt-1.5 text-xs text-subtle">Uploading a file with the same name creates a new version.</p>
          </div>
        </form>
      </Modal>
    </>
  );
}