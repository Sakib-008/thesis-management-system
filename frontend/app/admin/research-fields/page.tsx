import NameListManager from "@/components/ui/NameListManager";

export default function Page() {
  return (
    <NameListManager
      title="Research fields"
      endpoint="/api/v1/research-fields"
      deleteWarning="It will also be removed from every supervisor and proposal that uses it."
    />
  );
}