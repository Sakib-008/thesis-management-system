import { Tone } from "@/components/ui/Badge";
import { DocumentTypeValue, Milestone, MilestoneStatusValue } from "./types";

export const MILESTONE_LABEL: Record<MilestoneStatusValue, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Waiting for review",
  under_review: "Under review",
  revision_required: "Changes requested",
  completed: "Completed",
};

export const MILESTONE_TONE: Record<MilestoneStatusValue, Tone> = {
  not_started: "neutral",
  in_progress: "info",
  submitted: "info",
  under_review: "info",
  revision_required: "warning",
  completed: "success",
};

export const DOCUMENT_TYPE_LABEL: Record<DocumentTypeValue, string> = {
  report: "Report",
  slides: "Slides",
  literature: "Literature",
  data: "Data",
  code: "Code",
  other: "Other",
};

// The file types the server accepts. The server checks the content as well, not only the name.
export const ACCEPT_FILES = ".pdf,.docx,.pptx,.xlsx,.zip,.doc,.ppt,.png,.jpg,.jpeg,.txt,.md,.csv";

// A student can hand in work only while the milestone is in one of these states.
export const isOpenForWork = (status: MilestoneStatusValue) =>
  status === "not_started" || status === "in_progress" || status === "revision_required";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const formatDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });

export function dueText(m: Pick<Milestone, "status" | "overdue" | "days_left" | "deadline">): string {
  if (m.status === "completed") return "Completed";
  if (m.days_left === null) return formatDay(m.deadline);
  if (m.overdue) return `${Math.abs(m.days_left)} day${Math.abs(m.days_left) === 1 ? "" : "s"} late`;
  if (m.days_left === 0) return "Due today";
  return `Due in ${m.days_left} day${m.days_left === 1 ? "" : "s"}`;
}