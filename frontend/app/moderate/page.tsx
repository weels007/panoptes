"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ThresholdRuler } from "@/components/ThresholdRuler";
import { StatusBadge, VerdictBadge } from "@/components/VerdictBadge";
import { shortAddress } from "@/components/CaseLedger";
import { useWallet } from "@/lib/genlayer/wallet";
import type { FeePresetLevel } from "@/lib/genlayer/fees";
import type { Case, Community, Decision } from "@/lib/contracts/types";
import {
  MAX_APPEALS,
  MAX_ARGUMENT_LEN,
  MAX_CONTENT_LEN,
  MAX_NOTE_LEN,
} from "@/lib/contracts/types";
import {
  useAppealCase,
  useAllCases,
  useCommunities,
  useFlagForHumanReview,
  useResolveHumanReview,
  useSubmitContent,
  useCase,
} from "@/lib/hooks/usePanoptes";

const FEE_LEVELS: { value: FeePresetLevel; label: string; hint: string }[] = [
  { value: "low", label: "low", hint: "0 appeal rounds" },
  { value: "standard", label: "standard", hint: "1 appeal round" },
  { value: "high", label: "high", hint: "2 appeal rounds" },
];

export default function ModeratePage() {
  const { address, isConnected } = useWallet();
  const { data: communities } = useCommunities();
  // All ledger pages — older cases remain reachable for appeals.
  const { data: cases } = useAllCases();

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-32 md:pt-36 mx-auto max-w-7xl px-5 sm:px-8">
        <header className="border-b border-hairline pb-6">
          <p className="label-mono">moderation desk</p>
          <h1 className="mt-3 text-5xl md:text-6xl">
            Submit, appeal, overrule.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Content is classified by the validator set under consensus. The
            verdict is derived from fixed thresholds — 40 and 70 — written into
            the contract. Everything below writes to the public ledger.
          </p>
        </header>

        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-8 mt-10 items-start">
          <SubmitPanel
            communities={communities ?? []}
            isConnected={isConnected}
          />
          <YourRecord
            address={address}
            isConnected={isConnected}
            cases={cases ?? []}
          />
        </div>

        <CreatorDesk
          address={address}
          isConnected={isConnected}
          communities={communities ?? []}
          cases={cases ?? []}
        />
      </main>

      <Footer />
    </div>
  );
}

/* ========================================================================= */
/* Submit                                                                     */
/* ========================================================================= */

