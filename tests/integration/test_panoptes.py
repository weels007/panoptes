"""Panoptes integration tests — full consensus (leader + validators) with real LLMs.

Run with:
    gltest tests/integration/test_panoptes.py -v -s --network studionet

Note: studionet is rate-limited (60 req/min), so this suite is kept minimal.
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
    """Case IDs are sequential numerics: case-0, case-1, ... case-10."""
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
    """Submit content -> full LLM consensus -> decision from contract thresholds."""
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

    # Fetch the latest case from the public audit log (no wallet needed).
    cases = contract.list_cases(args=[0, 10]).call()
    assert len(cases) >= 1

    case_id = _latest_case_id(cases)
    case = contract.get_case(args=[case_id]).call()

    assert case["status"] == "decided"
    assert case["decision"] in ALLOWED_DECISIONS
    assert case["primary_category"] in ALLOWED_CATEGORIES
    assert 0 <= case["confidence"] <= 100
    assert case["reasoning"]

    # Clearly spam/scam content must be blocked by the contract thresholds.
    assert case["decision"] == "BLOCK"
    assert case["primary_category"] in ("spam", "scam")

    # Revision history is recorded from submit onward (append-only, public readback).
    history = contract.get_case_history(args=[case_id]).call()
    assert len(history) >= 1
    assert history[0]["action"] == "submit"
    assert history[0]["decision"] == case["decision"]

    stats = contract.get_stats(args=[]).call()
    assert stats["blocked"] >= 1


@pytest.mark.integration
def test_agent_review_and_reputation(contract):
    """A registered agent reviews a case; reputation is computed from agreement.

    Self-review ban: the reviewer must be a different account from the submitter.
    """
    cases = contract.list_cases(args=[0, 10]).call()
    case_id = _latest_case_id(cases)
    case = contract.get_case(args=[case_id]).call()

    # Second account = independent reviewer (not the case submitter).
    reviewer = get_accounts()[1]
    reviewer_contract = contract.connect(reviewer)

    receipt = reviewer_contract.register_agent(
        args=["Integration Reviewer"]
    ).transact()
    assert tx_execution_succeeded(receipt)

    # Review with the same verdict as the contract decision -> agreed.
    receipt = reviewer_contract.review_case(
        args=[case_id, case["decision"], "Clear-cut case, matches the verdict."]
    ).transact(wait_interval=10000, wait_retries=20)
    assert tx_execution_succeeded(receipt)

    agent_address = reviewer.address

    agent = contract.get_agent(args=[agent_address]).call()
    assert agent["reviews_total"] == 1
    assert agent["reviews_agreed"] == 1
    assert agent["score"] == 100

    reviews = contract.get_case_reviews(args=[case_id]).call()
    assert len(reviews) == 1
