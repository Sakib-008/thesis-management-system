// One shared set of sample data for the whole thesis lifecycle, so the student and supervisor screens
// describe the same thesis. Each backend phase later replaces its part with real data.
import { Tone } from "@/components/ui/Badge";
import { MilestoneStatus } from "./shared";

// ------------------------------------------------------------------ proposal
export type ProposalStatus = "Draft" | "Submitted" | "Under review" | "Revision required" | "Approved";

export const PROPOSAL_STATUS_TONE: Record<ProposalStatus, Tone> = {
  Draft: "neutral",
  Submitted: "info",
  "Under review": "info",
  "Revision required": "warning",
  Approved: "success",
};

export const PROPOSAL_STEPS = ["Draft", "Submitted", "Under review", "Approved"];

// Which step of PROPOSAL_STEPS is "current". Approved returns 4 so every step shows as done.
export function proposalStep(status: ProposalStatus): number {
  switch (status) {
    case "Draft": return 0;
    case "Submitted": return 1;
    case "Under review":
    case "Revision required": return 2;
    case "Approved": return 4;
  }
}

export const PROPOSAL = {
  id: 1,
  title: "Deep Learning Based Traffic Sign Recognition",
  status: "Approved" as ProposalStatus,
  abstract:
    "Road sign recognition is a key component of driver assistance systems. This thesis studies convolutional neural " +
    "networks for classifying traffic signs under difficult conditions such as poor lighting, occlusion and motion blur, " +
    "and compares them with classical feature-based approaches.",
  problemStatement:
    "Existing systems lose accuracy in low light and when signs are partly hidden. There is limited comparison of " +
    "lightweight models that could run on embedded hardware in vehicles.",
  objectives: [
    "Build a CNN classifier for traffic signs and benchmark it on a public dataset.",
    "Evaluate robustness under lighting changes, occlusion and blur.",
    "Compare accuracy and inference time against a classical baseline.",
  ],
  methodology:
    "Train and compare several CNN architectures on the GTSRB dataset using data augmentation. Evaluate with accuracy, " +
    "precision, recall and inference time, using a fixed train/validation/test split.",
  expectedOutcome: "A trained model with at least 97% test accuracy and a documented robustness analysis.",
  fields: ["Deep Learning", "Computer Vision"],
  keywords: ["CNN", "Traffic signs", "Image classification", "Data augmentation"],
  references: "Stallkamp et al. (2012), The German Traffic Sign Recognition Benchmark.",
  reviewerComment: "Approved. Strong problem statement. Keep the dataset scope realistic for one semester.",
};

export const PROPOSAL_VERSIONS = [
  { version: 2, note: "Revised after review comments: narrowed scope to classification", daysAgo: 52 },
  { version: 1, note: "Initial submission", daysAgo: 60 },
];

// ------------------------------------------------------------ AI recommendations
export const RECOMMENDATIONS = [
  {
    rank: 1, name: "Dr. A. Rahman", designation: "Professor", overall: 91, field: 95, semantic: 90, workload: 80,
    matchedFields: ["Deep Learning", "Computer Vision"], keywords: ["CNN", "Object detection"], load: "3 / 5", assigned: true,
    reason: "Strong research-field and expertise similarity with the proposal, and available supervision capacity.",
  },
  {
    rank: 2, name: "Dr. S. Chowdhury", designation: "Associate Professor", overall: 86, field: 88, semantic: 87, workload: 75,
    matchedFields: ["Computer Vision"], keywords: ["Image classification"], load: "3 / 4", assigned: false,
    reason: "Good field match and related expertise in image classification; slightly less capacity left.",
  },
  {
    rank: 3, name: "Dr. M. Karim", designation: "Assistant Professor", overall: 68, field: 60, semantic: 70, workload: 90,
    matchedFields: ["Machine Learning"], keywords: ["Pattern recognition"], load: "1 / 3", assigned: false,
    reason: "Related interest in machine learning but no direct computer vision expertise; plenty of capacity.",
  },
];

// ----------------------------------------------------------------- milestones
export const MILESTONES: {
  id: number; title: string; description: string; progress: number; daysLeft: number;
  status: MilestoneStatus; submissions: number;
}[] = [
  { id: 1, title: "Literature review", description: "Survey recent work on traffic sign detection and classification and identify the research gap.", progress: 100, daysLeft: -21, status: "Completed", submissions: 2 },
  { id: 2, title: "Research methodology", description: "Describe the dataset, model architectures and the evaluation protocol.", progress: 80, daysLeft: 5, status: "In progress", submissions: 1 },
  { id: 3, title: "Implementation", description: "Implement the models, the training pipeline and the baseline comparison.", progress: 50, daysLeft: 28, status: "In progress", submissions: 0 },
  { id: 4, title: "Results and analysis", description: "Run the experiments and analyse accuracy, robustness and inference time.", progress: 0, daysLeft: 49, status: "Not started", submissions: 0 },
  { id: 5, title: "Final report", description: "Write and submit the complete thesis document.", progress: 0, daysLeft: 77, status: "Not started", submissions: 0 },
];

