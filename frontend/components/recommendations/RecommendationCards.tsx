import { Avatar } from "@/components/ui/Avatar";
import { Badge, Tone } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Recommendation } from "@/lib/types";

const FLAG: Record<string, { label: string; tone: Tone }> = {
  no_expertise_text: { label: "No expertise text", tone: "warning" },
  at_capacity: { label: "At capacity", tone: "danger" },
  below_minimum: { label: "Below minimum score", tone: "neutral" },
};

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-subtle">{label}</span>
        <span className="font-medium tabular-nums">{Math.round(value)}%</span>
      </div>
      <ProgressBar value={value} max={100} />
    </div>
  );
}

// The ranked list of supervisors with the three score parts and the reason for each.
export function RecommendationCards({ items }: { items: Recommendation[] }) {
  return (
    <div className="space-y-4">
      {items.map((r) => (
        <Card key={r.supervisor_id}>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={
                    "flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 " +
                    "text-sm font-semibold text-subtle"
                  }
                >
                  #{r.rank}
                </div>
                <Avatar name={r.supervisor_name.replace("Dr. ", "")} className="h-11 w-11" />
                <div>
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    {r.supervisor_name}
                    {r.flags.map((flag) => (
                      <Badge key={flag} tone={FLAG[flag]?.tone ?? "neutral"}>{FLAG[flag]?.label ?? flag}</Badge>
                    ))}
                  </div>
                  <div className="text-sm text-subtle">
                    {r.designation} · {r.current} / {r.capacity} students
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-semibold text-brand">{Math.round(r.score)}%</div>
                <div className="text-xs text-subtle">overall match</div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Score label="Research field match" value={r.field} />
              <Score label="Expertise similarity" value={r.semantic} />
              <Score label="Availability" value={r.availability} />
            </div>

            <div className="grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
                  Matching fields
                </div>
                {r.matched_fields.length === 0 ? (
                  <span className="text-subtle">None</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {r.matched_fields.map((f) => <Badge key={f} tone="brand">{f}</Badge>)}
                  </div>
                )}
                {r.cosine !== null && (
                  <div className="mt-3 text-xs text-subtle">
                    Text similarity (cosine): <span className="font-medium">{r.cosine.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Why this match</div>
                <p className="text-subtle">{r.summary}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}