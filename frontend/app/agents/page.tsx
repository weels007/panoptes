"use client";

import { useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { StatusBadge, VerdictBadge } from "@/components/VerdictBadge";
import { shortAddress } from "@/components/CaseLedger";
import { useWallet } from "@/lib/genlayer/wallet";
import type { Agent, Case, Decision } from "@/lib/contracts/types";
import { MAX_RATIONALE_LEN } from "@/lib/contracts/types";
import {
  useAgents,
  useAllCases,
  useRegisterAgent,
  useReviewCase,
} from "@/lib/hooks/usePanoptes";

const VERDICTS: Decision[] = ["ALLOW", "FLAG", "BLOCK"];

export default function AgentsPage() {
  const { address, isConnected } = useWallet();
  const { data: agents } = useAgents();
  const { data: cases } = useAllCases();

  const registered = useMemo(() => {
    if (!address || !agents) return null;
    return (
      agents.find((a) => a.address.toLowerCase() === address.toLowerCase()) ??
      null
    );
  }, [agents, address]);

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-32 md:pt-36 mx-auto max-w-7xl px-5 sm:px-8">
        <header className="border-b border-hairline pb-6">
          <p className="label-mono">reviewer agents · reputation</p>
          <h1 className="mt-3 text-5xl md:text-6xl">The watchers</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Agents are reviewer identities, not validator nodes — the protocol
            handles node staking itself. An agent&apos;s score is the share of
            its reviews that agreed with the contract&apos;s decision. It is
            computed on-chain and cannot be edited.
          </p>
        </header>

        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 mt-10 items-start">
          <RegisterPanel registered={registered} isConnected={isConnected} />
          <ReviewPanel
            registered={registered}
            isConnected={isConnected}
            cases={cases ?? []}
          />
        </div>

        {/* Roster */}
        <section className="mt-14">
          <div className="flex items-baseline justify-between border-b border-hairline pb-3">
            <h2 className="text-3xl">Roster</h2>
            <span className="label-mono">
              {agents?.length ?? 0} registered
            </span>
          </div>

          <div className="sheet mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="bg-secondary/50">
                  <th className="text-left label-mono px-4 py-2.5">agent</th>
                  <th className="text-left label-mono px-4 py-2.5">name</th>
                  <th className="text-left label-mono px-4 py-2.5">registered</th>
                  <th className="text-right label-mono px-4 py-2.5">reviews</th>
                  <th className="text-right label-mono px-4 py-2.5">agreed</th>
                  <th className="text-left label-mono px-4 py-2.5 w-[240px]">
                    score
                  </th>
                </tr>
              </thead>
              <tbody>
                {!agents?.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 label-mono text-center">
                      no agents registered yet
                    </td>
                  </tr>
                )}
                {agents?.map((a) => (
                  <tr key={a.address} className="rule-t">
                    <td className="px-4 py-3 data-mono text-xs text-muted-foreground">
                      {shortAddress(a.address)}
                    </td>
                    <td className="px-4 py-3 text-sm">{a.name}</td>
                    <td className="px-4 py-3 data-mono text-xs text-muted-foreground">
                      {a.registered_at ? a.registered_at.slice(0, 10) : "—"}
                    </td>
                    <td className="px-4 py-3 data-mono text-sm text-right">
                      {a.reviews_total}
                    </td>
                    <td className="px-4 py-3 data-mono text-sm text-right">
                      {a.reviews_agreed}
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBar agent={a} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/* ========================================================================= */
/* Register                                                                   */
/* ========================================================================= */

function RegisterPanel({
  registered,
  isConnected,
}: {
  registered: Agent | null;
  isConnected: boolean;
}) {
  const [name, setName] = useState("");
  const register = useRegisterAgent();

  return (
    <div className="sheet p-6 md:p-7">
      <span className="label-mono">01 · register</span>

      {registered ? (
        <div className="mt-5">
          <p className="text-sm text-muted-foreground">
            This wallet is already on the roster as
          </p>
          <p className="mt-2 text-3xl" style={{ fontFamily: "var(--font-display)" }}>
            {registered.name}
          </p>
          <div className="mt-4 flex items-center gap-4">
            <span className="data-mono text-xs text-muted-foreground">
              {shortAddress(registered.address)}
            </span>
            <span className="data-mono text-sm">
              score {registered.score}
            </span>
          </div>
        </div>
      ) : (
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && isConnected) register.mutate(name.trim());
          }}
        >
          <div>
            <label htmlFor="agent-name" className="label-mono block mb-2">
              agent name
            </label>
            <input
              id="agent-name"
              className="field field-mono"
              placeholder="e.g. Ledger-04"
              maxLength={64}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button
            className="btn-ink w-full"
            disabled={!isConnected || !name.trim() || register.isPending}
          >
            {register.isPending
              ? "registering…"
              : isConnected
                ? "register as reviewer"
                : "connect wallet to register"}
          </button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            One registration per wallet. Your score starts at 0 and becomes the
            agreement rate after your first review.
          </p>
        </form>
      )}
    </div>
  );
}

/* ========================================================================= */
/* Review                                                                     */
/* ========================================================================= */

function ReviewPanel({
  registered,
  isConnected,
  cases,
}: {
  registered: Agent | null;
  isConnected: boolean;
  cases: Case[];
}) {
  const reviewable = useMemo(
    () => cases.slice().reverse().slice(0, 25),
    [cases]
  );
  const [caseId, setCaseId] = useState("");
  const [verdict, setVerdict] = useState<Decision>("ALLOW");
  const [rationale, setRationale] = useState("");
  const review = useReviewCase();

  const effectiveCase = caseId || reviewable[0]?.id || "";
  const target = reviewable.find((c) => c.id === effectiveCase);

  return (
    <div className="sheet p-6 md:p-7">
      <div className="flex items-center justify-between">
        <span className="label-mono">02 · review a case</span>
        <span className="label-mono">one verdict per agent</span>
      </div>

      {!isConnected && (
        <p className="mt-5 text-sm text-muted-foreground">
          Connect a wallet to cast a review. Reading the roster and the ledger
          needs no wallet.
        </p>
      )}

      {isConnected && !registered && (
        <p className="mt-5 text-sm text-muted-foreground">
          This wallet is not registered yet — register first, then review.
        </p>
      )}

      <form
        className="mt-5 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!registered || !effectiveCase) return;
          review.mutate(
            { caseId: effectiveCase, verdict, rationale },
            {
              onSuccess: () => setRationale(""),
            }
          );
        }}
      >
        <div>
          <label htmlFor="review-case" className="label-mono block mb-2">
            case
          </label>
          <select
            id="review-case"
            className="field field-mono"
            value={effectiveCase}
            onChange={(e) => setCaseId(e.target.value)}
            disabled={reviewable.length === 0}
          >
            {reviewable.length === 0 && <option value="">no cases yet</option>}
            {reviewable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} — {c.decision} · {c.content.slice(0, 42)}…
              </option>
            ))}
          </select>
        </div>

        {target && (
          <div className="border border-hairline p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="data-mono text-xs text-muted-foreground">
                {target.id}
              </span>
              <VerdictBadge decision={target.decision} />
              <StatusBadge status={target.status} />
              <span className="data-mono text-[11px] text-muted-foreground ml-auto">
                conf {target.confidence} · {target.primary_category}
              </span>
            </div>
            <p className="text-sm leading-snug line-clamp-3">{target.content}</p>
            <p className="text-xs leading-relaxed text-muted-foreground italic border-l-2 border-bronze pl-3">
              {target.reasoning}
            </p>
          </div>
        )}

        <div>
          <span className="label-mono block mb-2">your verdict</span>
          <div className="flex gap-2">
            {VERDICTS.map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setVerdict(d)}
                className={`flex-1 py-3 label-mono border transition-colors ${
                  verdict === d
                    ? "border-ink bg-secondary"
                    : "border-hairline hover:border-muted-foreground"
                }`}
                style={
                  verdict === d
                    ? {
                        color:
                          d === "ALLOW"
                            ? "var(--allow)"
                            : d === "FLAG"
                              ? "var(--flag)"
                              : "var(--block)",
                      }
                    : undefined
                }
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label htmlFor="rationale" className="label-mono">
              rationale
            </label>
            <span className="data-mono text-[11px] text-muted-foreground">
              {rationale.length}/{MAX_RATIONALE_LEN}
            </span>
          </div>
          <textarea
            id="rationale"
            className="field min-h-24 text-sm"
            placeholder="Why this verdict? Shown on the public record next to your score…"
            value={rationale}
            maxLength={MAX_RATIONALE_LEN}
            onChange={(e) => setRationale(e.target.value)}
          />
        </div>

        <button
          className="btn-bronze w-full"
          disabled={
            !registered || !effectiveCase || !rationale.trim() || review.isPending
          }
        >
          {review.isPending
            ? "recording…"
            : registered
              ? "cast review"
              : "register first"}
        </button>
      </form>
    </div>
  );
}

/* ========================================================================= */
/* Score bar                                                                  */
/* ========================================================================= */

function ScoreBar({ agent }: { agent: Agent }) {
  const score = agent.score;
  const color =
    score >= 80 ? "var(--allow)" : score >= 50 ? "var(--accent)" : "var(--block)";

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 h-2.5 bg-secondary border border-hairline">
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-500"
          style={{ width: `${score}%`, background: color }}
        />
        {/* 50% agreement mark */}
        <div
          className="absolute inset-y-0 w-px bg-hairline"
          style={{ left: "50%" }}
        />
      </div>
      <span className="data-mono text-sm w-9 text-right" style={{ color }}>
        {score}
      </span>
    </div>
  );
}
