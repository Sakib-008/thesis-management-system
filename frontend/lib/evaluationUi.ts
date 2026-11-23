import { Tone } from "@/components/ui/Badge";
import { GradeBand } from "./types";

export const EVALUATION_LABEL = { none: "Not started", draft: "Draft", final: "Submitted" } as const;

export const EVALUATION_TONE: Record<"none" | "draft" | "final", Tone> = {
  none: "neutral",
  draft: "warning",
  final: "success",
};

// The total is the sum of the marks. A criterion with no mark counts as 0 until it is filled in.
export function marksTotal(scores: Record<number, number | null>): number {
  const earned = Object.values(scores).reduce<number>((sum, v) => sum + (v ?? 0), 0);
  return Math.round(earned * 100) / 100;
}

// Rows in the order their group first appears, like the defense sheet: Presentation, then Project Evaluation.
export function groupRows<T extends { category: string }>(rows: T[]): { category: string; rows: T[] }[] {
  const groups: { category: string; rows: T[] }[] = [];
  for (const row of rows) {
    const group = groups.find((g) => g.category === row.category);
    if (group) group.rows.push(row);
    else groups.push({ category: row.category, rows: [row] });
  }
  return groups;
}

// The grade for a total: the first band, from the highest, whose minimum the total reaches.
export function gradeFor(bands: GradeBand[], total: number): string {
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  return sorted.find((b) => total >= b.min)?.grade ?? sorted[sorted.length - 1]?.grade ?? "";
}

// The API address of one student's marks inside a thesis. Marks and results belong to each student.
export const studentUrl = (thesisId: number | string, studentId: number | string | null, path = "") =>
  `/api/v1/evaluation/theses/${thesisId}${path}${studentId === null ? "" : `?student_id=${studentId}`}`;

export const formatScore = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));
