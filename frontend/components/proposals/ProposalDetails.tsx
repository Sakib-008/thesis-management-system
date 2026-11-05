import { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Proposal } from "@/lib/types";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
     <div>
       <h3 className="mb-1.5 text-sm font-semibold">{title}</h3>
       <div className="whitespace-pre-line text-sm text-subtle">{children}</div>
     </div>
  );
}

// The full text of a proposal. Used by the student, coordinator and supervisor screens.
export function ProposalDetails({ proposal }: { proposal: Proposal }) {
  const objectives = proposal.objectives.split("\n").map((line) => line.trim()).filter(Boolean);
  return (
     <div className="space-y-5">
       <Section title="Abstract">{proposal.abstract || "Not written yet."}</Section>
       <Section title="Problem statement">{proposal.problem_statement || "Not written yet."}</Section>
       <Section title="Objectives">
         {objectives.length === 0 ? "Not written yet." : (
           <ul className="list-disc space-y-1 pl-5">
              {objectives.map((item) => <li key={item}>{item}</li>)}
           </ul>
         )}
       </Section>
       <Section title="Methodology">{proposal.methodology || "Not written yet."}</Section>
       {proposal.expected_outcome && <Section title="Expected outcome">{proposal.expected_outcome}</Section>}
       {proposal.references_text && <Section title="References">{proposal.references_text}</Section>}
       <div className="flex flex-wrap gap-2 border-t border-line pt-4">
         {proposal.fields.map((f) => <Badge key={f.id} tone="brand">{f.name}</Badge>)}
         {proposal.keywords.map((k) => <Badge key={k}>{k}</Badge>)}
       </div>
     </div>
  );
}
