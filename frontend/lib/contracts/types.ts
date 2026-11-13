/**
 * TypeScript types for the Panoptes decentralized content moderation contract
 * (contracts/panoptes.py, deployed on studionet).
 *
 * The contract returns Python dicts/dataclasses which genlayer-js decodes into
 * plain objects or Maps; every raw value is passed through the normalizers
 * below before it reaches the UI.
 */

export type Decision = "ALLOW" | "FLAG" | "BLOCK";
export type CaseStatus = "decided" | "human_review";

export interface Community {
  id: string;
  name: string;
  rules: string;
  creator: string;
  created_at: string;
  total_cases: number;
}

export interface Case {
  id: string;
  community_id: string;
  submitter: string;
  content: string;
  status: CaseStatus;
  decision: Decision;
  primary_category: string;
  categories_json: string;
  confidence: number;
  reasoning: string;
  appeals: number;
  created_at: string;
  updated_at: string;
}

export interface Review {
  reviewer: string;
  verdict: Decision;
  rationale: string;
  agreed: boolean;
  created_at: string;
}

/** One append-only revision of a case (get_case_history). */
export interface CaseRevision {
  seq: number;
  /** "submit" | "appeal" | "flag" | "human_review" */
  action: string;
  decision: Decision;
  primary_category: string;
  confidence: number;
  reasoning: string;
  /** Justification for human_review; appeal argument for appeals; "" otherwise. */
  note: string;
  actor: string;
  at: string;
}

export interface Agent {
  address: string;
  name: string;
  registered_at: string;
  reviews_total: number;
  reviews_agreed: number;
  /** Agreement rate 0-100, computed on-chain. */
  score: number;
}

export interface Stats {
  total_cases: number;
  total_communities: number;
  total_agents: number;
  total_reviews: number;
  allowed: number;
  flagged: number;
  blocked: number;
  appeals: number;
  appeals_overturned: number;
  human_reviews: number;
}

export interface TransactionReceipt {
  status: string;
  hash?: string;
  txId?: string;
  result?: unknown;
  [key: string]: unknown;
}

/** Max appeals allowed by the contract (MAX_APPEALS). */
export const MAX_APPEALS = 3;
/** Max reviews per case (MAX_REVIEWS_PER_CASE). */
export const MAX_REVIEWS_PER_CASE = 32;
/** Contract-side length limits — enforced client-side for fast feedback. */
export const MAX_CONTENT_LEN = 4000;
export const MAX_ARGUMENT_LEN = 2000;
export const MAX_RATIONALE_LEN = 1000;
export const MAX_AGENT_NAME_LEN = 64;
/** Human-review justification length (MAX_NOTE_LEN). */
export const MAX_NOTE_LEN = 1000;
/** Fixed thresholds from the contract — the model never decides, these do. */
export const FLAG_THRESHOLD = 40;
export const BLOCK_THRESHOLD = 70;

// ---------------------------------------------------------------------------
// Normalizers — genlayer-js may hand back Map instances or bigints.
// ---------------------------------------------------------------------------

