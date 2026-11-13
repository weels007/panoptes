# Panoptes

**Decentralized Content Moderation — moderasi konten yang dijalankan oleh banyak AI validator secara desentralisasi.**

[![GenLayer Intelligent Contract](https://img.shields.io/badge/GenLayer-Intelligent%20Contract-6D5DF5)](https://docs.genlayer.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/license/mit/)

Panoptes (Πανόπτης — "yang mengawasi segalanya", raksasa bermata seratus dalam mitologi Yunani) memindahkan keputusan moderasi dari backend satu perusahaan ke konsensus banyak AI validator di GenLayer.

## Masalah

Ketika sebuah konten dihapus, biasanya tidak bisa dilihat siapa yang memutuskan, mengapa, atau apakah ada yang bisa memeriksanya. Moderasi hari ini adalah backend satu perusahaan, satu model, dan satu keputusan yang tidak bisa dipertanggungjawabkan.

## Cara kerja

```
submit_content(text)
      │
      ▼
Leader validator ── LLM mengklasifikasi konten (kategori + confidence)
      │
      ▼
Validator lain ── Menjalankan klasifikasi yang SAMA secara independen,
      │            lalu membandingkan field keputusan
      │
      ├── mayoritas sepakat ──► kasus ditulis on-chain
      └── tidak sepakat ──────► transaksi undetermined (tidak ada state berubah)
      
Keputusan akhir = threshold TETAP di kontrak (bukan output model):
      primary_category = "none"      → ALLOW
      confidence > 70                → BLOCK
      confidence > 40                → FLAG
      selainnya                      → ALLOW
```

Prinsip inti: **model tidak pernah mendapat kata akhir.** Model hanya mengembalikan `categories`, `primary_category`, `confidence`, dan `reasoning`. Field `decision` yang diselundupkan model akan ditolak oleh validasi ketat kontrak. Threshold ada di kode, bukan di prompt.

## Fitur

- **Guidelines per komunitas** — setiap komunitas mendefinisikan aturannya sendiri dalam bahasa alami (permanen).
- **Konsensus klasifikasi** — Equivalence Principle Pattern 1: validator menjalankan ulang klasifikasi dan membandingkan `primary_category`, keputusan yang diturunkan dari threshold, **dan confidence dalam toleransi ±10**. Teks analisis boleh berbeda antar node.
- **Appeal** — submitter dapat membandingkan keputusan maksimal 3 kali, dengan argumen yang ikut masuk ke prompt klasifikasi ulang.
- **Human-in-the-loop** — creator komunitas dapat menandai kasus untuk review manual lalu memutuskan keputusan final **beserta catatan justifikasi wajib** yang ikut tersimpan di ledger.
- **Reputasi reviewer agent** — agent yang terdaftar mereview kasus; skor = persentase review yang sesuai keputusan final. Reputasi otomatis disinkronkan saat keputusan berubah lewat appeal/human review. **Submitter dan creator tidak boleh menilai kasusnya sendiri.**
- **Riwayat revisi append-only** — setiap perubahan keputusan (submit → appeal → flag → resolve) meninggalkan baris `CaseRevision` yang tidak pernah ditimpa; keputusan dan penalaran lama tetap terbaca.
- **Audit log publik** — setiap kasus tersimpan on-chain dan bisa dibaca siapa pun tanpa wallet.

## Metode kontrak

| Method | Jenis | Deskripsi |
|---|---|---|
| `create_community(id, name, rules)` | write | Daftarkan guidelines komunitas |
| `submit_content(community_id, content)` | write | Klasifikasi + simpan kasus + baris riwayat `submit`, return `case_id` |
| `appeal_case(case_id, argument)` | write | Banding dengan argumen (submitter only, maks 3x) + baris riwayat `appeal` |
| `flag_for_human_review(case_id)` | write | Tandai untuk review manual (creator only) + baris riwayat `flag` |
| `resolve_human_review(case_id, final_decision, note)` | write | Putuskan keputusan final (creator only); `note` wajib 1–1000 char |
| `register_agent(name)` | write | Daftar sebagai reviewer agent |
| `review_case(case_id, verdict, rationale)` | write | Review kasus (agent terdaftar, 1x per kasus; submitter/creator ditolak) |
| `get_community` / `list_communities` | view | Baca komunitas |
| `get_case` / `list_cases` / `list_community_cases` | view | Audit log publik (terpaginasi) |
| `get_case_reviews` | view | Review untuk sebuah kasus |
| `get_case_history` | view | Riwayat revisi append-only untuk sebuah kasus |
| `get_agent` / `list_agents` | view | Reputasi agent (skor 0–100) |
| `get_stats` | view | Statistik agregat |

## Keamanan

- **Prompt injection** — konten user dibungkus `<untrusted_content>` dengan instruksi eksplisit bahwa isinya adalah data, bukan instruksi.
- **Validasi output ketat** — hanya 4 key yang diizinkan; key tambahan (termasuk `decision`/`status`) ditolak; kategori harus masuk allow-list; confidence harus numerik 0–100.
- **Keputusan dihitung kontrak** — threshold bersifat konstan di kode.
- **Validator independen** — validator tidak pernah mempercayai output leader; mereka menjalankan tugas yang sama sendiri lalu membandingkan field keputusan.
- **Confidence terikat konsensus** — angka confidence yang disimpan (input deterministik ke threshold 40/70) harus berada dalam ±10 dari keyakinan validator yang menyetujui; prompt meminta kelipatan 5 agar tidak ada presisi semu.
- **Anti-sybil reputasi** — submitter dan creator komunitas ditolak saat mencoba mereview kasus yang mereka kendalikan.
- **Jejak keputusan pihak ketiga** — `resolve_human_review` menerima `note` wajib; setiap revisi tercatat append-only lewat `get_case_history`, tidak ada putusan yang ditimpa diam-diam.

Batasan yang jujur (lihat juga diskusi [Modeq TRUST_MODEL](https://github.com/0xFearless-1/Modeq/blob/main/docs/TRUST_MODEL.md)): kesepakatan validator menunjukkan hasil yang dapat direproduksi, bukan bukti kebenaran. Semua node menjalankan prompt yang sama, sehingga error model yang berkorelasi tetap mungkin terjadi.

## Struktur proyek

```
contracts/
  panoptes.py              # Intelligent Contract (Python)
tests/
  direct/                  # Test in-memory cepat, LLM di-mock
    test_panoptes.py       # 35 test: threshold, appeal, reputasi, riwayat, anti-sybil
  integration/             # Konsensus penuh dengan LLM nyata (3 test)
    test_panoptes.py
scripts/
  seed_canonical.py        # Seed data demo ke instance studionet
frontend/                  # Next.js + genlayer-js (lihat frontend/README.md)
  app/                     # Rute: /, /moderate, /audit, /agents
  lib/contracts/           # Klien Panoptes (read + write berfee)
  lib/hooks/usePanoptes.ts # React Query hooks
  components/              # ThresholdRuler, CaseLedger, badge, statistik
gltest.config.yaml         # Konfigurasi jaringan test
```

## Menjalankan

```bash
# Setup
pip install -r requirements.txt

# Lint (di Windows: set PYTHONIOENCODING=utf-8)
genvm-lint check contracts/panoptes.py

# Direct tests — cepat, tanpa server
pytest tests/direct/ -v

# Integration tests — konsensus nyata di studionet (gratis, tanpa token)
gltest tests/integration/test_panoptes.py -v -s --network studionet

# Seed data demo (komunitas + kasus dibuat via `genlayer write`, lalu agent + review)
python scripts/seed_canonical.py 0x7feE237eC31b90C2A3746437a920BfdFbf74457b
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_CONTRACT_ADDRESS sudah berisi alamat studionet
npm run dev                  # http://localhost:3000
```

| Rute | Isi |
|---|---|
| `/` | Landing: statistik live, instrumen threshold, grid verdict, kasus terbaru |
| `/moderate` | Submit konten, appeal, meja review manual creator komunitas |
| `/audit` | Audit log publik: ledger yang bisa difilter + rekam kasus lengkap |
| `/agents` | Daftar reviewer agent, cast review, roster reputasi (skor 0–100) |

Semua read bersifat publik (tanpa wallet); write butuh MetaMask di jaringan
GenLayer Studio (chain id `61999`). Detail lengkap di
[`frontend/README.md`](frontend/README.md).

## Deploy

| Jaringan | Kontrak |
|---|---|
| GenLayer Studio (studionet) | [`0x7feE237eC31b90C2A3746437a920BfdFbf74457b`](https://studio.genlayer.com/) |

Kontrak juga bisa di-deploy ulang melalui [GenLayer Studio](https://studio.genlayer.com/) (unggah `contracts/panoptes.py`), atau lokal:

```bash
npm install -g genlayer
genlayer init
genlayer up
genlayer deploy
```

## Teknologi

- **Kontrak**: GenLayer Intelligent Contracts (Python) di GenVM
- **Konsensus**: Optimistic Democracy + Equivalence Pattern 1 (partial field matching)
- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + genlayer-js + TanStack Query
- **Toolchain**: `genlayer-py`, `genlayer-test`, `genvm-linter`

## Lisensi

MIT
