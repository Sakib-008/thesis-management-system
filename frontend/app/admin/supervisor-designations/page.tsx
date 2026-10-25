"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Td } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPatch, errorMessage } from "@/lib/apiClient";
import { Designation, Supervisor } from "@/lib/types";

export default function DesignationsPage() {
  const toast = useToast();
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [defaultDraft, setDefaultDraft] = useState<Record<number, string>>({});
  const [capacityDraft, setCapacityDraft] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function run(action: () => Promise<unknown>, successMessage: string) {
    try {
      await action();
      toast.success(successMessage);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Designations & supervisors"
        description="Set how many students each designation can supervise, and review the designation each supervisor chose."
      />
      {loadError && <Alert>{loadError}</Alert>}

      <Card className="mb-6">
        <CardHeader title="Designation capacity"
          description="Changing a default only affects supervisors who create their profile afterwards." />
        <Table headers={["Designation", "Default capacity", ""]} loading={loading}>
          {designations.map((d) => (
            <tr key={d.id}>
              <Td className="font-medium">{d.name}</Td>
              <Td>
                <Input compact type="number" min={1} max={50} className="w-24"
                  value={defaultDraft[d.id] ?? String(d.default_capacity)}
                  onChange={(e) => setDefaultDraft({ ...defaultDraft, [d.id]: e.target.value })} />
              </Td>
              <Td className="text-right">
                <Button size="sm" disabled={defaultDraft[d.id] === undefined}
                  onClick={() => run(() => apiPatch(`/api/v1/supervisor-designations/${d.id}`,
                    { default_capacity: Number(defaultDraft[d.id]) }), "Default capacity saved")}>
                  Save
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card>
        <CardHeader title="Supervisors"
          description="Supervisors choose their designation once. Changing it here resets their capacity to that designation's default." />
        <Table headers={["Supervisor", "Department", "Designation", "Capacity", "Supervising", ""]} loading={loading}
          emptyText={!loading && supervisors.length === 0 ? "No supervisor has created a profile yet." : undefined}>
          {supervisors.map((s) => (
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
              <Td>{s.department.name}</Td>
              <Td>
                <Select compact className="w-44" value={s.designation.id}
                  onChange={(e) => run(() => apiPatch(`/api/v1/supervisors/${s.id}`,
                    { designation_id: Number(e.target.value) }), "Designation updated")}>
                  {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </Td>
              <Td>
                <Input compact type="number" min={0} max={50} className="w-20"
                  value={capacityDraft[s.id] ?? String(s.capacity)}
                  onChange={(e) => setCapacityDraft({ ...capacityDraft, [s.id]: e.target.value })} />
              </Td>
              <Td>{s.current_count}</Td>
              <Td className="text-right">
                <Button size="sm" variant="secondary" disabled={capacityDraft[s.id] === undefined}
                  onClick={() => run(() => apiPatch(`/api/v1/supervisors/${s.id}`,
                    { capacity: Number(capacityDraft[s.id]) }), "Capacity saved")}>
                  Save capacity
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}