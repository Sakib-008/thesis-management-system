export interface NamedRef { id: number; name: string }
export interface Program { id: number; name: string; department_id: number }
export interface Designation { id: number; name: string; default_capacity: number }
export interface UserBrief { id: number; full_name: string; email: string }

export interface Student {
  id: number;
  user: UserBrief;
  department: NamedRef;
  program: NamedRef;
  batch: string;
  student_number: string | null;
  cgpa: number;
  cgpa_verified: boolean;
}

export interface Supervisor {
  id: number;
  user: UserBrief;
  department: NamedRef;
  designation: Designation;
  capacity: number;
  current_count: number;
  expertise: string;
  fields: NamedRef[];
}

export interface AuditLogEntry {
  id: number;
  action: string;
  entity: string;
  entity_id: number | null;
  meta: Record<string, unknown> | null;
  timestamp: string;
  user: UserBrief | null;
}

export type ProposalStatusValue =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_required"
  | "resubmitted";

export interface ProposalReview {
  id: number;
  decision: "approved" | "revision_required";
  reason: string;
  comment: string;
  reviewer: UserBrief | null;
  version_no: number;
  created_at: string;
}

export interface Proposal {
  id: number;
  thesis_id: number;
  title: string;
  abstract: string;
  problem_statement: string;
  objectives: string;
  methodology: string;
  expected_outcome: string;
  references_text: string;
  keywords: string[];
  status: ProposalStatusValue;
  fields: NamedRef[];
  student: UserBrief | null;
  version_count: number;
  submitted_at: string | null;
  latest_review: ProposalReview | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalVersion {
  id: number;
  version_no: number;
  created_at: string;
  content_snapshot: Record<string, unknown>;
}


export interface Recommendation {
  supervisor_id: number;
  supervisor_name: string;
  designation: string;
  department: string;
  rank: number;
  score: number;
  field: number;
  semantic: number;
  availability: number;
  cosine: number | null;
  matched_fields: string[];
  capacity: number;
  current: number;
  flags: string[];
  summary: string;
  generated_at: string;
}

export interface RecommendationSettings {
  weight_field: number;
  weight_semantic: number;
  weight_availability: number;
  top_n: number;
  min_score: number;
  cos_lo: number;
  cos_hi: number;
}


export interface DuplicateMatch {
  id: number;
  similarity: number;
  level: "high" | "possible";
  method: "embedding" | "title";
  decision: "pending" | "dismissed" | "confirmed";
  decision_note: string;
  decided_at: string | null;
  checked_at: string;
  matched: Proposal;
}

export interface DuplicateFlag {
  proposal_id: number;
  level: "high" | "possible";
  similarity: number;
}

export interface DuplicateSettings {
  high_threshold: number;
  possible_threshold: number;
}


export interface AllocationMatch {
  proposal_id: number;
  student_name: string;
  title: string;
  supervisor_id: number;
  supervisor_name: string;
  score: number;
  choice: number;
}

export interface AllocationUnmatched {
  proposal_id: number;
  student_name: string;
  title: string;
  reason: "capacity" | "no_good_match";
  message: string;
}

export interface AllocationRunSummary {
  id: number;
  run_at: string;
  completed_at: string | null;
  triggered_by_name: string;
  status: string;
  processed: number;
  matched_count: number;
  unmatched_count: number;
}

export interface AllocationRun extends AllocationRunSummary {
  matched: AllocationMatch[];
  unmatched: AllocationUnmatched[];
  skipped_unverified: string[];
}

export interface AllocationReadiness {
  waiting_total: number;
  waiting_verified: number;
  waiting_unverified: number;
  open_slots: number;
  supervisors_with_slots: number;
  last_run: AllocationRunSummary | null;
}

export interface Assignment {
  id: number;
  proposal_id: number;
  title: string;
  student_name: string;
  supervisor_id: number;
  supervisor_name: string;
  designation: string;
  method: "merit_allocation" | "manual_override";
  score: number | null;
  reason: string;
  assigned_at: string;
  run_id: number | null;
}

export interface WaitingStudent {
  proposal_id: number;
  title: string;
  student_name: string;
  cgpa_verified: boolean;
  note: string | null;
}

export interface MyAssignment {
  supervisor_name: string;
  designation: string;
  email: string;
  department: string;
  assigned_at: string;
}


export type MeetingStatus = "requested" | "scheduled" | "completed" | "declined" | "cancelled";
export type ReportStatus = "draft" | "submitted" | "returned" | "signed";
export type Rating = "poor" | "average" | "good" | "excellent";
export interface Meeting {
  id: number;
  thesis_id: number;
  proposal_id: number | null;
  proposal_title: string;
  student_names: string[];
  supervisor_name: string | null;
  meeting_date: string;
  agenda: string;
  mode: "in_person" | "online";
  location: string;
  status: MeetingStatus;
  decline_reason: string;
  discussion: string;
  decisions: string;
  next_meeting_date: string | null;
  completed_at: string | null;
  created_at: string;
  report_id: number | null;
  report_status: ReportStatus | null;
}
export interface SheetStudent {
  name: string;
  student_number: string | null;
}
export interface SheetHeader {
  department_line: string;
  university_name: string;
  course_code: string;
  sheet_title: string;
  students: SheetStudent[];
  supervisor_name: string | null;
}
export interface WeeklyReport {
  id: number;
  meeting_id: number;
  meeting_date: string; 
  status: ReportStatus;
  section_a: string;
  section_b: string;
  next_works: string[];
  rating: Rating | null;
  supervisor_comment: string;
  signed_by_name: string | null;
  signed_at: string | null;
  returned_reason: string;
  submitted_at: string | null;
  updated_at: string;
  due_at: string | null;
  overdue: boolean;
  header: SheetHeader;
}
export interface ReportTask {
  meeting_id: number;
  meeting_date: string;
  completed_at: string | null;
  due_at: string | null;
  overdue: boolean;
  report_id: number | null;
  report_status: ReportStatus | null;
}
export interface ReportOverviewRow {
  proposal_id: number;
  title: string;
  student_names: string[];
  supervisor_name: string | null;
  meetings_completed: number;
  reports_submitted: number;
  reports_signed: number;
  overdue: number;
}
export interface ReportSettings {
  university_name: string;
  course_code: string;
  sheet_title: string;
  due_days: number;
}