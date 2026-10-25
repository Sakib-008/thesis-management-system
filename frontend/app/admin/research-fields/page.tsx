import NameListManager from "@/components/ui/NameListManager";

export default function Page() {
  return (
    <NameListManager
      title="Research fields"
      singular="research field"
      description="Supervisors and thesis proposals are tagged with these fields; the AI matching uses them."
      endpoint="/api/v1/research-fields"
      deleteWarning="It will also be removed from every supervisor and proposal that uses it."
    />
  );
}