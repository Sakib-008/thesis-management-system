"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiGet, apiPatch, apiPost, errorMessage } from "@/lib/apiClient";
import { Role, User } from "@/lib/auth";

const ROLES: Role[] = ["student", "supervisor", "coordinator", "admin"];

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "coordinator" as Role });

  const load = useCallback(async () => {
    try {
      setUsers(await apiGet<User[]>("/api/v1/users"));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiPost("/api/v1/users", form);
      setForm({ full_name: "", email: "", password: "", role: "coordinator" });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function update(id: number, changes: { role?: Role; is_active?: boolean }) {
    setError(null);
    try {
      await apiPatch(`/api/v1/users/${id}`, changes);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <h1>Users &amp; Roles</h1>
      {error && <p className="error">{error}</p>}

      <div className="card">
        <h2>Create user</h2>
        <form className="row" onSubmit={createUser}>
          <label>Full name
            <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required minLength={2} />
          </label>
          <label>Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label>Password
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} maxLength={64} />
          </label>
          <label>Role
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <button className="btn">Create</button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isMe = u.id === me?.id;
              return (
                <tr key={u.id}>
                  <td>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.role} disabled={isMe} onChange={(e) => update(u.id, { role: e.target.value as Role })}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>{u.is_active ? "Active" : "Inactive"}</td>
                  <td>
                    <button className="btn btn-small" disabled={isMe} onClick={() => update(u.id, { is_active: !u.is_active })}>
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}