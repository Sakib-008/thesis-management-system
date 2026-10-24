"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiPost, errorMessage } from "@/lib/apiClient";
import { dashboardPath } from "@/lib/auth";

export default function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "student" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (field: string) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiPost("/api/v1/auth/register", form);
      const user = await login(form.email, form.password);
      router.replace(dashboardPath(user.role));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <h1>Register</h1>
      <p className="muted">Coordinator and admin accounts are created by an administrator.</p>
      <form className="form" onSubmit={onSubmit}>
        <label>Full name
          <input value={form.full_name} onChange={set("full_name")} required minLength={2} />
        </label>
        <label>Email
          <input type="email" value={form.email} onChange={set("email")} required />
        </label>
        <label>Password (8–64 characters)
          <input type="password" value={form.password} onChange={set("password")} required minLength={8} maxLength={64} />
        </label>
        <label>I am a
          <select value={form.role} onChange={set("role")}>
            <option value="student">Student</option>
            <option value="supervisor">Supervisor</option>
          </select>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={submitting}>{submitting ? "Creating account…" : "Create account"}</button>
      </form>
      <p className="muted">Already registered? <Link href="/login">Log in</Link></p>
    </div>
  );
}