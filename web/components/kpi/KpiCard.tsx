import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";

type Delta = { value: string; dir: "up" | "down" };

type Props = {
  label: string;
  value: string;
  delta?: Delta;
  sub?: string;
  icon?: LucideIcon;
  feature?: boolean;
  valueColor?: "default" | "green" | "red";
};

export function KpiCard({ label, value, delta, sub, icon: Icon, feature, valueColor = "default" }: Props) {
  const featureStyle = feature
    ? { background: "linear-gradient(135deg, rgba(0,184,148,0.18) 0%, rgba(0,184,148,0.03) 100%)" }
    : undefined;
  const valueClass =
    valueColor === "green"
      ? "text-accent-green"
      : valueColor === "red"
        ? "text-accent-red"
        : "text-ink";
  const deltaClass = delta?.dir === "up" ? "text-accent-green" : "text-accent-red";
  const DeltaIcon = delta?.dir === "up" ? ArrowUp : ArrowDown;
  return (
    <div
      className="bg-bg-2 border border-line rounded-card p-5 flex flex-col h-[120px]"
      style={featureStyle}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-[12.5px] text-ink-3 leading-tight">{label}</p>
        {Icon && <Icon className="w-4 h-4 text-ink-3 flex-shrink-0" />}
      </div>
      <p className={`text-[26px] font-bold tracking-[-0.025em] tabular leading-none mb-2 ${valueClass}`}>
        {value}
      </p>
      <div className="flex items-center justify-between mt-auto">
        {delta && (
          <span className={`flex items-center gap-1 text-[11.5px] font-semibold ${deltaClass}`}>
            <DeltaIcon className="w-3 h-3" />
            <span>{delta.value}</span>
          </span>
        )}
        {sub && <span className="text-[12px] text-ink-3 truncate">{sub}</span>}
      </div>
    </div>
  );
}
