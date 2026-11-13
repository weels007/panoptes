"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountPanel } from "./AccountPanel";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/moderate", label: "Moderate" },
  { href: "/audit", label: "Audit Log" },
  { href: "/agents", label: "Agents" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-porcelain/92 backdrop-blur-md border-b border-hairline">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 text-ink">
            <Logo size="md" />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {LINKS.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`label-mono px-3 py-2 transition-colors hover:text-ink ${
                    active ? "text-ink" : ""
                  }`}
                  style={
                    active
                      ? { boxShadow: "inset 0 -2px 0 0 var(--accent)" }
                      : undefined
                  }
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <AccountPanel />
          </div>
        </div>
      </div>

      {/* Mobile nav row */}
      <nav className="md:hidden flex items-center gap-1 px-5 pb-2 -mt-1">
        {LINKS.map((link) => {
          const active =
            pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`label-mono px-3 py-1.5 ${
                active
                  ? "text-ink"
                  : "text-muted-foreground"
              }`}
              style={
                active
                  ? { boxShadow: "inset 0 -2px 0 0 var(--accent)" }
                  : undefined
              }
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
