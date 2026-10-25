import { Badge } from "./Badge";

// Marks any card that shows sample numbers instead of real data.
export function DemoBadge() {
  return (
    <span title="Sample data. Real numbers appear once this feature is built.">
      <Badge tone="info">Demo data</Badge>
    </span>
  );
}