function SubmitPanel({
  communities,
  isConnected,
}: {
  communities: Community[];
  isConnected: boolean;
}) {
  const [communityId, setCommunityId] = useState("");
  const [content, setContent] = useState("");
  const [feeLevel, setFeeLevel] = useState<FeePresetLevel>("standard");
  const [lastCaseId, setLastCaseId] = useState<string | null>(null);

  const { data: lastCase } = useCase(lastCaseId);
  const submit = useSubmitContent();

  const selected =
    communities.find((c) => c.id === communityId) ?? communities[0];
  const effectiveId = selected?.id ?? "";

  const canSubmit =
    isConnected && !!effectiveId && content.trim().length > 0 && !submit.isSubmitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    submit.mutate(
      { communityId: effectiveId, content, feePresetLevel: feeLevel },
      {
        onSuccess: ({ caseId }) => {
          setLastCaseId(caseId);
          setContent("");
        },
        // Fallback: receipt had no case id — the ledger still refreshes.
        onError: () => setLastCaseId(null),
      }
    );
  };

  return (
    <div className="sheet p-6 md:p-7">
      <div className="flex items-center justify-between">
        <span className="label-mono">01 · submit content</span>
        <span className="label-mono">write · consensus required</span>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        {/* Community */}
        <div>
          <label htmlFor="community" className="label-mono block mb-2">
            community
          </label>
          <select
            id="community"
            className="field field-mono"
            value={effectiveId}
            onChange={(e) => setCommunityId(e.target.value)}
            disabled={communities.length === 0}
          >
            {communities.length === 0 && (
              <option value="">no communities yet</option>
            )}
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.id}
              </option>
            ))}
          </select>
          {selected && (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground border-l-2 border-bronze pl-3">
              {selected.rules}
            </p>
          )}
        </div>

        {/* Content */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label htmlFor="content" className="label-mono">
              content
            </label>
            <span className="data-mono text-[11px] text-muted-foreground">
              {content.length}/{MAX_CONTENT_LEN}
            </span>
          </div>
          <textarea
            id="content"
            className="field min-h-40 resize-y"
            placeholder="Paste the post, message, or caption you want adjudicated…"
            value={content}
            maxLength={MAX_CONTENT_LEN}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        {/* Fee policy */}
        <div>
          <span className="label-mono block mb-2">fee policy</span>
          <div className="flex gap-2">
            {FEE_LEVELS.map((level) => (
              <button
                type="button"
                key={level.value}
                onClick={() => setFeeLevel(level.value)}
                className={`flex-1 px-3 py-2.5 border text-left transition-colors ${
                  feeLevel === level.value
                    ? "border-ink bg-secondary"
                    : "border-hairline hover:border-muted-foreground"
                }`}
              >
                <span className="data-mono text-xs block uppercase tracking-wider">
                  {level.label}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {level.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button type="submit" className="btn-ink w-full" disabled={!canSubmit}>
          {submit.isSubmitting
            ? "awaiting consensus…"
            : isConnected
              ? "submit to consensus"
              : "connect wallet to submit"}
        </button>

        {!isConnected && (
          <p className="data-mono text-[11px] text-muted-foreground text-center">
            reads are public; writes need a wallet
          </p>
        )}
      </form>

      {/* Result — the measurement that produced the verdict */}
      {lastCase && (
        <div className="mt-6 pt-6 border-t border-hairline animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="label-mono">your latest submission</span>
            <span className="data-mono text-xs">{lastCase.id}</span>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <VerdictBadge decision={lastCase.decision} />
            <StatusBadge status={lastCase.status} />
            <span className="data-mono text-xs text-muted-foreground ml-auto">
              {lastCase.primary_category}
            </span>
          </div>

          <div className="mt-4">
            <ThresholdRuler
              confidence={lastCase.confidence}
              decision={lastCase.decision}
              size="lg"
            />
          </div>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground italic border-l-2 border-bronze pl-3">
            {lastCase.reasoning}
          </p>

          <Link href="/audit" className="btn-ghost mt-5 w-full">
            inspect in audit log
          </Link>
        </div>
      )}
    </div>
  );
}

/* ========================================================================= */
/* Your record — appeals                                                      */
/* ========================================================================= */

function YourRecord({
  address,
  isConnected,
  cases,
}: {
  address: string | null;
  isConnected: boolean;
  cases: Case[];
}) {
  const mine = useMemo(
    () =>
      cases
        .filter(
          (c) =>
            address && c.submitter.toLowerCase() === address.toLowerCase()
        )
        .slice()
        .reverse(),
    [cases, address]
  );

  return (
    <div className="sheet p-6 md:p-7">
      <div className="flex items-center justify-between">
        <span className="label-mono">02 · your submissions</span>
        <span className="label-mono">appeal · max {MAX_APPEALS}</span>
      </div>

      {!isConnected && (
        <p className="mt-5 text-sm text-muted-foreground">
          Connect a wallet to see the cases you submitted and appeal any verdict
          you disagree with.
        </p>
      )}

      {isConnected && mine.length === 0 && (
        <p className="mt-5 text-sm text-muted-foreground">
          Nothing submitted from this address yet. Your cases and their appeal
          buttons will appear here.
        </p>
      )}

      <ul className="mt-5 space-y-4">
        {mine.map((c) => (
          <AppealCard key={c.id} case={c} />
        ))}
      </ul>
    </div>
  );
}

function AppealCard({ case: c }: { case: Case }) {
  const [open, setOpen] = useState(false);
  const [argument, setArgument] = useState("");
  const appeal = useAppealCase();

  const eligible =
    c.status !== "human_review" && c.appeals < MAX_APPEALS;

  return (
    <li className="border border-hairline p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="data-mono text-xs text-muted-foreground">{c.id}</span>
        <VerdictBadge decision={c.decision} />
        <StatusBadge status={c.status} />
        <span className="data-mono text-[11px] text-muted-foreground ml-auto">
          appeals {c.appeals}/{MAX_APPEALS}
        </span>
      </div>

      <p className="mt-2.5 text-sm leading-snug line-clamp-2">{c.content}</p>

      {eligible ? (
        <>
          <button
            className="btn-ghost mt-3"
            onClick={() => setOpen((v) => !v)}
            disabled={appeal.isPending}
          >
            {open ? "cancel" : "appeal this verdict"}
          </button>

          {open && (
            <div className="mt-3 space-y-3 animate-fade-in">
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="label-mono">your argument</span>
                  <span className="data-mono text-[11px] text-muted-foreground">
                    {argument.length}/{MAX_ARGUMENT_LEN}
                  </span>
                </div>
                <textarea
                  className="field min-h-24 text-sm"
                  placeholder="Explain why the classification is wrong. It is re-run with your argument in context…"
                  value={argument}
                  maxLength={MAX_ARGUMENT_LEN}
                  onChange={(e) => setArgument(e.target.value)}
                />
              </div>
              <button
                className="btn-bronze w-full"
                disabled={appeal.isPending || argument.trim().length === 0}
                onClick={() =>
                  appeal.mutate(
                    { caseId: c.id, argument },
                    {
                      onSuccess: () => {
                        setOpen(false);
                        setArgument("");
                      },
                    }
                  )
                }
              >
                {appeal.isPending ? "re-classifying…" : "file appeal"}
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="mt-3 label-mono">
          {c.status === "human_review"
            ? "under human review"
            : "appeal limit reached"}
        </p>
      )}
    </li>
  );
}

/* ========================================================================= */
/* Creator desk — human-in-the-loop                                           */
/* ========================================================================= */

function CreatorDesk({
  address,
  isConnected,
  communities,
  cases,
}: {
  address: string | null;
  isConnected: boolean;
  communities: Community[];
  cases: Case[];
}) {
  const mine = useMemo(() => {
    if (!address) return [];
    return communities.filter(
      (c) => c.creator.toLowerCase() === address.toLowerCase()
    );
  }, [communities, address]);

  if (!isConnected) return null;

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between border-b border-hairline pb-3">
        <h2 className="text-3xl">Creator review desk</h2>
        <span className="label-mono">human-in-the-loop</span>
      </div>

      {mine.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">
          This wallet has not created a community, so there is no manual review
          authority here. Appeals still work above — anyone can appeal their
          own case.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {mine.map((community) => {
            const communityCases = cases
              .filter((c) => c.community_id === community.id)
              .slice()
              .reverse();
            return (
              <div key={community.id} className="sheet">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 rule-b bg-secondary/50">
                  <div>
                    <span className="text-lg" style={{ fontFamily: "var(--font-display)" }}>
                      {community.name}
                    </span>
                    <span className="data-mono text-xs text-muted-foreground ml-3">
                      {community.id}
                    </span>
                  </div>
                  <span className="label-mono">
                    {communityCases.length} cases
                  </span>
                </div>

                <ul>
                  {communityCases.length === 0 && (
                    <li className="px-5 py-5 label-mono">no cases yet</li>
                  )}
                  {communityCases.map((c) => (
                    <ReviewRow key={c.id} case={c} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ReviewRow({ case: c }: { case: Case }) {
  const flag = useFlagForHumanReview();
  const resolve = useResolveHumanReview();
  const [note, setNote] = useState("");

  const needsNote = c.status === "human_review";
  const canResolve = note.trim().length > 0 && note.length <= MAX_NOTE_LEN;

  return (
    <li className="px-5 py-4 rule-b last:border-b-0">
      <div className="flex flex-wrap items-center gap-3">
        <span className="data-mono text-xs text-muted-foreground w-[84px]">
          {c.id}
        </span>
        <span className="flex-1 min-w-[180px] text-sm line-clamp-1">
          {c.content}
        </span>
        <VerdictBadge decision={c.decision} />
        <StatusBadge status={c.status} />

        {!needsNote && (
          <div className="ml-auto">
            <button
              className="btn-ghost"
              disabled={flag.isPending}
              onClick={() => flag.mutate(c.id)}
            >
              {flag.isPending ? "flagging…" : "flag for human review"}
            </button>
          </div>
        )}
      </div>

      {needsNote && (
        <div className="mt-3 space-y-3 animate-fade-in">
          {/* A third-party decision must store its justification (on-chain). */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="label-mono">resolution note (required)</span>
              <span className="data-mono text-[11px] text-muted-foreground">
                {note.length}/{MAX_NOTE_LEN}
              </span>
            </div>
            <textarea
              className="field min-h-20 text-sm"
              placeholder="Why this final decision? Stored on the public ledger with your override…"
              value={note}
              maxLength={MAX_NOTE_LEN}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["ALLOW", "FLAG", "BLOCK"] as Decision[]).map((d) => (
              <button
                key={d}
                className="btn-ink"
                style={
                  d === "ALLOW"
                    ? { background: "var(--allow)", borderColor: "var(--allow)" }
                    : d === "FLAG"
                      ? { background: "var(--flag)", borderColor: "var(--flag)" }
                      : { background: "var(--block)", borderColor: "var(--block)" }
                }
                disabled={resolve.isPending || !canResolve}
                onClick={() =>
                  resolve.mutate(
                    { caseId: c.id, finalDecision: d, note: note.trim() },
                    { onSuccess: () => setNote("") }
                  )
                }
              >
                {resolve.isPending ? "resolving…" : `resolve ${d}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}
