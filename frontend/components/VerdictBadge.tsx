import type { CaseStatus, Decision } from "@/lib/contracts/types";
import { decisionColor } from "./ThresholdRuler";

/** Verdict pill — colored by the contract's decision enum. */
export function VerdictBadge({
  decision,
  className = "",
}: {
  decision: Decision;
  className?: string;
}) {
  const color = decisionColor(decision);
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 label-mono ${className}`}
      style={{
        color,
        borderColor: color,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      {decision}
    </span>
  );
}

/** Status pill — decided vs. awaiting human review. */
export function StatusBadge({ status }: { status: CaseStatus }) {
  const human = status === "human_review";
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 label-mono ${
        human ? "border-bronze text-bronze" : "border-hairline text-muted-foreground"
      }`}
      style={
        human
          ? { background: "color-mix(in srgb, var(--accent) 10%, transparent)" }
          : undefined
      }
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${human ? "animate-pulse" : ""}`}
        style={{ background: human ? "var(--accent)" : "var(--muted-foreground)" }}
        aria-hidden
      />
      {human ? "human review" : "decided"}
    </span>
  );
}
