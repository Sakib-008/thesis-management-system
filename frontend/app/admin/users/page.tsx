"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { GraduationCap, ShieldCheck, UserCog, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Table, Td } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPatch, apiPost, errorMessage } from "@/lib/apiClient";
import { Role, User } from "@/lib/auth";

const ROLES: Role[] = ["student", "supervisor", "coordinator", "admin"];
const ROLE_TONE: Record<Role, Tone> = { student: "info", supervisor: "brand", coordinator: "warning", admin: "danger" };
const EMPTY_FORM = { full_name: "", email: "", password: "", role: "coordinator" as Role };

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    try {
      setUsers(await apiGet<User[]>("/api/v1/users"));
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost("/api/v1/users", form);
      toast.success(`Account created for ${form.full_name}`);
      setOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function update(id: number, changes: { role?: Role; is_active?: boolean }, message: string) {
    try {
      await apiPatch(`/api/v1/users/${id}`, changes);
      toast.success(message);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const count = (role: Role) => users.filter((u) => u.role === role).length;

  return (
    <>
      <PageHeader
        title="Users & roles"
        description="Create coordinator and admin accounts, change roles, and deactivate accounts."
        actions={<Button onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" />Add user</Button>}
      />
      {loadError && <Alert>{loadError}</Alert>}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={count("student")} icon={GraduationCap} tone="info" />
        <StatCard label="Supervisors" value={count("supervisor")} icon={Users} tone="brand" />
        <StatCard label="Coordinators" value={count("coordinator")} icon={UserCog} tone="warning" />
        <StatCard label="Admins" value={count("admin")} icon={ShieldCheck} tone="success" />
      </div>

      <Card>
        <Table headers={["User", "Role", "Status", ""]} loading={loading} emptyText={!loading && users.length === 0 ? "No users yet." : undefined}>
          {users.map((u) => {
            const isMe = u.id === me?.id;
            return (
              <tr key={u.id} className="hover:bg-ink/[0.02]">
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={u.full_name} />
                    <div>
                      <div className="font-medium">{u.full_name}{isMe && <span className="ml-2 text-xs text-subtle">(you)</span>}</div>
                      <div className="text-xs text-subtle">{u.email}</div>
                    </div>
                  </div>
                </Td>
                <Td>
                  {isMe ? (
                    <Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge>
                  ) : (
                    <Select compact className="w-36" value={u.role}
                      onChange={(e) => update(u.id, { role: e.target.value as Role }, `${u.full_name} is now ${e.target.value}`)}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </Select>
                  )}
                </Td>
                <Td><Badge tone={u.is_active ? "success" : "neutral"}>{u.is_active ? "Active" : "Inactive"}</Badge></Td>
                <Td className="text-right">
                  {!isMe && (
                    <Button variant="secondary" size="sm"
                      onClick={() => update(u.id, { is_active: !u.is_active }, u.is_active ? "Account deactivated" : "Account activated")}>
                      {u.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <Modal open={open} title="Add user" onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="create-user-form" loading={saving}>Create user</Button>
          </>
        }>
        <form id="create-user-form" className="space-y-4" onSubmit={createUser}>
          <Field label="Full name">
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required minLength={2} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label="Temporary password" hint="8 to 64 characters. Share it with the user securely.">
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} maxLength={64} />
          </Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
        </form>
      </Modal>
    </>
  );
}