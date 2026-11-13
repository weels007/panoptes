"use client";

import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ThresholdRuler } from "@/components/ThresholdRuler";
import { VerdictGrid, StatLedger } from "@/components/Stats";
import { StatusBadge, VerdictBadge } from "@/components/VerdictBadge";
import { useAllCases, useStats } from "@/lib/hooks/usePanoptes";

const MECHANICS = [
  {
    n: "01",
    title: "Submit",
    body: "Content enters a community with written rules. The submitter puts skin in the game: only they can appeal the result.",
  },
  {
    n: "02",
    title: "Consensus",
    body: "Every validator re-classifies independently under Optimistic Democracy. Consensus requires agreement on the category and the derived decision — reasoning is never compared, only the finding.",
  },
  {
    n: "03",
    title: "Threshold",
    body: "The model reports a confidence; the contract converts it. Up to 40 is ALLOW, up to 70 is FLAG, above 70 is BLOCK. No prompt can move these notches.",
  },
];

export default function Home() {
  const { data: stats } = useStats();
  const { data: cases } = useAllCases();

  const latest = cases && cases.length > 0 ? cases[cases.length - 1] : null;
  const recent = cases ? cases.slice(-5).reverse() : [];

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-28 md:pt-32">
        {/* ---------------------------------------------------------------- */}
        {/* Hero                                                              */}
        {/* ---------------------------------------------------------------- */}
        <section className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-start">
            <div className="animate-fade-in">
              <p className="label-mono">
                genlayer · optimistic democracy · content moderation
              </p>

              <h1
                className="mt-6 text-[13vw] leading-[0.92] sm:text-6xl lg:text-7xl tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Many eyes.
                <br />
                <span style={{ color: "var(--accent)", fontStyle: "italic" }}>
                  Fixed thresholds.
                </span>
                <br />
                One public record.
              </h1>

              <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
                Panoptes runs content past a committee of AI validators. The
                model only reports a confidence — the{" "}
                <span className="text-foreground">contract</span> turns it into
                ALLOW, FLAG, or BLOCK at 40 and 70, then writes every verdict to
                an audit log nobody can quietly edit.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/moderate" className="btn-ink">
                  Submit content
                </Link>
                <Link href="/audit" className="btn-ghost">
                  Open the audit log
                </Link>
              </div>
            </div>

            {/* Instrument panel */}
            <div className="sheet p-6 animate-slide-up">
              <div className="flex items-center justify-between">
                <span className="label-mono">threshold instrument</span>
                <span className="label-mono text-ink">
                  {latest ? latest.id : "no case"}
                </span>
              </div>

              <div className="mt-5">
                <ThresholdRuler
                  confidence={latest ? latest.confidence : 0}
                  decision={latest?.decision}
                  size="lg"
                />
              </div>

              <div className="mt-7 pt-5 border-t border-hairline">
                <div className="flex items-center justify-between mb-4">
                  <span className="label-mono">the ledger, one mark per case</span>
                  <span className="data-mono text-xs">
                    {cases?.length ?? 0}
                  </span>
                </div>
                <VerdictGrid cases={cases ?? []} />
              </div>

              <div className="mt-6 pt-4 border-t border-hairline flex flex-wrap gap-4">
                <Legend color="var(--allow)" label="allow ≤ 40" />
                <Legend color="var(--flag)" label="flag 41–70" />
                <Legend color="var(--block)" label="block > 70" />
                <Legend color="var(--accent)" label="human review" />
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Stats                                                             */}
        {/* ---------------------------------------------------------------- */}
        {stats && (
          <section className="mx-auto max-w-7xl px-5 sm:px-8 mt-16">
            <StatLedger stats={stats} />
          </section>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Mechanics                                                         */}
        {/* ---------------------------------------------------------------- */}
        <section className="mx-auto max-w-7xl px-5 sm:px-8 mt-24">
          <div className="flex items-baseline justify-between border-b border-hairline pb-3">
            <h2 className="text-3xl">How a verdict is made</h2>
            <span className="label-mono">three steps, zero discretion</span>
          </div>

          <div className="grid md:grid-cols-3">
            {MECHANICS.map((m) => (
              <div
                key={m.n}
                className="py-8 md:pr-8 md:border-r border-hairline md:pl-0 pl-0 pr-0 [&:not(:first-child)]:md:pl-8 [&:not(:last-child)]:border-b md:[&:not(:last-child)]:border-b-0"
              >
                <span className="data-mono text-sm text-bronze">{m.n}</span>
                <h3 className="mt-3 text-2xl">{m.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {m.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Appeal + human review                                             */}
        {/* ---------------------------------------------------------------- */}
        <section className="mx-auto max-w-7xl px-5 sm:px-8 mt-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="sheet p-7">
              <span className="label-mono">appeal · max 3</span>
              <h3 className="mt-3 text-2xl">The submitter gets a rebuttal</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                An appeal re-runs classification with the argument in context.
                If the verdict flips, the contract records the overturn and
                re-syncs every agent review against the new decision.
              </p>
            </div>
            <div className="sheet p-7">
              <span className="label-mono">human-in-the-loop</span>
              <h3 className="mt-3 text-2xl">A person can still overrule</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                A community creator can pull any case into human review and
                settle it with a final decision. The override is written to the
                same public ledger as the machine verdicts.
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Recent cases                                                      */}
        {/* ---------------------------------------------------------------- */}
        <section className="mx-auto max-w-7xl px-5 sm:px-8 mt-24">
          <div className="flex items-baseline justify-between border-b border-hairline pb-3">
            <h2 className="text-3xl">Latest on the ledger</h2>
            <Link href="/audit" className="label-mono hover:text-ink">
              see all →
            </Link>
          </div>

          <ul className="sheet mt-6">
            {recent.length === 0 && (
              <li className="px-4 py-6 label-mono text-center">
                nothing recorded yet
              </li>
            )}
            {recent.map((c) => (
              <li key={c.id} className="rule-b last:border-b-0">
                <Link
                  href="/audit"
                  className="flex flex-wrap items-center gap-4 px-4 py-3.5 hover:bg-secondary/60 transition-colors"
                >
                  <span className="data-mono text-xs text-muted-foreground w-[92px]">
                    {c.id}
                  </span>
                  <span className="flex-1 min-w-[200px] text-sm line-clamp-1">
                    {c.content}
                  </span>
                  <span className="data-mono text-xs text-muted-foreground hidden sm:block">
                    {c.confidence}
                  </span>
                  <VerdictBadge decision={c.decision} />
                  <StatusBadge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 label-mono">
      <span
        className="w-3 h-3"
        style={{ background: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}
