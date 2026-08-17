import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: "brand" | "success" | "warn" | "danger" | "neutral";
  delay?: number;
}

/** Kept for compatibility — renders as a clean metric cell. */
export function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="metric-cell">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
    </div>
  );
}
