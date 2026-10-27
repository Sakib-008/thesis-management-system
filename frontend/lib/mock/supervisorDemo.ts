// Sample data for every supervisor screen. Replaced by real data in later phases.
import { MilestoneStatus } from "./shared";
import { PAST_MEETINGS, ProposalStatus } from "./thesisDemo";

// ------------------------------------------------------------------ students
export interface SupervisedStudent {
  id: number;
  name: string;
  email: string;
  program: string;
  batch: string;
  thesis: string;
  milestoneProgress: number[]; // progress (0-100) of each of the five milestones
  shift: number;               // days added to open milestone deadlines (makes some students ahead or late)
  status: MilestoneStatus;
}

const BASE_STUDENTS: SupervisedStudent[] = [
  { id: 1, name: "Rahim Hasan", email: "rahim.hasan@student.edu", program: "BSc in CSE", batch: "2022",
    thesis: "Deep Learning Based Traffic Sign Recognition", milestoneProgress: [100, 80, 50, 0, 0], shift: 0, status: "In progress" },
  { id: 2, name: "Nusrat Jahan", email: "nusrat.jahan@student.edu", program: "BSc in CSE", batch: "2022",
    thesis: "Bangla Sentiment Analysis Using Transformers", milestoneProgress: [100, 100, 100, 100, 60], shift: 7, status: "Under review" },
  { id: 3, name: "Tanvir Ahmed", email: "tanvir.ahmed@student.edu", program: "BSc in CSE", batch: "2022",
    thesis: "Anomaly Detection in IoT Sensor Networks", milestoneProgress: [100, 40, 0, 0, 0], shift: -8, status: "Overdue" },
  { id: 4, name: "Sadia Islam", email: "sadia.islam@student.edu", program: "BSc in CSE", batch: "2023",
    thesis: "Federated Learning for Medical Imaging", milestoneProgress: [100, 70, 40, 0, 0], shift: 4, status: "In progress" },
];

const TEMPLATE = [
  { title: "Literature review", days: -21 },
  { title: "Research methodology", days: 5 },
  { title: "Implementation", days: 28 },
  { title: "Results and analysis", days: 49 },
  { title: "Final report", days: 77 },
];

export interface StudentMilestone { id: number; title: string; progress: number; daysLeft: number; status: MilestoneStatus }

export function milestonesFor(s: SupervisedStudent): StudentMilestone[] {
  return TEMPLATE.map((t, i) => {
    const progress = s.milestoneProgress[i];
    const daysLeft = progress === 100 ? t.days : t.days + s.shift;
    const status: MilestoneStatus =
      progress === 100 ? "Completed" : daysLeft < 0 ? "Overdue" : progress === 0 ? "Not started" : "In progress";
    return { id: i + 1, title: t.title, progress, daysLeft, status };
  });
}

// What the dashboard and the students page show: progress and next deadline are derived from the milestones.
export const SUPERVISOR_STUDENTS = BASE_STUDENTS.map((s) => {
  const ms = milestonesFor(s);
  const open = ms.find((m) => m.status !== "Completed");
  return {
    ...s,
    progress: Math.round(ms.reduce((sum, m) => sum + m.progress, 0) / ms.length),
    nextDueDays: open ? open.daysLeft : 0,
    milestonesDone: ms.filter((m) => m.status === "Completed").length,
    milestonesTotal: ms.length,
  };
});

// ---------------------------------------------------------------- submissions
export const SUBMISSIONS_TO_REVIEW = [
  { id: 1, student: "Nusrat Jahan", milestone: "Final report", version: 1, daysAgo: 1, file: "Final thesis draft.pdf",
    note: "Complete thesis draft with results and discussion chapters." },
  { id: 2, student: "Rahim Hasan", milestone: "Research methodology", version: 1, daysAgo: 0, file: "Methodology draft.docx",
    note: "First draft of the methodology chapter. Unsure about the validation split." },
  { id: 3, student: "Sadia Islam", milestone: "Research methodology", version: 2, daysAgo: 4, file: "Methodology v2.pdf",
    note: "Revised after your comments on the aggregation strategy." },
];

export const SUPERVISOR_REVIEWS = SUBMISSIONS_TO_REVIEW.map((s) => ({
  id: s.id, student: s.student, item: `${s.milestone} v${s.version}`, daysAgo: s.daysAgo,
}));

// ------------------------------------------------------------------- proposals
export const SUPERVISOR_PROPOSALS: {
  id: number; student: string; title: string; fields: string[]; daysAgo: number; status: ProposalStatus; abstract: string;
}[] = [
  { id: 1, student: "Mahir Chowdhury", title: "Blockchain Based Land Record Verification", fields: ["Distributed Systems", "Cyber Security"], daysAgo: 1, status: "Submitted",
    abstract: "Land record fraud is common because records are held in a single registry. This thesis designs a blockchain-based verification layer and evaluates its cost and latency." },
  { id: 2, student: "Farhana Akter", title: "Real-Time Sign Language Translation", fields: ["Computer Vision", "Deep Learning"], daysAgo: 2, status: "Under review",
    abstract: "Deaf and hard-of-hearing people face communication barriers. This thesis builds a real-time model that translates sign language video into text on commodity hardware." },
  { id: 3, student: "Rahim Hasan", title: "Deep Learning Based Traffic Sign Recognition", fields: ["Deep Learning", "Computer Vision"], daysAgo: 60, status: "Approved",
    abstract: "A study of convolutional neural networks for traffic sign classification under poor lighting, occlusion and blur." },
  { id: 4, student: "Nusrat Jahan", title: "Bangla Sentiment Analysis Using Transformers", fields: ["Natural Language Processing", "Deep Learning"], daysAgo: 75, status: "Approved",
    abstract: "Fine-tuning transformer models for sentiment classification of Bangla social media text." },
  { id: 5, student: "Tanvir Ahmed", title: "Anomaly Detection in IoT Sensor Networks", fields: ["IoT", "Machine Learning"], daysAgo: 70, status: "Approved",
    abstract: "Unsupervised methods for detecting faulty sensors in low-power IoT networks." },
];

// ------------------------------------------------------------------- meetings
export const SUPERVISOR_MEETINGS = [
  { student: "Rahim Hasan", topic: "Progress meeting", inDays: 2, time: "10:30 AM" },
  { student: "Tanvir Ahmed", topic: "Overdue milestone discussion", inDays: 3, time: "2:00 PM" },
  { student: "Nusrat Jahan", topic: "Results review", inDays: 8, time: "11:00 AM" },
];

export const MEETING_REQUESTS = [
  { id: 10, student: "Sadia Islam", topic: "Implementation advice", inDays: 6, time: "3:00 PM", agenda: "Discuss options for the federated averaging step." },
];

export const SUPERVISOR_PAST_MEETINGS = PAST_MEETINGS.map((m) => ({
  id: m.id, student: "Rahim Hasan", topic: m.topic, daysAgo: m.daysAgo,
  discussion: m.discussion, decisions: m.decisions, actions: m.actions,
}));

// ---------------------------------------------------------------- evaluations
export type EvalStage = "In progress" | "Final thesis submitted" | "Evaluated";

export const EVAL_STAGES: Record<number, EvalStage> = {
  1: "In progress",
  2: "Final thesis submitted",
  3: "In progress",
  4: "In progress",
};