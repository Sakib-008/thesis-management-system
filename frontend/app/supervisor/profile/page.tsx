"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiError, apiGet, apiPost, apiPut, errorMessage } from "@/lib/apiClient";
import { Designation, NamedRef, Supervisor } from "@/lib/types";

export default function SupervisorProfilePage() {
  const [departments, setDepartments] = useState<NamedRef[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [allFields, setAllFields] = useState<NamedRef[]>([]);
  const [profile, setProfile] = useState<Supervisor | null>(null);
  const [form, setForm] = useState({ department_id: "", designation_id: "", expertise: "", field_ids: [] as number[] });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);

  function fill(s: Supervisor) {
    setProfile(s);
    setForm({
      department_id: String(s.department.id),
      designation_id: String(s.designation.id),
      expertise: s.expertise,
      field_ids: s.fields.map((f) => f.id),
    });
  }

  useEffect(() => {
    (async () => {
      try {
        const [d, g, f] = await Promise.all([
          apiGet<NamedRef[]>("/api/v1/departments"),
          apiGet<Designation[]>("/api/v1/supervisor-designations"),
          apiGet<NamedRef[]>("/api/v1/research-fields"),
        ]);
        setDepartments(d);
        setDesignations(g);
        setAllFields(f);
        try {
          fill(await apiGet<Supervisor>("/api/v1/supervisors/me"));
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

  function toggleField(id: number) {
    setForm((f) => ({
      ...f,
      field_ids: f.field_ids.includes(id) ? f.field_ids.filter((x) => x !== id) : [...f.field_ids, id],
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      const base = {
        department_id: Number(form.department_id),
        expertise: form.expertise,
        field_ids: form.field_ids,
      };
      const result = profile
        ? await apiPut<Supervisor>("/api/v1/supervisors/me", base)
        : await apiPost<Supervisor>("/api/v1/supervisors/me", { ...base, designation_id: Number(form.designation_id) });
      fill(result);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!ready) return <p>Loading…</p>;

  return (
    <div className="card">
      <h1>My research profile</h1>
      {profile && (
        <p>
          <strong>{profile.designation.name}</strong> · capacity {profile.capacity} students · currently
          supervising {profile.current_count}.{" "}
          <span className="muted">Only an admin can change your designation or capacity.</span>
        </p>
      )}
      <form className="form" onSubmit={onSubmit}>
        <label>Department
          <select value={form.department_id} required onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
            <option value="">Select…</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        {!profile && (
          <label>Designation (cannot be changed by you afterwards)
            <select value={form.designation_id} required onChange={(e) => setForm({ ...form, designation_id: e.target.value })}>
              <option value="">Select…</option>
              {designations.map((d) => <option key={d.id} value={d.id}>{d.name} — up to {d.default_capacity} students</option>)}
            </select>
          </label>
        )}
        <div>
          <div className="muted">Research fields</div>
          <div className="checks">
            {allFields.map((f) => (
              <label key={f.id}>
                <input type="checkbox" checked={form.field_ids.includes(f.id)} onChange={() => toggleField(f.id)} />
                {f.name}
              </label>
            ))}
          </div>
        </div>
        <label>Research interests, expertise and keywords
          <textarea value={form.expertise} maxLength={2000}
            onChange={(e) => setForm({ ...form, expertise: e.target.value })}
            placeholder="e.g. Convolutional neural networks, object detection, traffic sign recognition…" />
        </label>
        {error && <p className="error">{error}</p>}
        {saved && <p className="notice">Profile saved.</p>}
        <button className="btn">{profile ? "Save changes" : "Create profile"}</button>
      </form>
    </div>
  );
}