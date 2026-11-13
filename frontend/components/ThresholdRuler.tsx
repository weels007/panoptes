import {
  BLOCK_THRESHOLD,
  FLAG_THRESHOLD,
  type Decision,
} from "@/lib/contracts/types";

interface ThresholdRulerProps {
  confidence: number;
  decision?: Decision;
  size?: "sm" | "lg";
  showValue?: boolean;
  className?: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * The signature of the interface: a measuring instrument, not an opinion.
 * Confidence is placed against the contract's fixed notches — 40 (FLAG)
 * and 70 (BLOCK) — and the verdict falls out of which zone the marker lands in.
 */
export function ThresholdRuler({
  confidence,
  decision,
  size = "sm",
  showValue = true,
  className = "",
}: ThresholdRulerProps) {
  const value = clamp(confidence);
  const isLarge = size === "lg";

  return (
    <div className={className} aria-label={`Confidence ${value} of 100`}>
      {isLarge && showValue && (
        <div className="relative h-6">
          <span className="absolute left-0 top-0 label-mono">confidence</span>
          <span
            className="absolute right-0 top-0 label-mono"
            style={{ color: decisionColor(decision) }}
          >
            {decision ?? ""}
          </span>
        </div>
      )}

      {/* The instrument */}
      <div
        className={`relative overflow-hidden border border-hairline bg-card ${
          isLarge ? "h-12" : "h-5"
        }`}
      >
        {/* Cursor value — rides the needle like a gauge read-out */}
        {isLarge && showValue && (
          <span
            className="absolute top-1 z-10 data-mono text-[11px] font-medium px-1 bg-card border border-hairline transition-[left] duration-700 ease-out"
            style={{
              left: `${value}%`,
              transform:
                value < 8
                  ? "translateX(2px)"
                  : value > 92
                    ? "translateX(calc(-100% - 2px))"
                    : "translateX(-50%)",
            }}
          >
            {value}
          </span>
        )}
        {/* Zones: 0–40 ALLOW · 40–70 FLAG · 70–100 BLOCK */}
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${FLAG_THRESHOLD}%`,
            background: "color-mix(in srgb, var(--allow) 14%, transparent)",
          }}
        />
        <div
          className="absolute inset-y-0"
          style={{
            left: `${FLAG_THRESHOLD}%`,
            width: `${BLOCK_THRESHOLD - FLAG_THRESHOLD}%`,
            background: "color-mix(in srgb, var(--flag) 16%, transparent)",
          }}
        />
        <div
          className="absolute inset-y-0 right-0"
          style={{
            width: `${100 - BLOCK_THRESHOLD}%`,
            background: "color-mix(in srgb, var(--block) 14%, transparent)",
          }}
        />

        {/* Ten-unit ticks */}
        {Array.from({ length: 9 }, (_, i) => (i + 1) * 10).map((t) =>
          t === FLAG_THRESHOLD || t === BLOCK_THRESHOLD ? null : (
            <div
              key={t}
              className="absolute top-0 w-px bg-hairline"
              style={{ left: `${t}%`, height: isLarge ? "8px" : "5px" }}
            />
          )
        )}

        {/* Fixed notches — written in the contract, never in the model */}
        {[FLAG_THRESHOLD, BLOCK_THRESHOLD].map((notch) => (
          <div
            key={notch}
            className="absolute inset-y-0 w-px bg-ink"
            style={{ left: `${notch}%` }}
          />
        ))}

        {/* Marker needle */}
        <div
          className="absolute inset-y-0 w-0.5 bg-ink transition-[left] duration-700 ease-out"
          style={{ left: `calc(${value}% - 1px)` }}
        />
      </div>

      {/* Scale labels */}
      {isLarge && (
        <div className="relative h-5 mt-1">
          <span className="absolute left-0 label-mono">0</span>
          <span
            className="absolute -translate-x-1/2 label-mono text-ink"
            style={{ left: `${FLAG_THRESHOLD}%` }}
          >
            {FLAG_THRESHOLD} flag
          </span>
          <span
            className="absolute -translate-x-1/2 label-mono text-ink"
            style={{ left: `${BLOCK_THRESHOLD}%` }}
          >
            {BLOCK_THRESHOLD} block
          </span>
          <span className="absolute right-0 label-mono">100</span>
        </div>
      )}
    </div>
  );
}

export function decisionColor(decision?: Decision): string {
  switch (decision) {
    case "ALLOW":
      return "var(--allow)";
    case "FLAG":
      return "var(--flag)";
    case "BLOCK":
      return "var(--block)";
    default:
      return "var(--muted-foreground)";
  }
}
