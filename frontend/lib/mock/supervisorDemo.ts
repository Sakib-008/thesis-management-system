// Sample data for the supervisor dashboard. Replaced by real data in later phases.
import { MilestoneStatus } from "./shared";

export const SUPERVISOR_STUDENTS: {
  name: string; thesis: string; progress: number; status: MilestoneStatus; nextDueDays: number;
}[] = [
  { name: "Rahim Hasan", thesis: "Deep Learning Based Traffic Sign Recognition", progress: 62, status: "In progress", nextDueDays: 5 },
  { name: "Nusrat Jahan", thesis: "Bangla Sentiment Analysis Using Transformers", progress: 80, status: "Under review", nextDueDays: 12 },
  { name: "Tanvir Ahmed", thesis: "Anomaly Detection in IoT Sensor Networks", progress: 35, status: "Overdue", nextDueDays: -3 },
  { name: "Sadia Islam", thesis: "Federated Learning for Medical Imaging", progress: 48, status: "In progress", nextDueDays: 9 },
];

export const SUPERVISOR_REVIEWS = [
  { student: "Nusrat Jahan", item: "Implementation draft v1", daysAgo: 1 },
  { student: "Rahim Hasan", item: "Methodology chapter", daysAgo: 0 },
  { student: "Sadia Islam", item: "Literature review v2", daysAgo: 4 },
];

export const SUPERVISOR_MEETINGS = [
  { student: "Rahim Hasan", topic: "Progress meeting", inDays: 2, time: "10:30 AM" },
  { student: "Tanvir Ahmed", topic: "Overdue milestone discussion", inDays: 3, time: "2:00 PM" },
  { student: "Nusrat Jahan", topic: "Results review", inDays: 8, time: "11:00 AM" },
];