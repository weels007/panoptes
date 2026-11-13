import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import {
  type Agent,
  type Case,
  type CaseRevision,
  type Community,
  type Decision,
  type Review,
  type Stats,
  type TransactionReceipt,
  normalizeAgent,
  normalizeCase,
  normalizeCommunity,
  normalizeRevision,
  normalizeReview,
  normalizeStats,
  dictToArray,
  toPlain,
  toStr,
} from "./types";
import {
  estimateWriteFeePreset,
  feePresetToTransactionFees,
  type FeePresetEstimate,
  type FeePresetLevel,
} from "../genlayer/fees";

const READ_PAGE = 50;

/**
 * Panoptes contract client — reads (public audit log) and fee-funded writes
 * against the deployed contract on studionet.
 */
class Panoptes {
  private contractAddress: `0x${string}`;
  private client: any;
  private studioUrl?: string;

  constructor(contractAddress: string, address?: string | null, studioUrl?: string) {
    this.contractAddress = contractAddress as `0x${string}`;
    this.studioUrl = studioUrl;

    const config: any = { chain: studionet };
    if (address) config.account = address as `0x${string}`;
    if (studioUrl) config.endpoint = studioUrl;

    this.client = createClient(config);
  }

  updateAccount(address: string): void {
    const config: any = {
      chain: studionet,
      account: address as `0x${string}`,
    };
    if (this.studioUrl) config.endpoint = this.studioUrl;
    this.client = createClient(config);
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async getStats(): Promise<Stats> {
    const raw = await this.client.readContract({
      address: this.contractAddress,
      functionName: "get_stats",
      args: [],
    });
    return normalizeStats(raw);
  }

  async listCommunities(offset = 0, limit = READ_PAGE): Promise<Community[]> {
    const raw = await this.client.readContract({
      address: this.contractAddress,
      functionName: "list_communities",
      args: [offset, limit],
    });
    return dictToArray(raw).map(normalizeCommunity);
  }

  async getCommunity(id: string): Promise<Community> {
    const raw = await this.client.readContract({
      address: this.contractAddress,
      functionName: "get_community",
      args: [id],
    });
    return normalizeCommunity(raw);
  }

  async listCases(offset = 0, limit = READ_PAGE): Promise<Case[]> {
    const raw = await this.client.readContract({
      address: this.contractAddress,
      functionName: "list_cases",
      args: [offset, limit],
    });
    return dictToArray(raw).map(normalizeCase);
  }

  async listCommunityCases(
    communityId: string,
    offset = 0,
    limit = READ_PAGE
  ): Promise<Case[]> {
    const raw = await this.client.readContract({
      address: this.contractAddress,
      functionName: "list_community_cases",
      args: [communityId, offset, limit],
    });
    return dictToArray(raw).map(normalizeCase);
  }

  async getCase(caseId: string): Promise<Case> {
    const raw = await this.client.readContract({
      address: this.contractAddress,
      functionName: "get_case",
      args: [caseId],
    });
    return normalizeCase(raw);
  }

  async getCaseReviews(caseId: string): Promise<Review[]> {
    const raw = await this.client.readContract({
      address: this.contractAddress,
      functionName: "get_case_reviews",
      args: [caseId],
    });
    // dict key = reviewer address
    if (raw instanceof Map) {
      return Array.from(raw.entries()).map(([addr, v]) =>
        normalizeReview(v, toStr(addr))
      );
    }
    if (raw && typeof raw === "object") {
      return Object.entries(raw as Record<string, unknown>).map(([addr, v]) =>
        normalizeReview(v, addr)
      );
    }
    return [];
  }

  async getCaseHistory(caseId: string): Promise<CaseRevision[]> {
    const raw = await this.client.readContract({
      address: this.contractAddress,
      functionName: "get_case_history",
      args: [caseId],
    });
    const list = Array.isArray(raw)
      ? raw
      : raw instanceof Map
        ? Array.from(raw.values())
        : [];
    return list.map(normalizeRevision);
  }

  async getAgent(addr: string): Promise<Agent> {
    const raw = await this.client.readContract({
      address: this.contractAddress,
      functionName: "get_agent",
      args: [addr],
    });
    return normalizeAgent(raw, addr);
  }

  async listAgents(offset = 0, limit = READ_PAGE): Promise<Agent[]> {
    const raw = await this.client.readContract({
      address: this.contractAddress,
      functionName: "list_agents",
      args: [offset, limit],
    });
    if (raw instanceof Map) {
      return Array.from(raw.entries()).map(([addr, v]) =>
        normalizeAgent(v, toStr(addr))
      );
    }
    if (raw && typeof raw === "object") {
      return Object.entries(raw as Record<string, unknown>).map(([addr, v]) =>
        normalizeAgent(v, addr)
      );
    }
    return [];
  }

  // -------------------------------------------------------------------------
  // Writes — every write estimates its fee policy first (see lib/genlayer/fees)
  // -------------------------------------------------------------------------

  private async write(
    functionName: string,
    args: unknown[],
    level: FeePresetLevel = "standard"
  ): Promise<TransactionReceipt> {
    const estimate = await estimateWriteFeePreset(
      this.client,
      { address: this.contractAddress, functionName, args },
      level
    );
    const fees = feePresetToTransactionFees(estimate as FeePresetEstimate);

    const txHash = await this.client.writeContract({
      address: this.contractAddress,
      functionName,
      args,
      value: BigInt(0),
      ...(fees ? { fees } : {}),
    });

    const receipt = await this.client.waitForTransactionReceipt({
      hash: txHash,
      status: "ACCEPTED" as any,
      retries: 40,
      interval: 5000,
    });

    return receipt as TransactionReceipt;
  }

  createCommunity(
    communityId: string,
    name: string,
    rules: string,
    level?: FeePresetLevel
  ): Promise<TransactionReceipt> {
    return this.write("create_community", [communityId, name, rules], level);
  }

  submitContent(
    communityId: string,
    content: string,
    level?: FeePresetLevel
  ): Promise<TransactionReceipt> {
    return this.write("submit_content", [communityId, content], level);
  }

  appealCase(
    caseId: string,
    argument: string,
    level?: FeePresetLevel
  ): Promise<TransactionReceipt> {
    return this.write("appeal_case", [caseId, argument], level);
  }

  flagForHumanReview(
    caseId: string,
    level?: FeePresetLevel
  ): Promise<TransactionReceipt> {
    return this.write("flag_for_human_review", [caseId], level);
  }

  resolveHumanReview(
    caseId: string,
    finalDecision: Decision,
    note: string,
    level?: FeePresetLevel
  ): Promise<TransactionReceipt> {
    return this.write(
      "resolve_human_review",
      [caseId, finalDecision, note],
      level
    );
  }

  registerAgent(name: string, level?: FeePresetLevel): Promise<TransactionReceipt> {
    return this.write("register_agent", [name], level);
  }

  reviewCase(
    caseId: string,
    verdict: Decision,
    rationale: string,
    level?: FeePresetLevel
  ): Promise<TransactionReceipt> {
    return this.write("review_case", [caseId, verdict, rationale], level);
  }

  /** Best-effort extraction of a case id from a submit_content receipt. */
  static caseIdFromReceipt(receipt: TransactionReceipt | undefined): string | null {
    if (!receipt) return null;
    const candidates = [receipt.result, receipt.decodedResult, receipt.returnValue];
    for (const c of candidates) {
      if (typeof c === "string" && c.startsWith("case-")) return c;
      if (c && typeof c === "object") {
        const plain = toPlain(c);
        const id = toStr(plain.case_id ?? plain.id);
        if (id.startsWith("case-")) return id;
      }
    }
    return null;
  }
}

export default Panoptes;
