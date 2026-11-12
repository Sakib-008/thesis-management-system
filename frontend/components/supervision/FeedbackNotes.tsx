import { CheckCircle2, MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { timeAgo } from "@/lib/format";
import { FeedbackEntry } from "@/lib/types";

// The supervisor's comments on a submission. A student can mark an open comment as resolved.
export function FeedbackNotes({ items, onResolve }: {
  items: FeedbackEntry[];
  onResolve?: (id: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-3">
      {items.map((fb) => (
        <li key={fb.id} className="flex gap-3 rounded-lg bg-ink/5 p-3 text-sm">
          <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{fb.given_by_name}</span>
              <span className="text-xs text-subtle">{timeAgo(fb.created_at)}</span>
              {fb.status === "open" ? (
                <Badge tone="warning">Needs your attention</Badge>
              ) : (
                <Badge tone="success"><CheckCircle2 className="mr-1 h-3 w-3" />Resolved</Badge>
              )}
            </div>
            <p className="mt-1 whitespace-pre-line text-subtle">{fb.content}</p>
            {fb.status === "open" && onResolve && (
              <Button size="sm" variant="secondary" className="mt-2" onClick={() => onResolve(fb.id)}>
                Mark as resolved
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}