"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Clock, Users } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Table, Td } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPost, errorMessage } from "@/lib/apiClient";
import { Student } from "@/lib/types";

export default function CoordinatorStudentsPage() {
  const toast = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setStudents(await apiGet<Student[]>("/api/v1/students"));
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function verify(student: Student) {
    setVerifying(student.id);
    try {
      await apiPost(`/api/v1/students/${student.id}/verify-cgpa`);
      toast.success(`CGPA verified for ${student.user.full_name}`);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setVerifying(null);
    }
  }

  const verified = students.filter((s) => s.cgpa_verified).length;

  return (
    <>
      <PageHeader
        title="Students & CGPA"
        description="Students enter their own CGPA. Check it against official records, then verify it. Supervisor allocation only trusts verified CGPAs."
      />
      {loadError && <Alert>{loadError}</Alert>}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Students with a profile" value={students.length} icon={Users} tone="info" />
        <StatCard label="CGPA verified" value={verified} icon={BadgeCheck} tone="success" />
        <StatCard label="Waiting for verification" value={students.length - verified} icon={Clock} tone="warning" />
      </div>

      <Card>
        <Table headers={["Student", "Program", "Batch", "CGPA", "Status", ""]} loading={loading}
          emptyText={!loading && students.length === 0 ? "No student has completed a profile yet." : undefined}>
          {students.map((s) => (
            <tr key={s.id} className="hover:bg-ink/[0.02]">
              <Td>
                <div className="flex items-center gap-3">
                  <Avatar name={s.user.full_name} />
                  <div>
                    <div className="font-medium">{s.user.full_name}</div>
                    <div className="text-xs text-subtle">{s.user.email}</div>
                  </div>
                </div>
              </Td>
              <Td>
                <div>{s.program.name}</div>
                <div className="text-xs text-subtle">{s.department.name}</div>
              </Td>
              <Td>{s.batch}</Td>
              <Td className="font-semibold tabular-nums">{s.cgpa.toFixed(2)}</Td>
              <Td><Badge tone={s.cgpa_verified ? "success" : "warning"}>{s.cgpa_verified ? "Verified" : "Unverified"}</Badge></Td>
              <Td className="text-right">
                {!s.cgpa_verified && (
                  <Button size="sm" loading={verifying === s.id} onClick={() => verify(s)}>Verify CGPA</Button>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}