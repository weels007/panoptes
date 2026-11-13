"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import Panoptes from "../contracts/Panoptes";
import { getContractAddress, getStudioUrl } from "../genlayer/client";
import type { FeePresetLevel } from "../genlayer/fees";
import { useWallet } from "../genlayer/wallet";
import { success, error as errorToast, warning, configError } from "../utils/toast";
import type {
  Agent,
  Case,
  CaseRevision,
  Community,
  Decision,
  ReceiptOutcome,
  Review,
  Stats,
  TransactionReceipt,
} from "../contracts/types";
import { receiptOutcome } from "../contracts/types";

const READ_PAGE = 50;
/** How often / how long a mutation re-reads state before declaring success. */
const VERIFY_ATTEMPTS = 5;
const VERIFY_DELAY_MS = 3000;

/**
 * Contract instance for Panoptes. Recreated when the wallet address changes so
 * writes are signed by the connected account. Reads work without a wallet.
 */
export function usePanoptesContract(): Panoptes | null {
  const { address } = useWallet();
  const contractAddress = getContractAddress();
  const studioUrl = getStudioUrl();

  return useMemo(() => {
    if (!contractAddress) {
      configError(
        "Setup Required",
        "Contract address not configured. Set NEXT_PUBLIC_CONTRACT_ADDRESS in frontend/.env.local."
      );
      return null;
    }
    return new Panoptes(contractAddress, address, studioUrl);
  }, [contractAddress, address, studioUrl]);
}

// ---------------------------------------------------------------------------
// Readback verification — a receipt is not proof the state changed.
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Re-read on-chain state until `ok` passes. Returns the verified value, or
 * null when the state never became visible (undetermined / lost consensus).
 */
async function verifyReadback<T>(
  read: () => Promise<T>,
  ok: (value: T) => boolean,
  attempts = VERIFY_ATTEMPTS
): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const value = await read();
      if (ok(value)) return value;
    } catch {
      // State not visible yet — keep polling.
    }
    if (i < attempts - 1) await sleep(VERIFY_DELAY_MS);
  }
  return null;
}

/** Classify the receipt and report the outcome consistently. */
function outcomeLabel(outcome: ReceiptOutcome): string {
  return outcome === "finalized" ? "finalized" : "accepted";
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function useStats() {
  const contract = usePanoptesContract();
  return useQuery<Stats, Error>({
    queryKey: ["panoptes", "stats"],
    queryFn: () => contract!.getStats(),
    enabled: !!contract,
    staleTime: 2000,
    refetchOnWindowFocus: true,
  });
}

export function useCommunities() {
  const contract = usePanoptesContract();
  return useQuery<Community[], Error>({
    queryKey: ["panoptes", "communities"],
    queryFn: () => contract!.listCommunities(0, READ_PAGE),
    enabled: !!contract,
    staleTime: 5000,
  });
}

export function useCases(offset = 0, limit = 20) {
  const contract = usePanoptesContract();
  return useQuery<Case[], Error>({
    queryKey: ["panoptes", "cases", offset, limit],
    queryFn: () => contract!.listCases(offset, limit),
    enabled: !!contract,
    staleTime: 2000,
    refetchOnWindowFocus: true,
  });
}

/**
 * EVERY case in the ledger, paged through until a short page — used for
 * "your submissions" so old cases stay reachable for appeals.
 */
export function useAllCases() {
  const contract = usePanoptesContract();
  return useQuery<Case[], Error>({
    queryKey: ["panoptes", "cases", "all"],
    queryFn: async () => {
      const all: Case[] = [];
      let offset = 0;
      for (;;) {
        const page = await contract!.listCases(offset, READ_PAGE);
        all.push(...page);
        if (page.length < READ_PAGE) break;
        offset += READ_PAGE;
        if (offset > 5000) break; // hard stop
      }
      return all;
    },
    enabled: !!contract,
    staleTime: 2000,
    refetchOnWindowFocus: true,
  });
}

export function useCase(caseId: string | null) {
  const contract = usePanoptesContract();
  return useQuery<Case, Error>({
    queryKey: ["panoptes", "case", caseId],
    queryFn: () => contract!.getCase(caseId!),
    enabled: !!contract && !!caseId,
    staleTime: 2000,
  });
}

export function useCaseReviews(caseId: string | null) {
  const contract = usePanoptesContract();
  return useQuery<Review[], Error>({
    queryKey: ["panoptes", "reviews", caseId],
    queryFn: () => contract!.getCaseReviews(caseId!),
    enabled: !!contract && !!caseId,
    staleTime: 2000,
  });
}

export function useCaseHistory(caseId: string | null) {
  const contract = usePanoptesContract();
  return useQuery<CaseRevision[], Error>({
    queryKey: ["panoptes", "history", caseId],
    queryFn: () => contract!.getCaseHistory(caseId!),
    enabled: !!contract && !!caseId,
    staleTime: 2000,
  });
}

export function useAgents() {
  const contract = usePanoptesContract();
  return useQuery<Agent[], Error>({
    queryKey: ["panoptes", "agents"],
    queryFn: () => contract!.listAgents(0, READ_PAGE),
    enabled: !!contract,
    staleTime: 5000,
  });
}

// ---------------------------------------------------------------------------
// Writes — every mutation: receipt -> classify -> READBACK -> then toast.
// ---------------------------------------------------------------------------

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["panoptes"] });
  };
}

