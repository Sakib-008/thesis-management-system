import NameListManager from "@/components/ui/NameListManager";

export default function Page() {
  return (
    <NameListManager
      title="Departments"
      endpoint="/api/v1/departments"
      deleteWarning="This only works if no program, student or supervisor uses it."
    />
  );
}