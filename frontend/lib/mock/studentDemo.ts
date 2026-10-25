// Sample data for the student dashboard. Replaced by real data in later phases.
import { MilestoneStatus } from "./shared";

export const STUDENT_THESIS = {
  title: "Deep Learning Based Traffic Sign Recognition",
  status: "In progress",
  supervisor: "Dr. A. Rahman",
  progress: 62,
};

// daysLeft: days until the deadline (negative means overdue)
export const STUDENT_MILESTONES: { title: string; progress: number; daysLeft: number; status: MilestoneStatus }[] = [
  { title: "Literature review", progress: 100, daysLeft: -21, status: "Completed" },
  { title: "Research methodology", progress: 80, daysLeft: 5, status: "In progress" },
  { title: "Implementation", progress: 50, daysLeft: 28, status: "In progress" },
  { title: "Results and analysis", progress: 20, daysLeft: 49, status: "Not started" },
  { title: "Final report", progress: 0, daysLeft: 77, status: "Not started" },
];

export const STUDENT_DEADLINES: { title: string; daysLeft: number; kind: "submission" | "meeting" }[] = [
  { title: "Submit methodology chapter", daysLeft: 5, kind: "submission" },
  { title: "Progress meeting with Dr. Rahman", daysLeft: 2, kind: "meeting" },
  { title: "Submit implementation draft", daysLeft: 28, kind: "submission" },
];

export const STUDENT_FEEDBACK = [
  { from: "Dr. A. Rahman", about: "Literature review v2", text: "Good coverage of recent work. Clarify the research gap in the last paragraph.", daysAgo: 2 },
  { from: "Dr. A. Rahman", about: "Methodology outline", text: "Explain why you chose this dataset and how you will split training and validation data.", daysAgo: 9 },
];