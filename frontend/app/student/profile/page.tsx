"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiError, apiGet, apiPut, errorMessage } from "@/lib/apiClient";
import { NamedRef, Program, Student } from "@/lib/types";

export default function StudentProfilePage() {
  const [departments, setDepartments] = useState<NamedRef[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [form, setForm] = useState({ department_id: "", program_id: "", batch: "", cgpa: "" });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);

  function fill(s: Student) {
    setStudent(s);
    setForm({
      department_id: String(s.department.id),
      program_id: String(s.program.id),
      batch: s.batch,
      cgpa: String(s.cgpa),
    });
  }

  useEffect(() => {
    (async () => {
      try {
        const [d, p] = await Promise.all([
          apiGet<NamedRef[]>("/api/v1/departments"),
          apiGet<Program[]>("/api/v1/programs"),
        ]);
        setDepartments(d);
        setPrograms(p);
        try {
          fill(await apiGet<Student>("/api/v1/students/me"));
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 404)) throw e; // 404 just means "no profile yet"
        }
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setReady(true);
      }
    })();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      const result = await apiPut<Student>("/api/v1/students/me", {
        department_id: Number(form.department_id),
        program_id: Number(form.program_id),
        batch: form.batch,
        cgpa: Number(form.cgpa),
      });
      fill(result);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const programOptions = programs.filter((p) => String(p.department_id) === form.department_id);

  if (!ready) return <p>Loading…</p>;

  return (
    <div className="card">
      <h1>My profile</h1>
      {student && (
        <p>
          CGPA status:{" "}
          <span className={student.cgpa_verified ? "badge badge-ok" : "badge badge-warn"}>
            {student.cgpa_verified ? "Verified by coordinator" : "Waiting for coordinator verification"}
          </span>
        </p>
      )}
      <form className="form" onSubmit={onSubmit}>
        <label>Department
          <select value={form.department_id} required
            onChange={(e) => setForm({ ...form, department_id: e.target.value, program_id: "" })}>
            <option value="">Select…</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label>Program
          <select value={form.program_id} required disabled={!form.department_id}
            onChange={(e) => setForm({ ...form, program_id: e.target.value })}>
            <option value="">Select…</option>
            {programOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>Batch (e.g. 2022)
          <input value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} required maxLength={20} />
        </label>
        <label>CGPA (0.00 – 4.00)
          <input type="number" step="0.01" min={0} max={4} value={form.cgpa}
            onChange={(e) => setForm({ ...form, cgpa: e.target.value })} required />
        </label>
        <p className="muted">Changing your CGPA means a coordinator has to verify it again.</p>
        {error && <p className="error">{error}</p>}
        {saved && <p className="notice">Profile saved.</p>}
        <button className="btn">Save profile</button>
      </form>
    </div>
  );
}