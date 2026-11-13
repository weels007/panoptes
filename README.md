# Panoptes

**Decentralized content moderation — adjudicated by many independent AI validators.**

[![GenLayer Intelligent Contract](https://img.shields.io/badge/GenLayer-Intelligent%20Contract-6D5DF5)](https://docs.genlayer.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/license/mit/)

Panoptes (Πανόπτης — "the all-seeing one", the hundred-eyed giant of Greek mythology) moves moderation decisions from a single company's backend to consensus among many AI validators on GenLayer.

## The problem

When content is removed, it is usually impossible to see who decided, why, or whether anyone can review it. Moderation today is one company's backend, one model, and one unaccountable decision.

## How it works

```
submit_content(text)
      │
      ▼
Leader validator ── LLM classifies the content (category + confidence)
      │
      ▼
Other validators ── Run the SAME classification independently,
      │               then compare the decision fields
      │
      ├── majority agrees ──► case written on-chain
      └── disagree ─────────► transaction undetermined (no state change)

Final decision = FIXED thresholds in the contract (not model output):
      primary_category = "none"      → ALLOW
      confidence > 70                → BLOCK
      confidence > 40                → FLAG
      otherwise                      → ALLOW
```

Core principle: **the model never gets the final say.** The model only returns `categories`, `primary_category`, `confidence`, and `reasoning`. A `decision` field smuggled by the model is rejected by the contract's strict validation. Thresholds live in code, not in the prompt.

## Features

- **Per-community guidelines** — each community defines its own rules in natural language (immutable).
- **Classification consensus** — Equivalence Principle Pattern 1: validators re-run classification and compare `primary_category`, the threshold-derived decision, **and confidence within a ±10 tolerance**. Reasoning text may differ across nodes.
- **Appeals** — the submitter may appeal a decision up to 3 times, with an argument included in the re-classification prompt.
- **Human-in-the-loop** — the community creator can flag a case for manual review and record a final decision **with a mandatory justification note** stored in the ledger.
- **Reviewer-agent reputation** — registered agents review cases; score = share of reviews that agreed with the final decision. Reputation is re-synced automatically when the decision changes via appeal/human review. **The submitter and creator may not judge cases they control.**
- **Append-only revision history** — every decision change (submit → appeal → flag → resolve) records a `CaseRevision` row that is never overwritten; prior decisions and reasoning remain readable.
- **Public audit log** — every case is stored on-chain and readable by anyone, without a wallet.

## Contract methods

| Method | Kind | Description |
|---|---|---|
| `create_community(id, name, rules)` | write | Register community guidelines |
| `submit_content(community_id, content)` | write | Classify + store case + `submit` history row; returns `case_id` |
| `appeal_case(case_id, argument)` | write | Appeal with an argument (submitter only, max 3) + `appeal` history row |
| `flag_for_human_review(case_id)` | write | Flag for manual review (creator only) + `flag` history row |
| `resolve_human_review(case_id, final_decision, note)` | write | Record the final decision (creator only); `note` required, 1–1000 chars |
| `register_agent(name)` | write | Register as a reviewer agent |
| `review_case(case_id, verdict, rationale)` | write | Review a case (registered agent, once per case; submitter/creator rejected) |
| `get_community` / `list_communities` | view | Read communities |
| `get_case` / `list_cases` / `list_community_cases` | view | Public audit log (paginated) |
| `get_case_reviews` | view | Reviews for a case |
| `get_case_history` | view | Append-only revision history for a case |
| `get_agent` / `list_agents` | view | Agent reputation (score 0–100) |
| `get_stats` | view | Aggregate statistics |

## Security

- **Prompt injection** — user content is wrapped in `<untrusted_content>` with explicit instructions that its contents are data, not instructions.
- **Strict output validation** — only 4 keys are allowed; extra keys (including `decision`/`status`) are rejected; categories must be in the allow-list; confidence must be numeric 0–100.
- **Contract-computed decision** — thresholds are constants in code.
- **Independent validators** — validators never trust the leader's output; they run the same task themselves and compare decision fields.
- **Consensus-bound confidence** — the stored confidence (a deterministic input to the 40/70 thresholds) must be within ±10 of other agreeing validators; the prompt requests multiples of 5 to avoid spurious precision.
- **Anti-sybil reputation** — the submitter and community creator are rejected when attempting to review cases they control.
- **Third-party decision trail** — `resolve_human_review` requires a `note`; every revision is recorded append-only via `get_case_history`, so no ruling is silently overwritten.

An honest limitation (see also [Modeq TRUST_MODEL](https://github.com/0xFearless-1/Modeq/blob/main/docs/TRUST_MODEL.md)): validator agreement shows a reproducible outcome, not proof of correctness. All nodes run the same prompt, so correlated model errors remain possible.

## Project structure

```
contracts/
  panoptes.py              # Intelligent Contract (Python)
tests/
  direct/                  # Fast in-memory tests, mocked LLM
    test_panoptes.py       # 35 tests: thresholds, appeals, reputation, history, anti-sybil
  integration/             # Full consensus with real LLMs (3 tests)
    test_panoptes.py
scripts/
  seed_canonical.py        # Seed demo data into a studionet instance
frontend/                  # Next.js + genlayer-js (see frontend/README.md)
  app/                     # Routes: /, /moderate, /audit, /agents
  lib/contracts/           # Panoptes client (read + paid writes)
  lib/hooks/usePanoptes.ts # React Query hooks
  components/              # ThresholdRuler, CaseLedger, badges, stats
gltest.config.yaml         # Test network configuration
```

## Running

```bash
# Setup
pip install -r requirements.txt

# Lint (on Windows: set PYTHONIOENCODING=utf-8)
genvm-lint check contracts/panoptes.py

# Direct tests — fast, no server
pytest tests/direct/ -v

# Integration tests — real consensus on studionet (free, no tokens)
gltest tests/integration/test_panoptes.py -v -s --network studionet

# Seed demo data (community + case created via `genlayer write`, then agent + review)
python scripts/seed_canonical.py 0x7feE237eC31b90C2A3746437a920BfdFbf74457b
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_CONTRACT_ADDRESS already set to studionet address
npm run dev                  # http://localhost:3000
```

| Route | Contents |
|---|---|
| `/` | Landing: live stats, threshold instrument, verdict grid, latest cases |
| `/moderate` | Submit content, appeal, community creator's manual review desk |
| `/audit` | Public audit log: filterable ledger + full case record |
| `/agents` | Register reviewer agents, cast reviews, reputation roster (score 0–100) |

All reads are public (no wallet required); writes require MetaMask on the
GenLayer Studio network (chain id `61999`). Full details in
[`frontend/README.md`](frontend/README.md).

## Deploy

| Network | Contract |
|---|---|
| GenLayer Studio (studionet) | [`0x7feE237eC31b90C2A3746437a920BfdFbf74457b`](https://studio.genlayer.com/) |

The contract can also be redeployed via [GenLayer Studio](https://studio.genlayer.com/) (upload `contracts/panoptes.py`), or locally:

```bash
npm install -g genlayer
genlayer init
genlayer up
genlayer deploy
```

## Technology

- **Contract**: GenLayer Intelligent Contracts (Python) on GenVM
- **Consensus**: Optimistic Democracy + Equivalence Principle Pattern 1 (partial field matching)
- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + genlayer-js + TanStack Query
- **Toolchain**: `genlayer-py`, `genlayer-test`, `genvm-linter`

## License

MIT
