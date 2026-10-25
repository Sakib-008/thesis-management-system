import { DemoBadge } from "./DemoBadge";

// Small heading that separates dashboard sections; "demo" adds the sample-data badge.
export function SectionTitle({ title, demo, first }: { title: string; demo?: boolean; first?: boolean }) {
  return (
    <div className={`mb-3 flex items-center gap-3 ${first ? "" : "mt-8"}`}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">{title}</h2>
      {demo && <DemoBadge />}
    </div>
  );
}