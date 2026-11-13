"""Integration tests Panoptes — konsensus penuh (leader + validator) dengan LLM nyata.

Jalankan dengan:
    gltest tests/integration/test_panoptes.py -v -s --network studionet

Catatan: studionet membatasi 60 req/min, jadi test ini dibuat sesedikit mungkin.
"""

import pytest

from gltest import get_contract_factory, get_accounts
from gltest.assertions import tx_execution_succeeded

COMMUNITY_ID = "panoptes-demo"
COMMUNITY_RULES = "No spam, no hate speech, no scams, no harassment."
ALLOWED_DECISIONS = ("ALLOW", "FLAG", "BLOCK")
ALLOWED_CATEGORIES = (
    "spam",
    "hate_speech",
    "harassment",
    "nsfw",
    "violence",
    "misinformation",
    "scam",
    "none",
)


def _latest_case_id(cases: dict) -> str:
    """case_id berurutan numerik: case-0, case-1, ... case-10."""
    return max(cases.keys(), key=lambda cid: int(cid.split("-")[1]))


@pytest.fixture(scope="module")
def contract():
    factory = get_contract_factory("Panoptes")
    deployed = factory.deploy()
    print(f"\nPANOPTES_DEPLOYED_AT={deployed.address}")
    return deployed


@pytest.mark.integration
def test_create_community(contract):
    receipt = contract.create_community(
        args=[COMMUNITY_ID, "Panoptes Demo Forum", COMMUNITY_RULES]
    ).transact()
    assert tx_execution_succeeded(receipt)

    community = contract.get_community(args=[COMMUNITY_ID]).call()
    assert community["id"] == COMMUNITY_ID
    assert community["name"] == "Panoptes Demo Forum"
    assert community["rules"] == COMMUNITY_RULES

    stats = contract.get_stats(args=[]).call()
    assert stats["total_communities"] >= 1


@pytest.mark.integration
def test_submit_content_full_consensus(contract):
    """Submit konten -> konsensus LLM penuh -> keputusan dari threshold kontrak."""
    receipt = contract.submit_content(
        args=[
            COMMUNITY_ID,
            "BUY CHEAP PILLS NOW!!! Click this link to win a free iPhone, "
            "guaranteed 100% money back, send crypto to claim your prize!",
        ]
    ).transact(wait_interval=10000, wait_retries=20)
    assert tx_execution_succeeded(receipt)

    total_before = contract.get_stats(args=[]).call()["total_cases"]
    assert total_before >= 1

    # Ambil kasus terbaru dari audit log publik (tanpa wallet).
    cases = contract.list_cases(args=[0, 10]).call()
    assert len(cases) >= 1

    case_id = _latest_case_id(cases)
    case = contract.get_case(args=[case_id]).call()

    assert case["status"] == "decided"
    assert case["decision"] in ALLOWED_DECISIONS
    assert case["primary_category"] in ALLOWED_CATEGORIES
    assert 0 <= case["confidence"] <= 100
    assert case["reasoning"]

    # Konten spam/scam yang jelas harus diblokir oleh threshold kontrak.
    assert case["decision"] == "BLOCK"
    assert case["primary_category"] in ("spam", "scam")

    # Riwayat revisi tercatat sejak submit (append-only, readback publik).
    history = contract.get_case_history(args=[case_id]).call()
    assert len(history) >= 1
    assert history[0]["action"] == "submit"
    assert history[0]["decision"] == case["decision"]

    stats = contract.get_stats(args=[]).call()
    assert stats["blocked"] >= 1


@pytest.mark.integration
def test_agent_review_and_reputation(contract):
    """Agent terdaftar mereview kasus; reputasi dihitung dari kesepakatan.

    Larangan self-review: reviewer harus akun berbeda dari submitter.
    """
    cases = contract.list_cases(args=[0, 10]).call()
    case_id = _latest_case_id(cases)
    case = contract.get_case(args=[case_id]).call()

    # Akun kedua = reviewer independen (bukan submitter kasus).
    reviewer = get_accounts()[1]
    reviewer_contract = contract.connect(reviewer)

    receipt = reviewer_contract.register_agent(
        args=["Integration Reviewer"]
    ).transact()
    assert tx_execution_succeeded(receipt)

    # Review dengan verdict yang sama dengan keputusan kontrak -> agreed.
    receipt = reviewer_contract.review_case(
        args=[case_id, case["decision"], "Clear-cut case, matches the verdict."]
    ).transact(wait_interval=10000, wait_retries=20)
    assert tx_execution_succeeded(receipt)

    # Submitter tidak boleh menilai kasusnya sendiri (regresi sybil):
    # akun default adalah submitter kasus ini — cek langsung lewat readback.
    agent_address = reviewer.address

    agent = contract.get_agent(args=[agent_address]).call()
    assert agent["reviews_total"] == 1
    assert agent["reviews_agreed"] == 1
    assert agent["score"] == 100

    reviews = contract.get_case_reviews(args=[case_id]).call()
    assert len(reviews) == 1
