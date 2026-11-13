"use client";

import Link from "next/link";
import { getContractAddress } from "@/lib/genlayer/client";
import { Logo } from "./Logo";

export function Footer() {
  const address = getContractAddress();

  return (
    <footer className="mt-24 border-t border-hairline">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <Logo size="sm" />
            <p className="mt-3 text-sm text-muted-foreground max-w-md leading-relaxed">
              Decentralized content moderation on GenLayer. Validators classify,
              the contract decides at fixed thresholds, the ledger remembers.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 md:items-end">
            <span className="label-mono">contract · studionet</span>
            <code className="data-mono text-xs break-all md:text-right">
              {address || "not configured"}
            </code>
            <div className="flex gap-4 mt-2">
              <Link href="/moderate" className="label-mono hover:text-ink">
                moderate
              </Link>
              <Link href="/audit" className="label-mono hover:text-ink">
                audit log
              </Link>
              <Link href="/agents" className="label-mono hover:text-ink">
                agents
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
