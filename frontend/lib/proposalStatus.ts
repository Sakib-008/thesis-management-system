import { Tone } from "@/components/ui/Badge";
import { ProposalStatusValue } from "./types";

export const STATUS_LABEL: Record<ProposalStatusValue, string> = {
  draft: "Draft",
  submitted: "Submitted",




  under_review: "Under review",
  approved: "Approved",
  revision_required: "Revision required",
  resubmitted: "Resubmitted",
};

export const STATUS_BADGE: Record<ProposalStatusValue, Tone> = {
   draft: "neutral",
   submitted: "info",
   under_review: "info",
   approved: "success",
   revision_required: "warning",
   resubmitted: "info",
};

export const TIMELINE_STEPS = ["Draft", "Submitted", "Under review", "Approved"];

// Which step of TIMELINE_STEPS is current. Approved returns 4 so that every step shows as done.
export function timelineStep(status: ProposalStatusValue): number {
  switch (status) {
    case "draft": return 0;
    case "submitted":
    case "resubmitted": return 1;
    case "under_review":
    case "revision_required": return 2;
    case "approved": return 4;
  }
}

// The student may change the proposal only in these statuses.
export const isEditable = (s: ProposalStatusValue) => s === "draft" || s === "revision_required";

// A coordinator can still give a decision in these statuses.
export const awaitingReview = (s: ProposalStatusValue) =>
  s === "submitted" || s === "resubmitted" || s === "under_review";
