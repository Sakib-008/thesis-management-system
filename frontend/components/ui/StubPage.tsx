import { Hammer } from "lucide-react";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { PageHeader } from "./PageHeader";

// Placeholder used by every route stub until its phase is implemented.
export default function StubPage({ title, role, phase }: { title: string; role: string; phase: number }) {
  return (
    <>
      <PageHeader title={title} description={`${role} area`} />
      <Card>
        <EmptyState
          icon={Hammer}
          title="Coming soon"
          description={`This screen is scheduled for Phase ${phase} of the build.`}
        />
      </Card>
    </>
  );
}