function requireContract(contract: Panoptes | null, address: string | null, action: string) {
  if (!contract) {
    throw new Error(
      "Contract not configured. Set NEXT_PUBLIC_CONTRACT_ADDRESS in frontend/.env.local."
    );
  }
  if (!address) {
    throw new Error(`Wallet not connected. Connect your wallet to ${action}.`);
  }
}

export function useSubmitContent() {
  const contract = usePanoptesContract();
  const { address } = useWallet();
  const invalidate = useInvalidate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({
      communityId,
      content,
      feePresetLevel,
    }: {
      communityId: string;
      content: string;
      feePresetLevel?: FeePresetLevel;
    }): Promise<{ caseId: string | null; outcome: ReceiptOutcome; verified: boolean }> => {
      requireContract(contract, address, "submit content");
      setIsSubmitting(true);
      const receipt = await contract!.submitContent(
        communityId,
        content,
        feePresetLevel ?? "standard"
      );
      const outcome = receiptOutcome(receipt);
      if (outcome === "failed") {
        throw new Error("Transaction failed on-chain — nothing was recorded.");
      }

      // Readback: locate the new case and confirm it carries our content.
      let caseId = Panoptes.caseIdFromReceipt(receipt);
      const found = await verifyReadback(
        async () => {
          if (caseId) {
            try {
              const c = await contract!.getCase(caseId);
              if (c.content === content) return c;
            } catch {
              caseId = null; // receipt id was wrong — fall back to search
            }
          }
          // Fallback: newest case by this submitter with this exact content.
          const cases = await contract!.listCases(0, READ_PAGE);
          const matches = cases.filter(
            (c) =>
              c.submitter.toLowerCase() === address!.toLowerCase() &&
              c.content === content
          );
          return matches.length > 0 ? matches[matches.length - 1] : null;
        },
        (c) => !!c && !!c.decision
      );

      if (!found) {
        return { caseId, outcome, verified: false };
      }
      return { caseId: found.id, outcome, verified: true };
    },
    onSuccess: ({ caseId, outcome, verified }) => {
      setIsSubmitting(false);
      invalidate();
      if (!verified) {
        warning("Transaction submitted — state not yet visible", {
          description:
            "The receipt was accepted but the case could not be read back yet. It may still be finalizing; check the audit log shortly.",
        });
        return;
      }
      success(`Content submitted (${outcomeLabel(outcome)})`, {
        description: caseId
          ? `Case ${caseId} is on the ledger and was verified by readback.`
          : "The case is on the ledger and was verified by readback.",
      });
    },
    onError: (err: any) => {
      setIsSubmitting(false);
      errorToast("Submission failed", {
        description: err?.message || "Please try again.",
      });
    },
  });

  return {
    ...mutation,
    isSubmitting,
    submitContent: mutation.mutate,
    submitContentAsync: mutation.mutateAsync,
  };
}

export function useAppealCase() {
  const contract = usePanoptesContract();
  const { address } = useWallet();
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: async ({
      caseId,
      argument,
      feePresetLevel,
    }: {
      caseId: string;
      argument: string;
      feePresetLevel?: FeePresetLevel;
    }): Promise<{ outcome: ReceiptOutcome; verified: boolean }> => {
      requireContract(contract, address, "appeal a case");
      const before = await contract!.getCase(caseId);
      const receipt = await contract!.appealCase(
        caseId,
        argument,
        feePresetLevel ?? "standard"
      );
      const outcome = receiptOutcome(receipt);
      if (outcome === "failed") {
        throw new Error("Transaction failed on-chain — the appeal was not recorded.");
      }

      // Readback: the appeal counter must have advanced.
      const after = await verifyReadback(
        () => contract!.getCase(caseId),
        (c) => Number(c.appeals) > Number(before.appeals)
      );
      return { outcome, verified: !!after };
    },
    onSuccess: ({ outcome, verified }) => {
      invalidate();
      if (!verified) {
        warning("Appeal submitted — state not yet visible", {
          description:
            "Receipt accepted, but the appeal count has not changed on-chain yet. Check the audit log shortly.",
        });
        return;
      }
      success(`Appeal recorded (${outcomeLabel(outcome)})`, {
        description: "The case was re-classified with your argument in context — verified by readback.",
      });
    },
    onError: (err: any) => {
      errorToast("Appeal failed", { description: err?.message || "Please try again." });
    },
  });
}

