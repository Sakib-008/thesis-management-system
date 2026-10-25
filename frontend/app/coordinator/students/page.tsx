"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, errorMessage } from "@/lib/apiClient";
import { Student } from "@/lib/types";

export default function CoordinatorStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStudents(await apiGet<Student[]>("/api/v1/students"));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function verify(id: number) {
    setError(null);
    try {
      await apiPost(`/api/v1/students/${id}/verify-cgpa`);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <>
      <h1>Students &amp; CGPA</h1>
      <p className="muted">
        Students enter their own CGPA. Check it against official records, then verify it. Supervisor
        allocation will only trust verified CGPAs.
      </p>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <table>
          <thead>
            <tr><th>Student</th><th>Department</th><th>Program</th><th>Batch</th><th>CGPA</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.user.full_name}<br /><span className="muted">{s.user.email}</span></td>
                <td>{s.department.name}</td>
                <td>{s.program.name}</td>
                <td>{s.batch}</td>
                <td>{s.cgpa.toFixed(2)}</td>
                <td>
                  <span className={s.cgpa_verified ? "badge badge-ok" : "badge badge-warn"}>
                    {s.cgpa_verified ? "Verified" : "Unverified"}
                  </span>
                </td>
                <td>
                  <button className="btn btn-small" disabled={s.cgpa_verified} onClick={() => verify(s.id)}>
                    Verify CGPA
                  </button>
                </td>
              </tr>
            ))}
            {students.length === 0 && <tr><td colSpan={7} className="muted">No student has completed a profile yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}