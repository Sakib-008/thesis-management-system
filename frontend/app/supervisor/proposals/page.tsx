"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Td } from "@/components/ui/Table";
import { ProposalDetails } from "@/components/proposals/ProposalDetails";
import { apiGet, errorMessage } from "@/lib/apiClient";
import { timeAgo } from "@/lib/format";
import { STATUS_BADGE, STATUS_LABEL } from "@/lib/proposalStatus";
import { Proposal } from "@/lib/types";

export default function SupervisorProposalsPage() {
  const [items, setItems] = useState<Proposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Proposal | null>(null);

  useEffect(() => {
    apiGet<Proposal[]>("/api/v1/proposals")
      .then(setItems)
      .catch((e) => { setError(errorMessage(e)); setItems([]); });
  }, []);

  return (
    <>
      <PageHeader
         title="Proposals"
         description="The thesis proposals of the students assigned to you. The coordinator reviews and approves them."
      />
      {error && <Alert>{error}</Alert>}

      <Card>
        <Table
          headers={["Student", "Proposal", "Fields", "Submitted", "Status", ""]}
          loading={items === null}
          emptyText={
             items !== null && items.length === 0
               ? "No proposals yet. You will see the proposals of students once they are assigned to you."
               : undefined
          }
        >
          {(items ?? []).map((p) => (
             <tr key={p.id} className="hover:bg-ink/[0.02]">
               <Td className="font-medium">{p.student?.full_name ?? "Unknown"}</Td>
               <Td className="max-w-[260px] truncate">{p.title || "Untitled"}</Td>
               <Td>
                 <div className="flex flex-wrap gap-1.5">
                    {p.fields.map((f) => <Badge key={f.id} tone="brand">{f.name}</Badge>)}
                 </div>
               </Td>
               <Td className="text-subtle">{p.submitted_at ? timeAgo(p.submitted_at) : "-"}</Td>
               <Td><Badge tone={STATUS_BADGE[p.status]}>{STATUS_LABEL[p.status]}</Badge></Td>
               <Td className="text-right">
                 <Button size="sm" variant="secondary" onClick={() => setOpen(p)}>View</Button>
               </Td>
             </tr>
          ))}
        </Table>
      </Card>

      <Modal
        open={open !== null}
        size="lg"
        title="Thesis proposal"
        onClose={() => setOpen(null)}
        footer={<Button variant="secondary" onClick={() => setOpen(null)}>Close</Button>}
      >
        {open && (
          <div className="space-y-5">
             <div>
               <div className="font-semibold">{open.title || "Untitled"}</div>
               <div className="mt-1 text-xs text-subtle">
                 {open.student?.full_name} · version {open.version_count}
               </div>
             </div>



                 <ProposalDetails proposal={open} />
               </div>
             )}
           </Modal>
         </>
    );
}
