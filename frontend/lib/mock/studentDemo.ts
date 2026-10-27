// Sample data for the student dashboard, taken from the shared thesis data so every screen agrees.
import { FEEDBACK_THREADS, MILESTONES, PROPOSAL } from "./thesisDemo";

export const STUDENT_THESIS = {
  title: PROPOSAL.title,
  status: "In progress",
  supervisor: "Dr. A. Rahman",
  progress: 62,
};

export const STUDENT_MILESTONES = MILESTONES;

export const STUDENT_DEADLINES: { title: string; daysLeft: number; kind: "submission" | "meeting" }[] = [
  { title: "Submit methodology chapter", daysLeft: 5, kind: "submission" },
  { title: "Progress meeting with Dr. Rahman", daysLeft: 2, kind: "meeting" },
  { title: "Submit implementation draft", daysLeft: 28, kind: "submission" },
];

export const STUDENT_FEEDBACK = FEEDBACK_THREADS.slice(0, 2).map((t) => ({
  from: t.from,
  about: t.submission,
  text: t.points[0],
  daysAgo: t.daysAgo,
}));