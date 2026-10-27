import { Building2, CheckCircle2, Info } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RECOMMENDATIONS } from "@/lib/mock/thesisDemo";

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-subtle">{label}</span>
        <span className="font-medium tabular-nums">{value}%</span>
      </div>
      <ProgressBar value={value} max={100} />
    </div>
  );
}

export default function RecommendationsPage() {
  return (
    <>
      <PageHeader
        title="AI supervisor recommendations"
        description="How the system ranked supervisors for your proposal, and why. This is read-only: you do not choose a supervisor."
      />
      <DemoBanner />

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-subtle">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          The AI only recommends. The thesis coordinator makes the final assignment, and can choose differently.
          Scores combine research-field match (40%), expertise similarity (40%) and supervisor availability (20%).
        </div>
      </div>

      <div className="space-y-5">
        {RECOMMENDATIONS.map((r) => (
          <Card key={r.name}>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 text-sm font-semibold text-subtle">#{r.rank}</div>
                  <Avatar name={r.name.replace("Dr. ", "")} className="h-11 w-11" />
                  <div>
                    <div className="flex items-center gap-2 font-semibold">
                      {r.name}
                      {r.assigned && <Badge tone="success"><CheckCircle2 className="mr-1 h-3 w-3" />Assigned</Badge>}
                    </div>
                    <div className="text-sm text-subtle">{r.designation} · {r.load} students</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-semibold text-brand">{r.overall}%</div>
                  <div className="text-xs text-subtle">overall match</div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Score label="Research field match" value={r.field} />
                <Score label="Expertise similarity" value={r.semantic} />
                <Score label="Availability" value={r.workload} />
              </div>

              <div className="grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Matching fields</div>
                  <div className="flex flex-wrap gap-2">{r.matchedFields.map((f) => <Badge key={f} tone="brand">{f}</Badge>)}</div>
                  <div className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-subtle">Related keywords</div>
                  <div className="flex flex-wrap gap-2">{r.keywords.map((k) => <Badge key={k}>{k}</Badge>)}</div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Why this match</div>
                  <p className="text-subtle">{r.reason}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}