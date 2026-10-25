"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch, errorMessage } from "@/lib/apiClient";
import { Designation, Supervisor } from "@/lib/types";

export default function DesignationsPage() {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [defaultDraft, setDefaultDraft] = useState<Record<number, string>>({});
  const [capacityDraft, setCapacityDraft] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([
        apiGet<Designation[]>("/api/v1/supervisor-designations"),
        apiGet<Supervisor[]>("/api/v1/supervisors"),
      ]);
      setDesignations(d);
      setSupervisors(s);
      setDefaultDraft({});
      setCapacityDraft({});
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

  return (
    <>
      <h1>Designations &amp; supervisors</h1>
      {error && <p className="error">{error}</p>}

      <div className="card">
        <h2>Designation capacity</h2>
        <p className="muted">
          How many students a supervisor of this designation can supervise. Changing a default only affects
          supervisors who create their profile afterwards.
        </p>
        <table>
          <thead><tr><th>Designation</th><th>Default capacity</th><th></th></tr></thead>
          <tbody>
            {designations.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>
                  <input type="number" min={1} max={50}
                    value={defaultDraft[d.id] ?? String(d.default_capacity)}
                    onChange={(e) => setDefaultDraft({ ...defaultDraft, [d.id]: e.target.value })} />
                </td>
                <td>
                  <button className="btn btn-small" disabled={defaultDraft[d.id] === undefined}
                    onClick={() => run(() => apiPatch(`/api/v1/supervisor-designations/${d.id}`,
                      { default_capacity: Number(defaultDraft[d.id]) }))}>
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Supervisors</h2>
        <p className="muted">
          Supervisors choose their designation once when they create a profile. Check it here: changing the
          designation resets the capacity to that designation&apos;s default.
        </p>
        <table>
          <thead>
            <tr><th>Name</th><th>Department</th><th>Designation</th><th>Capacity</th><th>Supervising</th><th></th></tr>
          </thead>
          <tbody>
            {supervisors.map((s) => (
              <tr key={s.id}>
                <td>{s.user.full_name}<br /><span className="muted">{s.user.email}</span></td>
                <td>{s.department.name}</td>
                <td>
                  <select value={s.designation.id}
                    onChange={(e) => run(() => apiPatch(`/api/v1/supervisors/${s.id}`, { designation_id: Number(e.target.value) }))}>
                    {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </td>
                <td>
                  <input type="number" min={0} max={50}
                    value={capacityDraft[s.id] ?? String(s.capacity)}
                    onChange={(e) => setCapacityDraft({ ...capacityDraft, [s.id]: e.target.value })} />
                </td>
                <td>{s.current_count}</td>
                <td>
                  <button className="btn btn-small" disabled={capacityDraft[s.id] === undefined}
                    onClick={() => run(() => apiPatch(`/api/v1/supervisors/${s.id}`, { capacity: Number(capacityDraft[s.id]) }))}>
                    Save capacity
                  </button>
                </td>
              </tr>
            ))}
            {supervisors.length === 0 && <tr><td colSpan={6} className="muted">No supervisor has created a profile yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}