export function toPlain(value: unknown): Record<string, unknown> {
  if (value instanceof Map) {
    return Object.fromEntries(value.entries()) as Record<string, unknown>;
  }
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

export function toNum(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value !== "") {
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

export function toStr(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return String(value);
  return fallback;
}

export function toBool(value: unknown): boolean {
  return value === true || value === "true" || toNum(value) === 1;
}

/** Convert a raw contract dict-of-structs (or Map) into an array of records. */
export function dictToArray(value: unknown): Record<string, unknown>[] {
  if (value instanceof Map) {
    return Array.from(value.values()).map((v) => toPlain(v));
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map((v) =>
      toPlain(v)
    );
  }
  return [];
}

export function normalizeCommunity(raw: unknown): Community {
  const o = toPlain(raw);
  return {
    id: toStr(o.id),
    name: toStr(o.name),
    rules: toStr(o.rules),
    creator: toStr(o.creator),
    created_at: toStr(o.created_at),
    total_cases: toNum(o.total_cases),
  };
}

export function normalizeCase(raw: unknown): Case {
  const o = toPlain(raw);
  const status = toStr(o.status, "decided");
  const decision = toStr(o.decision, "ALLOW");
  return {
    id: toStr(o.id),
    community_id: toStr(o.community_id),
    submitter: toStr(o.submitter),
    content: toStr(o.content),
    status: (status === "human_review" ? "human_review" : "decided") as CaseStatus,
    decision: (["ALLOW", "FLAG", "BLOCK"].includes(decision)
      ? decision
      : "ALLOW") as Decision,
    primary_category: toStr(o.primary_category, "none"),
    categories_json: toStr(o.categories_json, "[]"),
    confidence: toNum(o.confidence),
    reasoning: toStr(o.reasoning),
    appeals: toNum(o.appeals),
    created_at: toStr(o.created_at),
    updated_at: toStr(o.updated_at),
  };
}

export function normalizeReview(raw: unknown, fallbackReviewer = ""): Review {
  const o = toPlain(raw);
  const verdict = toStr(o.verdict, "ALLOW");
  return {
    reviewer: toStr(o.reviewer, fallbackReviewer),
    verdict: (["ALLOW", "FLAG", "BLOCK"].includes(verdict)
      ? verdict
      : "ALLOW") as Decision,
    rationale: toStr(o.rationale),
    agreed: toBool(o.agreed),
    created_at: toStr(o.created_at),
  };
}

export function normalizeRevision(raw: unknown): CaseRevision {
  const o = toPlain(raw);
  const decision = toStr(o.decision, "ALLOW");
  const action = toStr(o.action, "submit");
  return {
    seq: toNum(o.seq),
    action: ["submit", "appeal", "flag", "human_review"].includes(action)
      ? action
      : "submit",
    decision: (["ALLOW", "FLAG", "BLOCK"].includes(decision)
      ? decision
      : "ALLOW") as Decision,
    primary_category: toStr(o.primary_category, "none"),
    confidence: toNum(o.confidence),
    reasoning: toStr(o.reasoning),
    note: toStr(o.note),
    actor: toStr(o.actor),
    at: toStr(o.at),
  };
}

export function normalizeAgent(raw: unknown, fallbackAddress = ""): Agent {
  const o = toPlain(raw);
  const total = toNum(o.reviews_total);
  const agreed = toNum(o.reviews_agreed);
  return {
    address: toStr(o.address, fallbackAddress),
    name: toStr(o.name),
    registered_at: toStr(o.registered_at),
    reviews_total: total,
    reviews_agreed: agreed,
    // `score` is computed on-chain, but fall back to local math if absent.
    score: o.score !== undefined ? toNum(o.score) : total === 0 ? 0 : Math.floor((agreed * 100) / total),
  };
}

export function normalizeStats(raw: unknown): Stats {
  const o = toPlain(raw);
  return {
    total_cases: toNum(o.total_cases),
    total_communities: toNum(o.total_communities),
    total_agents: toNum(o.total_agents),
    total_reviews: toNum(o.total_reviews),
    allowed: toNum(o.allowed),
    flagged: toNum(o.flagged),
    blocked: toNum(o.blocked),
    appeals: toNum(o.appeals),
    appeals_overturned: toNum(o.appeals_overturned),
    human_reviews: toNum(o.human_reviews),
  };
}

/** Pull the return value out of a write receipt (used for submit_content). */
export function receiptResult(receipt: TransactionReceipt | undefined): unknown {
  if (!receipt) return undefined;
  return receipt.result ?? receipt.decodedResult ?? undefined;
}

/**
 * Distinguish an accepted transaction from a finalized execution, and a
 * failed one from either — the UI must never claim success on a receipt it
 * has not classified.
 */
export type ReceiptOutcome = "finalized" | "accepted" | "failed" | "unknown";

export function receiptOutcome(
  receipt: TransactionReceipt | undefined
): ReceiptOutcome {
  if (!receipt) return "unknown";
  const name = toStr(receipt.statusName ?? receipt.status_name).toUpperCase();
  const status = toNum(receipt.status, -1);
  if (name.includes("FAIL") || name.includes("ERROR") || name.includes("REVERT"))
    return "failed";
  if (name === "FINALIZED" || status === 6) return "finalized";
  if (name === "ACCEPTED" || status === 5) return "accepted";
  if (status === 5 || status === 6) return "accepted";
  return "unknown";
}
