"use client";

import { useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CaseLedger } from "@/components/CaseLedger";
import type { CaseStatus, Decision } from "@/lib/contracts/types";
import { useCases, useCommunities } from "@/lib/hooks/usePanoptes";

const PAGE_SIZE = 20;

type DecisionFilter = "ALL" | Decision;
type StatusFilter = "ALL" | CaseStatus;

export default function AuditPage() {
  const [offset, setOffset] = useState(0);
  const [decision, setDecision] = useState<DecisionFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [community, setCommunity] = useState("ALL");
  const [query, setQuery] = useState("");

  const { data: cases, isLoading } = useCases(offset, PAGE_SIZE);
  const { data: communities } = useCommunities();

  // Filters run client-side over the current page (ledger pages are small).
  const filtered = useMemo(() => {
    let list = cases ?? [];
    if (decision !== "ALL") list = list.filter((c) => c.decision === decision);
    if (status !== "ALL") list = list.filter((c) => c.status === status);
    if (community !== "ALL")
      list = list.filter((c) => c.community_id === community);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.content.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.primary_category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [cases, decision, status, community, query]);

  const hasFilters =
    decision !== "ALL" ||
    status !== "ALL" ||
    community !== "ALL" ||
    query.trim() !== "";

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-32 md:pt-36 mx-auto max-w-7xl px-5 sm:px-8">
        <header className="border-b border-hairline pb-6 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="label-mono">public audit log · append-only</p>
            <h1 className="mt-3 text-5xl md:text-6xl">The ledger</h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              Every case, every measurement, every reasoning trace, every
              overturn. Click a row to open the full record.
            </p>
          </div>
          <div className="data-mono text-sm text-muted-foreground">
            {isLoading ? "loading…" : `${filtered.length} shown`}
          </div>
        </header>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <input
            className="field field-mono max-w-64"
            placeholder="search content or case id…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOffset(0);
            }}
            aria-label="Search cases"
          />

          <FilterGroup<DecisionFilter>
            label="verdict"
            value={decision}
            onChange={(v) => {
              setDecision(v);
              setOffset(0);
            }}
            options={[
              { value: "ALL", label: "all" },
              { value: "ALLOW", label: "allow" },
              { value: "FLAG", label: "flag" },
              { value: "BLOCK", label: "block" },
            ]}
          />

          <FilterGroup<StatusFilter>
            label="status"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setOffset(0);
            }}
            options={[
              { value: "ALL", label: "all" },
              { value: "decided", label: "decided" },
              { value: "human_review", label: "human review" },
            ]}
          />

          <select
            className="field field-mono max-w-56"
            value={community}
            onChange={(e) => {
              setCommunity(e.target.value);
              setOffset(0);
            }}
            aria-label="Filter by community"
          >
            <option value="ALL">all communities</option>
            {communities?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              className="btn-ghost"
              onClick={() => {
                setDecision("ALL");
                setStatus("ALL");
                setCommunity("ALL");
                setQuery("");
                setOffset(0);
              }}
            >
              clear
            </button>
          )}
        </div>

        {/* Ledger */}
        <div className="mt-6">
          <CaseLedger cases={filtered} />
        </div>

        {/* Pagination */}
        <div className="mt-5 flex items-center justify-between">
          <button
            className="btn-ghost"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            ← older
          </button>
          <span className="data-mono text-xs text-muted-foreground">
            cases {offset + 1}–{offset + (cases?.length ?? 0)} · page{" "}
            {Math.floor(offset / PAGE_SIZE) + 1}
          </span>
          <button
            className="btn-ghost"
            disabled={(cases?.length ?? 0) < PAGE_SIZE}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            newer →
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex items-center border border-hairline bg-card">
      <span className="label-mono px-3 border-r border-hairline">{label}</span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-2.5 label-mono transition-colors ${
            value === opt.value
              ? "bg-ink text-porcelain"
              : "hover:bg-secondary"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
