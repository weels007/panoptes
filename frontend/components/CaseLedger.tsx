"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Case } from "@/lib/contracts/types";
import { useCaseHistory, useCaseReviews } from "@/lib/hooks/usePanoptes";
import { ThresholdRuler } from "./ThresholdRuler";
import { StatusBadge, VerdictBadge } from "./VerdictBadge";

function shortTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

function parseCategories(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * The public audit ledger: one hairline row per case, expanding into the
 * full record — reasoning, threshold measurement, and agent reviews.
 */
export function CaseLedger({ cases }: { cases: Case[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (cases.length === 0) {
    return (
      <div className="sheet p-10 text-center">
        <p className="label-mono">no cases recorded</p>
        <p className="mt-3 text-sm text-muted-foreground">
          The ledger fills as content is submitted. Start on the Moderate page.
        </p>
      </div>
    );
  }

  return (
    <div className="sheet">
      {/* Column headers */}
      <div className="hidden md:grid grid-cols-[92px_1fr_120px_150px_92px_118px_58px_16px] gap-4 px-4 py-2.5 rule-b bg-secondary/50">
        <span className="label-mono">case</span>
        <span className="label-mono">content</span>
        <span className="label-mono">category</span>
        <span className="label-mono">measurement</span>
        <span className="label-mono">verdict</span>
        <span className="label-mono">status</span>
        <span className="label-mono text-right">app.</span>
        <span />
      </div>

      <ul>
        {cases.map((c) => {
          const open = openId === c.id;
          return (
            <li key={c.id} className="rule-b last:border-b-0">
              <button
                onClick={() => setOpenId(open ? null : c.id)}
                className="relative w-full text-left px-4 py-3.5 transition-colors hover:bg-secondary/60 md:grid md:grid-cols-[92px_1fr_120px_150px_92px_118px_58px_16px] md:items-center md:gap-4"
                aria-expanded={open}
              >
                {/* id */}
                <span className="data-mono text-xs text-muted-foreground">
                  {c.id}
                </span>

                {/* content preview */}
                <span className="block mt-1 md:mt-0 text-sm leading-snug line-clamp-2 pr-6">
                  {c.content}
                </span>

                {/* category */}
                <span className="hidden md:block data-mono text-xs lowercase text-muted-foreground">
                  {c.primary_category}
                </span>

                {/* measurement */}
                <span className="hidden md:block">
                  <ThresholdRuler confidence={c.confidence} size="sm" />
                  <span className="data-mono text-[11px] text-muted-foreground mt-1 block">
                    {c.confidence}
                  </span>
                </span>

                {/* verdict */}
                <span className="hidden md:block">
                  <VerdictBadge decision={c.decision} />
                </span>

                {/* status */}
                <span className="hidden md:block">
                  <StatusBadge status={c.status} />
                </span>

                {/* appeals */}
                <span className="hidden md:block data-mono text-xs text-right text-muted-foreground">
                  {c.appeals}
                </span>

                {/* Mobile summary */}
                <span className="flex md:hidden items-center gap-2 mt-2.5">
                  <VerdictBadge decision={c.decision} />
                  <StatusBadge status={c.status} />
                  <span className="data-mono text-[11px] text-muted-foreground ml-auto">
                    conf {c.confidence} · app {c.appeals}
                  </span>
                </span>

                <ChevronDown
                  className={`hidden md:block w-4 h-4 text-muted-foreground transition-transform justify-self-end ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>

              {open && <CaseRecord case={c} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CaseRecord({ case: c }: { case: Case }) {
  const { data: reviews, isLoading } = useCaseReviews(c.id);
  const { data: history } = useCaseHistory(c.id);
  const categories = parseCategories(c.categories_json);

  return (
    <div className="animate-fade-in px-4 py-5 bg-secondary/40 border-t border-hairline space-y-6">
      {/* Full content */}
      <div>
        <p className="label-mono mb-2">submitted content</p>
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap border-l-2 border-hairline pl-4">
          {c.content}
        </p>
      </div>

      {/* Measurement + verdict */}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <p className="label-mono mb-3">measurement</p>
          <ThresholdRuler
            confidence={c.confidence}
            decision={c.decision}
            size="lg"
          />
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <span className="label-mono w-full mb-0.5">categories</span>
            {categories.length > 0 ? (
              categories.map((cat) => (
                <span
                  key={cat}
                  className={`data-mono text-xs px-2 py-0.5 border ${
                    cat === c.primary_category
                      ? "border-ink text-ink"
                      : "border-hairline text-muted-foreground"
                  }`}
                >
                  {cat}
                </span>
              ))
            ) : (
              <span className="data-mono text-xs text-muted-foreground">—</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <Meta label="case" value={c.id} />
            <Meta label="community" value={c.community_id} />
            <Meta label="submitter" value={shortAddress(c.submitter)} mono />
            <Meta label="appeals" value={String(c.appeals)} mono />
            <Meta label="created" value={shortTime(c.created_at)} mono />
            <Meta label="updated" value={shortTime(c.updated_at)} mono />
          </div>
        </div>
      </div>

      {/* Reasoning — produced by the validators, compared only on category */}
      <div>
        <p className="label-mono mb-2">
          validator reasoning{" "}
          <span className="text-bronze">— advisory, not consensus-bound</span>
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground border-l-2 border-bronze pl-4 italic">
          {c.reasoning || "—"}
        </p>
      </div>

      {/* Revision history — append-only, nothing is ever overwritten */}
      <div>
        <p className="label-mono mb-2">
          revision history {history ? `(${history.length})` : ""} · append-only
        </p>
        {history && history.length > 0 && (
          <ol className="space-y-2">
            {history.map((rev) => (
              <li
                key={rev.seq}
                className="sheet p-3 flex flex-wrap items-start gap-3"
              >
                <span className="data-mono text-[11px] text-muted-foreground w-6">
                  #{rev.seq}
                </span>
                <span className="label-mono text-ink">{rev.action}</span>
                <VerdictBadge decision={rev.decision} />
                <span className="data-mono text-[11px] text-muted-foreground ml-auto">
                  {shortTime(rev.at)}
                </span>
                {rev.note && (
                  <p className="w-full text-sm leading-relaxed border-l-2 border-hairline pl-3 text-muted-foreground">
                    {rev.action === "human_review" ? "note: " : "argument: "}
                    {rev.note}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Reviews */}
      <div>
        <p className="label-mono mb-2">
          agent reviews {reviews ? `(${reviews.length})` : ""}
        </p>
        {isLoading && (
          <p className="data-mono text-xs text-muted-foreground">loading…</p>
        )}
        {reviews && reviews.length === 0 && (
          <p className="data-mono text-xs text-muted-foreground">
            no reviews yet — first review lands on the Agents page
          </p>
        )}
        {reviews && reviews.length > 0 && (
          <ul className="space-y-2">
            {reviews.map((r, i) => (
              <li key={`${r.reviewer}-${i}`} className="sheet p-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="data-mono text-xs text-muted-foreground">
                    {shortAddress(r.reviewer)}
                  </span>
                  <VerdictBadge decision={r.verdict} />
                  <span
                    className={`label-mono ${
                      r.agreed ? "text-allow" : "text-block"
                    }`}
                  >
                    {r.agreed ? "agreed" : "dissented"}
                  </span>
                  <span className="data-mono text-[11px] text-muted-foreground ml-auto">
                    {shortTime(r.created_at)}
                  </span>
                </div>
                <p className="text-sm mt-2 leading-relaxed">{r.rationale}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="label-mono">{label}</span>
      <span className={mono ? "data-mono" : ""}>{value}</span>
    </div>
  );
}

export function shortAddress(addr: string): string {
  if (!addr) return "—";
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}