export function useFlagForHumanReview() {
  const contract = usePanoptesContract();
  const { address } = useWallet();
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: async (
      caseId: string
    ): Promise<{ outcome: ReceiptOutcome; verified: boolean }> => {
      requireContract(contract, address, "flag a case");
      const receipt = await contract!.flagForHumanReview(caseId);
      const outcome = receiptOutcome(receipt);
      if (outcome === "failed") {
        throw new Error("Transaction failed on-chain — the case was not flagged.");
      }
      const after = await verifyReadback(
        () => contract!.getCase(caseId),
        (c) => c.status === "human_review"
      );
      return { outcome, verified: !!after };
    },
    onSuccess: ({ outcome, verified }) => {
      invalidate();
      if (!verified) {
        warning("Flag submitted — state not yet visible", {
          description: "Receipt accepted; the status has not changed on-chain yet.",
        });
        return;
      }
      success(`Case flagged for human review (${outcomeLabel(outcome)})`, {
        description: "Verified by readback — the community creator can now resolve it.",
      });
    },
    onError: (err: any) => {
      errorToast("Flag failed", { description: err?.message || "Please try again." });
    },
  });
}

export function useResolveHumanReview() {
  const contract = usePanoptesContract();
  const { address } = useWallet();
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: async ({
      caseId,
      finalDecision,
      note,
    }: {
      caseId: string;
      finalDecision: Decision;
      note: string;
    }): Promise<{ outcome: ReceiptOutcome; verified: boolean }> => {
      requireContract(contract, address, "resolve a case");
      const receipt = await contract!.resolveHumanReview(
        caseId,
        finalDecision,
        note
      );
      const outcome = receiptOutcome(receipt);
      if (outcome === "failed") {
        throw new Error("Transaction failed on-chain — the case was not resolved.");
      }
      const after = await verifyReadback(
        () => contract!.getCase(caseId),
        (c) => c.status === "decided" && c.decision === finalDecision
      );
      return { outcome, verified: !!after };
    },
    onSuccess: ({ outcome, verified }) => {
      invalidate();
      if (!verified) {
        warning("Resolution submitted — state not yet visible", {
          description: "Receipt accepted; the final decision is not readable yet.",
        });
        return;
      }
      success(`Human review resolved (${outcomeLabel(outcome)})`, {
        description: "Final decision and note are on the public audit log — verified by readback.",
      });
    },
    onError: (err: any) => {
      errorToast("Resolution failed", {
        description: err?.message || "Please try again.",
      });
    },
  });
}

export function useRegisterAgent() {
  const contract = usePanoptesContract();
  const { address } = useWallet();
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: async (
      name: string
    ): Promise<{ outcome: ReceiptOutcome; verified: boolean }> => {
      requireContract(contract, address, "register as a reviewer agent");
      const receipt = await contract!.registerAgent(name);
      const outcome = receiptOutcome(receipt);
      if (outcome === "failed") {
        throw new Error("Transaction failed on-chain — registration did not land.");
      }
      const agent = await verifyReadback(
        () => contract!.getAgent(address!),
        (a) => a.name === name.trim()
      );
      return { outcome, verified: !!agent };
    },
    onSuccess: ({ outcome, verified }) => {
      invalidate();
      if (!verified) {
        warning("Registration submitted — state not yet visible", {
          description: "Receipt accepted, but the roster does not show this agent yet.",
        });
        return;
      }
      success(`Reviewer agent registered (${outcomeLabel(outcome)})`, {
        description: "Your agreement score will build as you review cases — verified by readback.",
      });
    },
    onError: (err: any) => {
      errorToast("Registration failed", {
        description: err?.message || "Please try again.",
      });
    },
  });
}

export function useReviewCase() {
  const contract = usePanoptesContract();
  const { address } = useWallet();
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: async ({
      caseId,
      verdict,
      rationale,
    }: {
      caseId: string;
      verdict: Decision;
      rationale: string;
    }): Promise<{ outcome: ReceiptOutcome; verified: boolean }> => {
      requireContract(contract, address, "review a case");
      const receipt = await contract!.reviewCase(caseId, verdict, rationale);
      const outcome = receiptOutcome(receipt);
      if (outcome === "failed") {
        throw new Error("Transaction failed on-chain — the review was not recorded.");
      }
      const reviews = await verifyReadback(
        () => contract!.getCaseReviews(caseId),
        (list) =>
          list.some(
            (r) => r.reviewer.toLowerCase() === address!.toLowerCase()
          )
      );
      return { outcome, verified: !!reviews };
    },
    onSuccess: ({ outcome, verified }) => {
      invalidate();
      if (!verified) {
        warning("Review submitted — state not yet visible", {
          description: "Receipt accepted, but your review is not readable yet.",
        });
        return;
      }
      success(`Review recorded (${outcomeLabel(outcome)})`, {
        description: "Compared against the contract decision — verified by readback.",
      });
    },
    onError: (err: any) => {
      errorToast("Review failed", { description: err?.message || "Please try again." });
    },
  });
}
