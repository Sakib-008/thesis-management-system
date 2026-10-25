"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost, errorMessage } from "@/lib/apiClient";
import { NamedRef, Program } from "@/lib/types";

export default function ProgramsPage() {
  const [departments, setDepartments] = useState<NamedRef[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [form, setForm] = useState({ name: "", department_id: "" });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([
        apiGet<NamedRef[]>("/api/v1/departments"),
        apiGet<Program[]>("/api/v1/programs"),
      ]);
      setDepartments(d);
      setPrograms(p);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function add(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      await apiPost("/api/v1/programs", { name: form.name, department_id: Number(form.department_id) });
      setForm({ ...form, name: "" });
    });
  }

  function rename(p: Program) {
    const next = window.prompt("New name", p.name);
    if (!next || next.trim() === p.name) return;
    run(() => apiPatch(`/api/v1/programs/${p.id}`, { name: next.trim() }));
  }

  function remove(p: Program) {
    if (!window.confirm(`Delete "${p.name}"? This only works if no student uses it.`)) return;
    run(() => apiDelete(`/api/v1/programs/${p.id}`));
  }

  const deptName = (id: number) => departments.find((d) => d.id === id)?.name ?? "—";

  return (
    <>
      <h1>Programs</h1>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <form className="row" onSubmit={add}>
          <label>Department
            <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} required>
              <option value="">Select…</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label>Program name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
          </label>
          <button className="btn">Add</button>
        </form>
        {departments.length === 0 && <p className="muted">Create a department first.</p>}
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Program</th><th>Department</th><th></th></tr></thead>
          <tbody>
            {programs.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{deptName(p.department_id)}</td>
                <td className="actions">
                  <button className="btn btn-small" onClick={() => rename(p)}>Rename</button>{" "}
                  <button className="btn btn-small" onClick={() => remove(p)}>Delete</button>
                </td>
              </tr>
            ))}
            {programs.length === 0 && <tr><td colSpan={3} className="muted">No programs yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}