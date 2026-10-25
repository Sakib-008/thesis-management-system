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