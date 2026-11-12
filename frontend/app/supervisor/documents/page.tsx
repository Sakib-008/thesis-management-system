"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FolderOpen } from "lucide-react";
import { DownloadButton } from "@/components/supervision/DownloadButton";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { apiGet, errorMessage } from "@/lib/apiClient";
import { timeAgo } from "@/lib/format";
import { DOCUMENT_TYPE_LABEL, formatBytes } from "@/lib/supervisionUi";
import { DocumentVersionItem, ThesisDocument } from "@/lib/types";

export default function SupervisorDocumentsPage() {
  const toast = useToast();
  const [docs, setDocs] = useState<ThesisDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [versions, setVersions] = useState<DocumentVersionItem[]>([]);

  useEffect(() => {
    apiGet<ThesisDocument[]>("/api/v1/documents")
      .then(setDocs)
      .catch((e) => { setError(errorMessage(e)); setDocs([]); });
  }, []);

  async function toggle(doc: ThesisDocument) {
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

  return (
    <>
      <PageHeader
        title="Documents"
        description="The files your students have uploaded, with every version."
      />
      {error && <Alert>{error}</Alert>}
      {docs === null && <Spinner className="mt-10 h-8 w-8" />}
      {docs !== null && docs.length === 0 && !error && (
        <Card>
          <EmptyState
            icon={FolderOpen}
            title="No documents yet"
            description="Documents your students upload will appear here."
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
                  <div className="mt-1 text-xs text-subtle">
                    {d.student_names.join(", ")}
                    {d.latest && ` · ${d.latest.original_name} · ${formatBytes(d.latest.size_bytes)}`}
                    {d.latest && ` · ${timeAgo(d.latest.uploaded_at)}`}
                  </div>
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
                  <Button size="sm" variant="ghost" onClick={() => toggle(d)}>
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
    </>
  );
}