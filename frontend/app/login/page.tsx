"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import AuthLayout from "@/components/layout/AuthLayout";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { errorMessage } from "@/lib/apiClient";
import { dashboardPath } from "@/lib/auth";

export default function LoginPage() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already logged in? Go straight to your dashboard.
  useEffect(() => {
    if (user) router.replace(dashboardPath(user.role));
  }, [user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedIn = await login(email, password);
      router.replace(dashboardPath(loggedIn.role));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to manage your thesis.">
      <form className="space-y-4" onSubmit={onSubmit}>
        {error && <Alert>{error}</Alert>}
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu" required autoFocus />
        </Field>
        <Field label="Password">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Button type="submit" loading={submitting} className="w-full">Log in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-subtle">
        New here?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">Create an account</Link>
      </p>
    </AuthLayout>
  );
}