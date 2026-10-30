// Sample data for every coordinator screen. Replaced by real data in later phases.
import { ProposalStatus } from "./thesisDemo";
// ------------------------------------------------------------ proposal review
export interface QueueItem {
  id: number;
  student: string;
  title: string;
  fields: string[];
  daysAgo: number;
  status: ProposalStatus;
  abstract: string;
  topMatch: { name: string; score: number };
}
export const REVIEW_QUEUE: QueueItem[] = [
  {
    id: 1, student: "Mahir Chowdhury", title: "Blockchain Based Land Record Verification",
    fields: ["Distributed Systems", "Cyber Security"], daysAgo: 1, status: "Submitted",
    abstract: "Uses a blockchain ledger to make land records tamper-evident and easy to verify.",
    topMatch: { name: "Dr. K. Islam", score: 88 },
  },
  {
    id: 2, student: "Farhana Akter", title: "Real-Time Sign Language Translation",
    fields: ["Computer Vision", "Deep Learning"], daysAgo: 2, status: "Under review",
    abstract: "Translates sign language video into text in real time on ordinary hardware.",
    topMatch: { name: "Dr. A. Rahman", score: 90 },
  },
  {
    id: 3, student: "Imran Hossain", title: "Phishing Website Detection Using Deep Learning",
    fields: ["Cyber Security", "Deep Learning"], daysAgo: 4, status: "Submitted",
    abstract: "Trains a deep model on page structure and URL features to flag phishing sites.",
    topMatch: { name: "Dr. K. Islam", score: 84 },
  },
  {
    id: 4, student: "Tasnim Rahman", title: "Smart Irrigation Using IoT and Machine Learning",
    fields: ["IoT", "Machine Learning"], daysAgo: 6, status: "Under review",
    abstract: "Predicts crop water needs from soil sensors and weather data to cut water use.",
    topMatch: { name: "Dr. M. Karim", score: 81 },
  },
  {
    id: 5, student: "Arif Mahmud", title: "Fake News Detection in Bangla Using NLP",
    fields: ["Natural Language Processing"], daysAgo: 7, status: "Submitted",
    abstract: "Builds a classifier for misleading Bangla news articles using transformer models.",
    topMatch: { name: "Dr. S. Chowdhury", score: 79 },
  },
  {
    id: 6, student: "Lamia Sultana", title: "Energy-Efficient Routing in Wireless Sensor Networks",
    fields: ["Computer Networks", "IoT"], daysAgo: 8, status: "Under review",
    abstract: "Designs a routing protocol that extends network lifetime on battery-powered nodes.",
    topMatch: { name: "Dr. T. Ahmed", score: 76 },
  },
  {
    id: 7, student: "Rafi Ahmed", title: "Automated Code Review Using Language Models",
    fields: ["Software Engineering", "Machine Learning"], daysAgo: 9, status: "Submitted",
    abstract: "Evaluates language models as assistants that comment on pull requests.",
    topMatch: { name: "Dr. S. Chowdhury", score: 73 },
  },
  {
    id: 8, student: "Mim Akter", title: "Student Dropout Prediction Using Data Mining",
    fields: ["Data Science"], daysAgo: 10, status: "Under review",
    abstract: "Finds early warning signs of dropout from enrolment and attendance records.",
    topMatch: { name: "Dr. M. Karim", score: 71 },
  },
  {
    id: 9, student: "Jahid Hasan", title: "Chatbot for University Admission Queries",
    fields: ["Natural Language Processing"], daysAgo: 12, status: "Revision required",
    abstract: "A retrieval-based chatbot that answers common admission questions.",
    topMatch: { name: "Dr. S. Chowdhury", score: 69 },
  },
  {
    id: 10, student: "Rahim Hasan", title: "Deep Learning Based Traffic Sign Recognition",
    fields: ["Deep Learning", "Computer Vision"], daysAgo: 60, status: "Approved",
    abstract: "Compares CNN architectures for traffic sign classification in poor conditions.",
    topMatch: { name: "Dr. A. Rahman", score: 91 },
  },
  {
    id: 11, student: "Nusrat Jahan", title: "Bangla Sentiment Analysis Using Transformers",
    fields: ["Natural Language Processing", "Deep Learning"], daysAgo: 75, status: "Approved",
    abstract: "Fine-tunes transformer models for sentiment classification of Bangla text.",
    topMatch: { name: "Dr. A. Rahman", score: 86 },
  },
  ];
