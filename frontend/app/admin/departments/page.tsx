import NameListManager from "@/components/ui/NameListManager";

export default function Page() {
  return (
    <NameListManager
      title="Departments"
      singular="department"
      description="The departments students and supervisors belong to."
      endpoint="/api/v1/departments"
      deleteWarning="This only works if no program, student or supervisor uses it."
    />
  );
}