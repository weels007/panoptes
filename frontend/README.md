# Panoptes — Frontend

Next.js frontend for **Panoptes**, the decentralized content moderation dApp on
GenLayer. Validators classify content under Optimistic Democracy consensus; the
contract derives ALLOW / FLAG / BLOCK from fixed confidence thresholds (40 / 70)
and writes everything to a public audit log.

## Routes

| Route        | What it does                                                                 |
| ------------ | ---------------------------------------------------------------------------- |
| `/`          | Landing: live stats, threshold instrument, verdict grid, latest cases        |
| `/moderate`  | Submit content, appeal your verdicts, creator human-review desk              |
| `/audit`     | Public audit log: filterable ledger with full case records and agent reviews |
| `/agents`    | Register a reviewer agent, cast reviews, reputation roster with scores       |

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables (`.env.local`):

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_CONTRACT_ADDRESS` — deployed Panoptes contract on studionet
- `NEXT_PUBLIC_GENLAYER_RPC_URL` — GenLayer RPC (default: `https://studio.genlayer.com/api`)

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build & check

```bash
npm run lint   # tsc --noEmit
npm run build  # production build
npm start
```

## Architecture

- `lib/contracts/Panoptes.ts` — contract client: reads (`readContract`) and
  fee-funded writes (`estimateTransactionFeesForWrite` → `writeContract` →
  `waitForTransactionReceipt`)
- `lib/contracts/types.ts` — TS types plus normalizers for genlayer-js return
  values (Maps, bigints)
- `lib/hooks/usePanoptes.ts` — TanStack Query hooks for every read and mutation;
  mutations invalidate the ledger cache
- `components/ThresholdRuler.tsx` — the signature instrument: confidence marker
  against the contract's fixed 40 / 70 notches
- `app/globals.css` — Panoptes design system (porcelain / ink / bronze, verdict
  colors, local Instrument Serif + Space Grotesk + IBM Plex Mono)

## Wallet

Writes require MetaMask connected to the GenLayer Studio network
(chain id `61999`). All reads (stats, ledger, roster) work without a wallet.

## Design system

- **Paper** porcelain `#F2F4F8` · **ink** `#171A2B` · **bronze** `#B4762F`
- **Verdicts** allow `#2E7D5B` · flag `#C77D1A` · block `#A63232`
- **Type** Instrument Serif (display) · Space Grotesk (body) · IBM Plex Mono (data)
