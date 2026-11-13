/**
 * Panoptes identity — an open eye set inside the threshold ruler's circle.
 * Panoptes (Πανόπτης): the all-seeing. Rendered as line work so it reads
 * like a proof mark stamped on a ledger.
 */

import React from "react";

export type LogoVariant = "full" | "mark" | "wordmark";
export type LogoSize = "sm" | "md" | "lg";

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
}

const sizeMap = {
  sm: { mark: "w-5 h-5", text: "text-base" },
  md: { mark: "w-7 h-7", text: "text-xl" },
  lg: { mark: "w-10 h-10", text: "text-3xl" },
};

export function LogoMark({ size = "md", className = "" }: LogoProps) {
  const { mark } = sizeMap[size];
  return (
    <svg
      className={`${mark} ${className}`}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Panoptes"
    >
      {/* Outer seal */}
      <circle cx="16" cy="16" r="14.25" stroke="currentColor" strokeWidth="1.5" />
      {/* Eye almond */}
      <path
        d="M2.5 16C6.5 9.6 10.9 6.4 16 6.4S25.5 9.6 29.5 16c-4 6.4-8.4 9.6-13.5 9.6S6.5 22.4 2.5 16Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Iris — bronze, the measured center */}
      <circle cx="16" cy="16" r="5" fill="var(--accent)" />
      <circle cx="16" cy="16" r="2.1" fill="currentColor" />
      {/* Threshold ticks: 40 and 70, the contract's fixed notches */}
      <path
        d="M16 1.5v3M16 27.5v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({
  variant = "full",
  size = "md",
  className = "",
}: LogoProps) {
  const { text } = sizeMap[size];

  const Wordmark = () => (
    <span
      className={`${text} ${className} font-[family-name:var(--font-display)] uppercase`}
      style={{ letterSpacing: "0.14em", lineHeight: 1 }}
    >
      Panoptes
    </span>
  );

  if (variant === "mark") {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <LogoMark size={size} />
      </div>
    );
  }

  if (variant === "wordmark") {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <Wordmark />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <Wordmark />
    </div>
  );
}

export function LogoFull(props: Omit<LogoProps, "variant">) {
  return <Logo {...props} variant="full" />;
}
