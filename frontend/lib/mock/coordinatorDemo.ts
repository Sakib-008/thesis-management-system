// Sample data for the coordinator dashboard. Replaced by real data in later phases.
export const COORDINATOR_PIPELINE = {
  pendingProposals: 8,
  awaitingAssignment: 5,
  activeTheses: 23,
  overdueTheses: 3,
};

export const PROPOSALS_BY_FIELD = [
  { name: "Machine Learning", value: 9, color: "#6366f1" },
  { name: "Computer Vision", value: 6, color: "#0ea5e9" },
  { name: "NLP", value: 5, color: "#10b981" },
  { name: "IoT", value: 4, color: "#f59e0b" },
  { name: "Cyber Security", value: 3, color: "#ef4444" },
];

export const PROPOSAL_QUEUE = [
  { student: "Mahir Chowdhury", title: "Blockchain Based Land Record Verification", field: "Distributed Systems", daysAgo: 1 },
  { student: "Farhana Akter", title: "Real-Time Sign Language Translation", field: "Computer Vision", daysAgo: 2 },
  { student: "Imran Hossain", title: "Phishing Website Detection Using Deep Learning", field: "Cyber Security", daysAgo: 4 },
  { student: "Tasnim Rahman", title: "Smart Irrigation Using IoT and Machine Learning", field: "IoT", daysAgo: 6 },
];