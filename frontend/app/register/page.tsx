"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import AuthLayout from "@/components/layout/AuthLayout";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Form";
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
    <AuthLayout title="Create your account" subtitle="Coordinator and admin accounts are created by an administrator.">
      <form className="space-y-4" onSubmit={onSubmit}>
        {error && <Alert>{error}</Alert>}
        <Field label="Full name">
          <Input value={form.full_name} onChange={set("full_name")} required minLength={2} autoFocus />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={set("email")} placeholder="you@university.edu" required />
        </Field>
        <Field label="Password" hint="8 to 64 characters">
          <Input type="password" value={form.password} onChange={set("password")} required minLength={8} maxLength={64} />
        </Field>
        <Field label="I am a">
          <Select value={form.role} onChange={set("role")}>
            <option value="student">Student</option>
            <option value="supervisor">Supervisor</option>
          </Select>
        </Field>
        <Button type="submit" loading={submitting} className="w-full">Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-subtle">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">Log in</Link>
      </p>
    </AuthLayout>
  );
}