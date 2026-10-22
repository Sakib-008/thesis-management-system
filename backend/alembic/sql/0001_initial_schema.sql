-- =====================================================================
-- AI-Assisted University Thesis Management System — Database Schema
-- PostgreSQL. Updated for: admin-assigned coordinators, designation-based
-- supervision capacity, CGPA + AI-ranking based assignment (merit rank hidden).
-- =====================================================================

CREATE TYPE user_role AS ENUM ('student', 'supervisor', 'coordinator', 'admin');
CREATE TYPE proposal_status AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'revision_required', 'resubmitted');
CREATE TYPE milestone_status AS ENUM ('not_started', 'in_progress', 'submitted', 'under_review', 'revision_required', 'completed', 'overdue');
CREATE TYPE assignment_method AS ENUM ('merit_allocation', 'manual_override');
CREATE TYPE assignment_run_status AS ENUM ('pending', 'running', 'completed', 'completed_with_exceptions', 'failed');

-- ---------------------------------------------------------------------
-- Org structure
-- ---------------------------------------------------------------------
CREATE TABLE departments (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE programs (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    department_id   INT NOT NULL REFERENCES departments(id)
);

-- ---------------------------------------------------------------------
-- Users & roles
-- Coordinator/Admin accounts are only ever created by an Admin
-- (enforced at the application layer, not the schema).
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      INT REFERENCES users(id),   -- NULL for self-registered students/supervisors
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Students
-- merit_rank is internal to the allocation service: no API route should
-- ever return it to a student/supervisor/coordinator.
-- ---------------------------------------------------------------------
CREATE TABLE students (
    id              SERIAL PRIMARY KEY,
    user_id         INT NOT NULL UNIQUE REFERENCES users(id),
    department_id   INT NOT NULL REFERENCES departments(id),
    program_id      INT NOT NULL REFERENCES programs(id),
    batch           VARCHAR(20) NOT NULL,
    cgpa            NUMERIC(3,2) NOT NULL CHECK (cgpa >= 0 AND cgpa <= 4.00),
    merit_rank      INT,                         -- computed per assignment cycle; internal use only
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Supervisor designation -> default capacity lookup
-- ---------------------------------------------------------------------
CREATE TABLE supervisor_designations (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(50) NOT NULL UNIQUE,
    default_capacity    INT NOT NULL
);

INSERT INTO supervisor_designations (name, default_capacity) VALUES
    ('Professor', 5),
    ('Associate Professor', 4),
    ('Assistant Professor', 3),
    ('Lecturer', 2);

CREATE TABLE supervisors (
    id                  SERIAL PRIMARY KEY,
    user_id             INT NOT NULL UNIQUE REFERENCES users(id),
    department_id       INT NOT NULL REFERENCES departments(id),
    designation_id      INT NOT NULL REFERENCES supervisor_designations(id),
    capacity            INT NOT NULL,   -- seeded from designation default; admin can override
    current_count       INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (current_count <= capacity)
);

-- ---------------------------------------------------------------------
-- Research fields
-- ---------------------------------------------------------------------
CREATE TABLE research_fields (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE supervisor_fields (
    supervisor_id   INT NOT NULL REFERENCES supervisors(id) ON DELETE CASCADE,
    field_id        INT NOT NULL REFERENCES research_fields(id) ON DELETE CASCADE,
    PRIMARY KEY (supervisor_id, field_id)
);

-- ---------------------------------------------------------------------
-- Thesis & proposals
-- ---------------------------------------------------------------------
CREATE TABLE theses (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    status      VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE thesis_members (
    thesis_id   INT NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
    student_id  INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    PRIMARY KEY (thesis_id, student_id)
);

CREATE TABLE thesis_proposals (
    id                  SERIAL PRIMARY KEY,
    thesis_id           INT NOT NULL UNIQUE REFERENCES theses(id) ON DELETE CASCADE,
    title               VARCHAR(255) NOT NULL,
    abstract            TEXT NOT NULL,
    problem_statement   TEXT NOT NULL,
    objectives          TEXT NOT NULL,
    methodology         TEXT NOT NULL,
    expected_outcome    TEXT,
    status              proposal_status NOT NULL DEFAULT 'draft',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE proposal_fields (
    proposal_id INT NOT NULL REFERENCES thesis_proposals(id) ON DELETE CASCADE,
    field_id    INT NOT NULL REFERENCES research_fields(id) ON DELETE CASCADE,
    PRIMARY KEY (proposal_id, field_id)
);

CREATE TABLE proposal_versions (
    id                  SERIAL PRIMARY KEY,
    proposal_id         INT NOT NULL REFERENCES thesis_proposals(id) ON DELETE CASCADE,
    version_no          INT NOT NULL,
    content_snapshot    JSONB NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (proposal_id, version_no)
);

-- ---------------------------------------------------------------------
-- AI recommendation (per proposal, ranked by final_score)
-- ---------------------------------------------------------------------
CREATE TABLE supervisor_recommendations (
    id              SERIAL PRIMARY KEY,
    proposal_id     INT NOT NULL REFERENCES thesis_proposals(id) ON DELETE CASCADE,
    supervisor_id   INT NOT NULL REFERENCES supervisors(id) ON DELETE CASCADE,
    field_score     NUMERIC(5,4) NOT NULL,
    semantic_score  NUMERIC(5,4) NOT NULL,
    workload_score  NUMERIC(5,4) NOT NULL,
    final_score     NUMERIC(5,4) NOT NULL,
    reasons_json    JSONB NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (proposal_id, supervisor_id)
);

-- ---------------------------------------------------------------------
-- Allocation runs (audit trail for the merit-based matching process)
-- NOTE: there is no student-submitted preference table. Students only
-- submit proposals; the ranked order used for allocation comes entirely
-- from supervisor_recommendations.final_score (field match + semantic
-- match + workload, per proposal). The allocation algorithm processes
-- students in CGPA-descending merit order and, for each, walks down
-- their own recommendation ranking until it finds a supervisor with
-- remaining capacity. merit_rank (on students) stays internal to this
-- process and is never returned by any API response.
-- ---------------------------------------------------------------------
CREATE TABLE assignment_runs (
    id              SERIAL PRIMARY KEY,
    triggered_by    INT NOT NULL REFERENCES users(id),   -- a coordinator
    status          assignment_run_status NOT NULL DEFAULT 'pending',
    notes           TEXT,
    run_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE TABLE supervisor_assignments (
    id                  SERIAL PRIMARY KEY,
    proposal_id         INT NOT NULL UNIQUE REFERENCES thesis_proposals(id) ON DELETE CASCADE,
    student_id          INT NOT NULL REFERENCES students(id),
    supervisor_id       INT NOT NULL REFERENCES supervisors(id),
    assignment_run_id   INT REFERENCES assignment_runs(id),   -- NULL if purely manual
    assigned_by         INT REFERENCES users(id),             -- NULL if system-assigned, set if coordinator override
    method              assignment_method NOT NULL DEFAULT 'merit_allocation',
    status              VARCHAR(30) NOT NULL DEFAULT 'active',
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Milestones, submissions
-- ---------------------------------------------------------------------
CREATE TABLE milestones (
    id              SERIAL PRIMARY KEY,
    thesis_id       INT NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    start_date      DATE,
    deadline        DATE NOT NULL,
    status          milestone_status NOT NULL DEFAULT 'not_started',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE milestone_submissions (
    id              SERIAL PRIMARY KEY,
    milestone_id    INT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    submitted_by    INT NOT NULL REFERENCES users(id),
    file_path       VARCHAR(500),
    status          milestone_status NOT NULL DEFAULT 'submitted',
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------
CREATE TABLE documents (
    id              SERIAL PRIMARY KEY,
    thesis_id       INT NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    uploaded_by     INT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document_versions (
    id              SERIAL PRIMARY KEY,
    document_id     INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_no      INT NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, version_no)
);

-- ---------------------------------------------------------------------
-- Meetings
-- ---------------------------------------------------------------------
CREATE TABLE meetings (
    id                  SERIAL PRIMARY KEY,
    thesis_id           INT NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
    meeting_date        TIMESTAMPTZ NOT NULL,
    agenda              TEXT,
    discussion          TEXT,
    decisions           TEXT,
    next_meeting_date   TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE meeting_participants (
    meeting_id  INT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (meeting_id, user_id)
);

-- ---------------------------------------------------------------------
-- Feedback
-- ---------------------------------------------------------------------
CREATE TABLE feedback (
    id              SERIAL PRIMARY KEY,
    submission_id   INT NOT NULL REFERENCES milestone_submissions(id) ON DELETE CASCADE,
    given_by        INT NOT NULL REFERENCES users(id),
    content         TEXT NOT NULL,
    status          VARCHAR(30) NOT NULL DEFAULT 'open',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Evaluation
-- ---------------------------------------------------------------------
CREATE TABLE evaluation_criteria (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(150) NOT NULL,
    weight  NUMERIC(5,2) NOT NULL   -- e.g. 15.00 meaning 15%
);

CREATE TABLE evaluations (
    id              SERIAL PRIMARY KEY,
    thesis_id       INT NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
    evaluator_id    INT NOT NULL REFERENCES users(id),
    scores_json     JSONB NOT NULL,
    total           NUMERIC(5,2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Notifications & audit
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(50) NOT NULL,
    payload     JSONB,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
    id          SERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(id),
    action      VARCHAR(100) NOT NULL,
    entity      VARCHAR(100) NOT NULL,
    entity_id   INT,
    metadata    JSONB,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Indexes worth adding up front
-- ---------------------------------------------------------------------
CREATE INDEX idx_proposals_status ON thesis_proposals(status);
CREATE INDEX idx_recommendations_proposal ON supervisor_recommendations(proposal_id);
CREATE INDEX idx_milestones_thesis ON milestones(thesis_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;