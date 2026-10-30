"use client";
import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Td } from "@/components/ui/Table";
import { apiGet, errorMessage } from "@/lib/apiClient";
import { describeAction, timeAgo } from "@/lib/format";
import { AuditLogEntry } from "@/lib/types";
export default function AuditLogsPage() {
   const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState("");
  const [details, setDetails] = useState<AuditLogEntry | null>(null);
  useEffect(() => {
    apiGet<AuditLogEntry[]>("/api/v1/audit-logs?limit=100")
      .then(setLogs)
      .catch((e) => setError(errorMessage(e)));
  }, []);
  const entities = useMemo(() => Array.from(new Set((logs ?? []).map((l) => l.entity))).sort(), [logs]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (logs ?? []).filter((l) => {
      if (entity && l.entity !== entity) return false;
      if (!q) return true;
      const who = l.user?.full_name.toLowerCase() ?? "system";
      return who.includes(q) || describeAction(l.action, l.meta).toLowerCase().includes(q);
    });
  }, [logs, search, entity]);
  return (
    <>
      <PageHeader
        title="Audit log"
        description="A record of administrative actions: who did what, and when. Showing the latest 100 entries."
      />
      {error && <Alert>{error}</Alert>}
      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          className="w-72"
          placeholder="Search by person or action"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select className="w-48" value={entity} onChange={(e) => setEntity(e.target.value)}>
          <option value="">All record types</option>
          {entities.map((e) => <option key={e} value={e}>{e.replace("_", " ")}</option>)}
        </Select>
      </div>
      <Card>
        <Table
          headers={["When", "Who", "Action", "Record", ""]}
          loading={logs === null && !error}
          emptyText={logs && visible.length === 0 ? "No entries match your filters." : undefined}
        >
          {visible.map((l) => (
            <tr key={l.id} className="hover:bg-ink/[0.02]">
              <Td className="whitespace-nowrap text-subtle" title={new Date(l.timestamp).toLocaleString()}>
                {timeAgo(l.timestamp)}
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  <Avatar name={l.user?.full_name ?? "System"} className="h-7 w-7 text-[10px]" />
                  <span>{l.user?.full_name ?? "System"}</span>
                </div>
              </Td>
              <Td>{describeAction(l.action, l.meta)}</Td>
              <Td>
                <Badge>{l.entity.replace("_", " ")}{l.entity_id !== null ? ` #${l.entity_id}` : ""}</Badge>
              </Td>
              <Td className="text-right">
                {l.meta && (
                  <Button variant="ghost" size="sm" onClick={() => setDetails(l)}>
                    <Eye className="h-3.5 w-3.5" />Details
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
      <Modal open={details !== null} title="Entry details" onClose={() => setDetails(null)}>
        {details && (
          <div className="space-y-3 text-sm">
            <div>
              <div className="font-medium">{describeAction(details.action, details.meta)}</div>
              <div className="text-xs text-subtle">
                {details.user?.full_name ?? "System"} · {new Date(details.timestamp).toLocaleString()}
                              </div>
            </div>
            <pre className="max-h-64 overflow-auto rounded-lg bg-ink/5 p-3 text-xs">
              {JSON.stringify(details.meta, null, 2)}
            </pre>
          </div>
        )}
      </Modal>
    </>
  );
}
                