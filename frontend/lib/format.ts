export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}

const ACTION_LABELS: Record<string, string> = {
  "user.bootstrap_admin": "Created the first admin account",
  "user.create": "Created a user account",
  "user.update": "Updated a user",
  "department.create": "Added a department",
  "department.update": "Renamed a department",
  "department.delete": "Deleted a department",
  "program.create": "Added a program",
  "program.update": "Updated a program",
  "program.delete": "Deleted a program",
  "research_field.create": "Added a research field",
  "research_field.update": "Renamed a research field",
  "research_field.delete": "Deleted a research field",
  "designation.update": "Changed a designation's default capacity",
  "supervisor.update": "Updated a supervisor's designation or capacity",
  "student.verify_cgpa": "Verified a student's CGPA",
};

// Turns an audit entry like {action: "department.create", meta: {name: "CSE"}} into readable text.
export function describeAction(action: string, meta: Record<string, unknown> | null): string {
  const base = ACTION_LABELS[action] ?? action;
  if (meta && typeof meta.name === "string") return `${base}: ${meta.name}`;
  if (meta && typeof meta.role === "string") return `${base} (${meta.role})`;
  return base;
}