export const MILESTONE_SUBMISSIONS: Record<number, { version: number; daysAgo: number; status: string; note: string }[]> = {
  1: [
    { version: 2, daysAgo: 25, status: "Approved", note: "Added recent references and clarified the research gap." },
    { version: 1, daysAgo: 38, status: "Revision required", note: "First complete draft." },
  ],
  2: [{ version: 1, daysAgo: 6, status: "Under review", note: "First draft of the methodology chapter." }],
};

// ------------------------------------------------------------------ documents
export const DOCUMENTS = [
  { id: 1, name: "Thesis proposal.pdf", type: "Proposal", version: 2, daysAgo: 52, status: "Approved" },
  { id: 2, name: "Literature review v2.pdf", type: "Literature review", version: 2, daysAgo: 25, status: "Approved" },
  { id: 3, name: "Progress report 1.pdf", type: "Progress report", version: 1, daysAgo: 14, status: "Approved" },
  { id: 4, name: "Methodology draft.docx", type: "Thesis draft", version: 1, daysAgo: 6, status: "Under review" },
];

// ------------------------------------------------------------------- meetings
export const UPCOMING_MEETINGS = [
  { id: 1, topic: "Progress meeting", inDays: 2, time: "10:30 AM", status: "Confirmed", agenda: "Review the methodology draft." },
  { id: 2, topic: "Implementation planning", inDays: 14, time: "2:00 PM", status: "Requested", agenda: "Plan the training pipeline." },
];

export const PAST_MEETINGS = [
  {
    id: 3, topic: "Literature review feedback", daysAgo: 30,
    agenda: "Discuss feedback on the literature review.",
    discussion: "Went through the comments on version 1 and agreed how to strengthen the comparison with previous work.",
    decisions: ["Add papers from the last three years", "Rewrite the research gap paragraph"],
    actions: ["Submit literature review v2", "Share the updated reference list"],
  },
  {
    id: 4, topic: "Kick-off meeting", daysAgo: 55,
    agenda: "Define the scope of the thesis.",
    discussion: "Discussed dataset options and which traffic sign classes to include.",
    decisions: ["Use the GTSRB dataset", "Focus on classification before detection"],
    actions: ["Start the literature review", "Draft the milestone plan"],
  },
];

// ------------------------------------------------------------------- feedback
export type Outcome = "Approved" | "Revision required" | "Under review";
export const OUTCOME_TONE: Record<Outcome, Tone> = { Approved: "success", "Revision required": "warning", "Under review": "info" };

export const FEEDBACK_THREADS: {
  id: number; submission: string; outcome: Outcome; daysAgo: number; from: string; points: string[];
}[] = [
  { id: 1, submission: "Methodology outline", outcome: "Revision required", daysAgo: 9, from: "Dr. A. Rahman",
    points: ["Explain why you chose this dataset.", "Describe how training and validation data will be split.", "Add the evaluation metrics you will report."] },
  { id: 2, submission: "Literature review v2", outcome: "Approved", daysAgo: 24, from: "Dr. A. Rahman",
    points: ["Good coverage of recent work.", "Clarify the research gap in the last paragraph."] },
  { id: 3, submission: "Literature review v1", outcome: "Revision required", daysAgo: 38, from: "Dr. A. Rahman",
    points: ["Add recent references from the last three years.", "Improve the comparison of previous work."] },
];

// ----------------------------------------------------------------- evaluation
export const EVALUATION = {
  evaluator: "Dr. A. Rahman",
  comment: "A well-structured thesis with solid experiments. The robustness analysis could go deeper.",
  criteria: [
    { name: "Problem definition", max: 10, score: 9 },
    { name: "Literature review", max: 15, score: 13 },
    { name: "Methodology", max: 15, score: 12 },
    { name: "Implementation", max: 20, score: 17 },
    { name: "Results", max: 15, score: 12 },
    { name: "Documentation", max: 10, score: 8 },
    { name: "Presentation / viva", max: 15, score: 13 },
  ],
};

export function gradeFor(total: number): string {
  if (total >= 80) return "A+";
  if (total >= 70) return "A";
  if (total >= 60) return "B";
  if (total >= 50) return "C";
  return "F";
}