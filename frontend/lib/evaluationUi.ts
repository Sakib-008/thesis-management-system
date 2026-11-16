import { Tone } from "@/components/ui/Badge";
import { EvaluationCriterion, GradeBand } from "./types";

export const EVALUATION_LABEL = { none: "Not started", draft: "Draft", final: "Submitted" } as const;

export const EVALUATION_TONE: Record<"none" | "draft" | "final", Tone> = {
  none: "neutral",
  draft: "warning",
  final: "success",
};

// The weighted average of the scores, out of 100. A criterion with no score counts as 0 until it is filled in.
export function weightedTotal(criteria: EvaluationCriterion[], scores: Record<number, number | null>): number {
  const weights = criteria.reduce((sum, c) => sum + c.weight, 0);
  if (weights <= 0) return 0;
  const earned = criteria.reduce((sum, c) => sum + c.weight * (scores[c.id] ?? 0), 0);
  return Math.round((earned / weights) * 100) / 100;
}

// The grade for a total: the first band, from the highest, whose minimum the total reaches.
export function gradeFor(bands: GradeBand[], total: number): string {
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  return sorted.find((b) => total >= b.min)?.grade ?? sorted[sorted.length - 1]?.grade ?? "";
}

export const formatScore = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));
