import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { EVALUATION_LABEL, EVALUATION_TONE } from "@/lib/evaluationUi";
import { TeamMember } from "@/lib/types";

// Marks are given to each student separately. For a team of more than one, pick whose marks are on screen.
export function StudentSwitcher({
  team,
  current,
  onSelect,
}: {
  team: TeamMember[];
  current: number;
  onSelect: (studentId: number) => void;
}) {
  if (team.length < 2) return null;
  return (
    <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Students of this thesis">
      {team.map((m) => (
        <button
          key={m.student_id}
          type="button"
          role="tab"
          aria-selected={m.student_id === current}
          onClick={() => onSelect(m.student_id)}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition",
            m.student_id === current ? "border-brand bg-brand/5" : "border-line bg-surface hover:bg-ink/5",
          )}
        >
          <span>
            <span className="block font-medium">{m.name}</span>
            {m.student_number && <span className="block text-xs text-subtle">{m.student_number}</span>}
          </span>
          {m.published ? (
            <Badge tone="success">Published</Badge>
          ) : (
            <Badge tone={EVALUATION_TONE[m.my_status]}>{EVALUATION_LABEL[m.my_status]}</Badge>
          )}
        </button>
      ))}
    </div>
  );
}
