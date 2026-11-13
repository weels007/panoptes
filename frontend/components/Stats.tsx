import type { Case, Stats } from "@/lib/contracts/types";

/**
 * Hero motif built from real data: one mark per case in the ledger,
 * inked by its verdict. The size of the grid is the size of the record.
 */
export function VerdictGrid({ cases, max = 96 }: { cases: Case[]; max?: number }) {
  const marks = cases.slice(0, max);

  if (marks.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 border border-dashed border-hairline">
        <span className="label-mono">ledger empty — first case pending</span>
      </div>
    );
  }

  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(16px, 16px))" }}
      aria-label={`${marks.length} cases on record`}
    >
      {marks.map((c) => (
        <span
          key={c.id}
          title={`${c.id} — ${c.decision} (${c.confidence})`}
          className="w-4 h-4 transition-transform hover:scale-125"
          style={{
            background:
              c.status === "human_review"
                ? "var(--accent)"
                : c.decision === "ALLOW"
                  ? "var(--allow)"
                  : c.decision === "FLAG"
                    ? "var(--flag)"
                    : "var(--block)",
            opacity: c.status === "human_review" ? 0.85 : 0.9,
          }}
        />
      ))}
    </div>
  );
}

const CELLS: { key: keyof Stats; label: string }[] = [
  { key: "total_cases", label: "cases" },
  { key: "allowed", label: "allowed" },
  { key: "flagged", label: "flagged" },
  { key: "blocked", label: "blocked" },
  { key: "total_agents", label: "agents" },
  { key: "total_reviews", label: "reviews" },
  { key: "appeals", label: "appeals" },
  { key: "appeals_overturned", label: "overturned" },
];

/** The ledger strip: mono figures on hairlines, like a balance sheet. */
export function StatLedger({ stats }: { stats: Stats }) {
  return (
    <div className="sheet overflow-hidden">
      <div
        className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8"
        style={{ marginRight: "-1px", marginBottom: "-1px" }}
      >
        {CELLS.map(({ key, label }) => (
          <div
            key={key}
            className="px-4 py-4 border-r border-b border-hairline"
          >
            <div className="data-mono text-2xl leading-none">{stats[key]}</div>
            <div className="label-mono mt-2">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
