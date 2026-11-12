import { Tone } from "@/components/ui/Badge";
import { MeetingStatus, Rating, ReportStatus } from "./types";
export const MEETING_LABEL: Record<MeetingStatus, string> = {
  requested: "Requested",
  scheduled: "Scheduled",
  completed: "Held",
  declined: "Declined",
  cancelled: "Cancelled",
};
export const MEETING_TONE: Record<MeetingStatus, Tone> = {
  requested: "warning",
  scheduled: "info",
  completed: "success",
  declined: "danger",
  cancelled: "neutral",
};
export const REPORT_LABEL: Record<ReportStatus, string> = {
  draft: "Draft",
  submitted: "Waiting for signature",
  returned: "Returned to the student",
  signed: "Signed",
};
export const REPORT_TONE: Record<ReportStatus, Tone> = {
  draft: "neutral",
  submitted: "info",
  returned: "warning",
  signed: "success",
};
export const RATING_LABEL: Record<Rating, string> = {
  poor: "Poor",
  average: "Average",
  good: "Good",
  excellent: "Excellent",
};
// The same limits as the server. They keep a report on one page of the printed sheet.
export const MAX_A = 1200;
export const MAX_B = 1800;
export const MAX_ITEM = 180;
export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
export const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
const pad = (n: number) => String(n).padStart(2, "0");
// An ISO date as the two values a date field and a time field need, in the person's own time zone.
export function toDateTimeInputs(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
export const fromDateTimeInputs = (date: string, time: string) => new Date(`${date}T${time}`).toISOString();