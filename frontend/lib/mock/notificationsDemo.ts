import { Role } from "@/lib/auth";

export interface DemoNotification { id: number; text: string; daysAgo: number; read: boolean }

// Sample notifications per role. Real notifications arrive in a later phase.
export const NOTIFICATIONS: Record<Role, DemoNotification[]> = {
  student: [
    { id: 1, text: "Dr. Rahman left feedback on Methodology outline", daysAgo: 0, read: false },
    { id: 2, text: "Deadline in 5 days: Research methodology", daysAgo: 0, read: false },
    { id: 3, text: "Your progress meeting is confirmed for 10:30 AM", daysAgo: 1, read: true },
    { id: 4, text: "Your thesis proposal was approved", daysAgo: 52, read: true },
  ],
  supervisor: [
    { id: 1, text: "Rahim Hasan submitted Methodology chapter", daysAgo: 0, read: false },
    { id: 2, text: "Nusrat Jahan requested a meeting", daysAgo: 1, read: false },
    { id: 3, text: "Tanvir Ahmed's milestone is overdue", daysAgo: 3, read: true },
  ],
  coordinator: [
    { id: 1, text: "4 new proposals are waiting for review", daysAgo: 0, read: false },
    { id: 2, text: "3 theses are overdue", daysAgo: 2, read: true },
  ],
  admin: [{ id: 1, text: "A new coordinator account was created", daysAgo: 1, read: true }],
};