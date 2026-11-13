"""Seed instance canonical Panoptes di studionet dengan data demo.

Menambahkan komunitas + kasus (via `genlayer write`, lihat README) lalu
mendaftarkan reviewer agent independen + satu review terhadap kasus terbaru.

Jalankan dengan:
    python scripts/seed_canonical.py <contract_address>

Catatan: gltest membaca jaringan dari plugin config yang di-set oleh CLI pytest;
script ini menyetelnya manual ke studionet sebelum memakai API gltest.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

from gltest_cli.config.general import get_general_config  # noqa: E402
from gltest_cli.config.types import PluginConfig  # noqa: E402
from gltest_cli.config.user import load_user_config  # noqa: E402


def _configure_studionet() -> None:
    general = get_general_config()
    general.user_config = load_user_config(str(ROOT / "gltest.config.yaml"))
    plugin = PluginConfig()
    plugin.network_name = "studionet"
    general.plugin_config = plugin


def _latest_case_id(cases: dict) -> str:
    return max(cases.keys(), key=lambda cid: int(cid.split("-")[1]))


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    address = sys.argv[1]

    _configure_studionet()

    from gltest import get_accounts, get_contract_factory
    from gltest.assertions import tx_execution_succeeded

    factory = get_contract_factory("Panoptes")
    contract = factory.build_contract(contract_address=address)

    stats = contract.get_stats(args=[]).call()
    print(f"stats sebelum seed: {stats}")

    cases = contract.list_cases(args=[0, 50]).call()
    if not cases:
        print("Tidak ada kasus — buat komunitas + kasus dulu, misalnya:")
        print(
            "  genlayer write "
            f"{address} create_community "
            '--args panoptes-demo "Panoptes Demo Forum" "No spam, no scams."'
        )
        print(
            "  genlayer write "
            f"{address} submit_content "
            '--args panoptes-demo "BUY CHEAP PILLS NOW..."'
        )
        return 1

    case_id = _latest_case_id(cases)
    case = contract.get_case(args=[case_id]).call()
    print(f"kasus terbaru: {case_id} -> {case['decision']}")

    # Reviewer independen: akun berbeda dari submitter/creator (asmodeus-deploy).
    reviewer = get_accounts()[1]
    reviewer_contract = contract.connect(reviewer)
    print(f"reviewer: {reviewer.address}")

    try:
        agent = contract.get_agent(args=[reviewer.address]).call()
        print(f"agent sudah terdaftar: {agent['name']}")
    except Exception:
        receipt = reviewer_contract.register_agent(
            args=["Sentinel Reviewer"]
        ).transact()
        assert tx_execution_succeeded(receipt), receipt
        print("agent terdaftar: Sentinel Reviewer")

    reviews = contract.get_case_reviews(args=[case_id]).call()
    if reviewer.address in reviews:
        print("review sudah ada — tidak diduplikasi")
    else:
        receipt = reviewer_contract.review_case(
            args=[case_id, case["decision"], "Clear-cut violation, matches the verdict."]
        ).transact(wait_interval=10000, wait_retries=20)
        assert tx_execution_succeeded(receipt), receipt
        print(f"review tercatat untuk {case_id}")

    stats = contract.get_stats(args=[]).call()
    print(f"stats sesudah seed: {stats}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