const awaiting = (s: ProposalStatus) => s === "Submitted" || s === "Under review";
const pending = REVIEW_QUEUE.filter((p) => awaiting(p.status));
// -------------------------------------------------------------- allocation run
export const PENDING_ALLOCATION = [
  { student: "Sadman Hossain", title: "Predictive Maintenance Using Vibration Sensors" },
  { student: "Nabila Karim", title: "Explainable AI for Loan Approval Decisions" },
  { student: "Tahmid Alam", title: "Secure Messaging With Post-Quantum Cryptography" },
  { student: "Zarin Tasnim", title: "Plant Disease Detection From Leaf Images" },
  { student: "Fahim Reza", title: "Voice Assistant for Visually Impaired Users" },
];
// Note: no CGPA and no rank anywhere in the result. Those stay inside the allocation service.
export const ALLOCATION_RESULT = {
  matched: [
    {
      student: "Sadman Hossain", title: "Predictive Maintenance Using Vibration Sensors",
      supervisor: "Dr. M. Karim", score: 84,
    },
    {
      student: "Nabila Karim", title: "Explainable AI for Loan Approval Decisions",
      supervisor: "Dr. S. Chowdhury", score: 82,
    },
    {
      student: "Tahmid Alam", title: "Secure Messaging With Post-Quantum Cryptography",
      supervisor: "Dr. K. Islam", score: 90,
    },
    {
      student: "Zarin Tasnim", title: "Plant Disease Detection From Leaf Images",
      supervisor: "Dr. A. Rahman", score: 87,
    },
  ],
  unmatched: [
    {
      student: "Fahim Reza",
      title: "Voice Assistant for Visually Impaired Users",
      reason: "Every well-matched supervisor is already at capacity.",
    },
  ],
};
export const RUN_HISTORY = [
  { id: 3, daysAgo: 40, matched: 18, unmatched: 2, status: "Completed with exceptions" },
  { id: 2, daysAgo: 55, matched: 12, unmatched: 0, status: "Completed" },
  { id: 1, daysAgo: 70, matched: 9, unmatched: 1, status: "Completed with exceptions" },
];
// ------------------------------------------------------------------ assignments
export interface AssignmentRow {
  id: number;
  student: string;
  title: string;
  supervisor: string;
  method: "Merit allocation" | "Manual override";
  daysAgo: number;
}
export const ASSIGNMENTS: AssignmentRow[] = [
  { id: 1, student: "Rahim Hasan", title: "Deep Learning Based Traffic Sign Recognition",
    supervisor: "Dr. A. Rahman", method: "Merit allocation", daysAgo: 52 },
  { id: 2, student: "Nusrat Jahan", title: "Bangla Sentiment Analysis Using Transformers",
    supervisor: "Dr. A. Rahman", method: "Merit allocation", daysAgo: 52 },
  { id: 3, student: "Tanvir Ahmed", title: "Anomaly Detection in IoT Sensor Networks",
    supervisor: "Dr. M. Karim", method: "Merit allocation", daysAgo: 52 },
  { id: 4, student: "Sadia Islam", title: "Federated Learning for Medical Imaging",
    supervisor: "Dr. S. Chowdhury", method: "Manual override", daysAgo: 49 },
  { id: 5, student: "Imran Karim", title: "Graph Neural Networks for Fraud Detection",
    supervisor: "Dr. K. Islam", method: "Merit allocation", daysAgo: 40 },
  { id: 6, student: "Farzana Yasmin", title: "Low-Resource Machine Translation for Bangla",
    supervisor: "Dr. S. Chowdhury", method: "Merit allocation", daysAgo: 40 },
];
export const UNASSIGNED = [
  { id: 101, student: "Fahim Reza", title: "Voice Assistant for Visually Impaired Users" },
];
export const ASSIGNABLE_SUPERVISORS = [
  { name: "Dr. A. Rahman", designation: "Professor", load: 3, capacity: 5 },
  { name: "Dr. K. Islam", designation: "Professor", load: 4, capacity: 5 },
  { name: "Dr. S. Chowdhury", designation: "Associate Professor", load: 4, capacity: 4 },
  { name: "Dr. M. Karim", designation: "Assistant Professor", load: 2, capacity: 3 },
  { name: "Dr. T. Ahmed", designation: "Lecturer", load: 1, capacity: 2 },
];
// ----------------------------------------------------------------------- reports
export const THESES_BY_DEPARTMENT = [
  { name: "CSE", value: 38 },
  { name: "EEE", value: 21 },
  { name: "BBA", value: 15 },
  { name: "Civil", value: 9 },
];
export const COMPLETIONS_BY_MONTH = [
  { month: "May", completed: 3 },
  { month: "Jun", completed: 5 },
  { month: "Jul", completed: 4 },
  { month: "Aug", completed: 7 },
  { month: "Sep", completed: 6 },
  { month: "Oct", completed: 9 },
];
export const ASSIGNMENT_METHOD = [
  { name: "Merit allocation", value: 31, color: "#6366f1" },
  { name: "Manual override", value: 7, color: "#f59e0b" },
];
export const REPORT_KPIS = { avgCompletionDays: 142, completionRate: 78, overdueTheses: 3, activeTheses: 23 };
// -------------------------------------------------------- used by the dashboard
export const COORDINATOR_PIPELINE = {
  pendingProposals: pending.length,
  awaitingAssignment: PENDING_ALLOCATION.length,
  activeTheses: REPORT_KPIS.activeTheses,
  overdueTheses: REPORT_KPIS.overdueTheses,
};
export const PROPOSALS_BY_FIELD = [
  { name: "Machine Learning", value: 9, color: "#6366f1" },
  { name: "Computer Vision", value: 6, color: "#0ea5e9" },
  { name: "NLP", value: 5, color: "#10b981" },
  { name: "IoT", value: 4, color: "#f59e0b" },
  { name: "Cyber Security", value: 3, color: "#ef4444" },
];
export const PROPOSAL_QUEUE = pending
  .slice()
  .sort((a, b) => a.daysAgo - b.daysAgo)
  .slice(0, 4)
  .map((p) => ({ student: p.student, title: p.title, field: p.fields[0], daysAgo: p.daysAgo }));