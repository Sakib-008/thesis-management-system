import { Tone } from "@/components/ui/Badge";

export type MilestoneStatus = "Completed" | "In progress" | "Under review" | "Not started" | "Overdue";

export const STATUS_TONE: Record<MilestoneStatus, Tone> = {
  Completed: "success",
  "In progress": "brand",
  "Under review": "info",
  "Not started": "neutral",
  Overdue: "danger",
};