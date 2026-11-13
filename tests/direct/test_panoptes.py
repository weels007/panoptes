"""Direct mode tests for Panoptes — no server, mocked LLM.

Note: direct mode only runs the leader function; validator logic is exercised
via integration tests against studionet.
"""

import json

import pytest

from tests.direct.conftest import to_hex

COMMUNITY_ID = "forum-rules"
COMMUNITY_NAME = "Test Forum"
COMMUNITY_RULES = "No spam. No hate speech. No scams."


def _llm_response(primary, confidence, categories=None, reasoning="Classified."):
    if categories is None:
        categories = [] if primary == "none" else [primary]
    return json.dumps(
        {
            "categories": categories,
            "primary_category": primary,
            "confidence": confidence,
            "reasoning": reasoning,
        }
    )


def _mock(vm, response, match=r"Panoptes"):
    vm.mock_llm(match, response)


def _setup_community(vm, contract, creator):
    vm.sender = creator
    contract.create_community(COMMUNITY_ID, COMMUNITY_NAME, COMMUNITY_RULES)


# ----------------------------------------------------------------------
# Communities
# ----------------------------------------------------------------------


def test_create_community_and_read(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    community = contract.get_community(COMMUNITY_ID)
    assert community.id == COMMUNITY_ID
    assert community.name == COMMUNITY_NAME
    assert community.rules == COMMUNITY_RULES
    assert to_hex(community.creator) == to_hex(direct_alice)
    assert community.total_cases == 0

    stats = contract.get_stats()
    assert stats["total_communities"] == 1
    assert stats["total_cases"] == 0


def test_create_community_duplicate_fails(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    with direct_vm.expect_revert("Community already exists"):
        contract.create_community(COMMUNITY_ID, "Other", "Other rules")


def test_create_community_empty_rules_fails(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/panoptes.py")
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("rules must be"):
        contract.create_community("empty-rules", "Empty", "   ")


def test_get_unknown_community_fails(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/panoptes.py")

    with direct_vm.expect_revert("Unknown community"):
        contract.get_community("nope")


# ----------------------------------------------------------------------
# Submit & thresholds (decision computed by contract, never the model)
# ----------------------------------------------------------------------


def test_submit_block_when_confidence_high(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    _mock(direct_vm, _llm_response("spam", 95))
    case_id = contract.submit_content(COMMUNITY_ID, "Buy cheap pills now, click here")

    case = contract.get_case(case_id)
    assert case.id == "case-0"
    assert case.decision == "BLOCK"
    assert case.primary_category == "spam"
    assert case.confidence == 95
    assert case.status == "decided"
    assert to_hex(case.submitter) == to_hex(direct_alice)

    stats = contract.get_stats()
    assert stats["total_cases"] == 1
    assert stats["blocked"] == 1
    assert stats["allowed"] == 0
    assert stats["flagged"] == 0


def test_threshold_flag_window(direct_vm, direct_deploy, direct_alice):
    """confidence 70 -> FLAG, 71 -> BLOCK, 40 -> ALLOW, 41 -> FLAG."""
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    _mock(direct_vm, _llm_response("harassment", 70))
    case_id = contract.submit_content(COMMUNITY_ID, "mildly rude post")
    assert contract.get_case(case_id).decision == "FLAG"

    direct_vm.clear_mocks()
    _mock(direct_vm, _llm_response("harassment", 71))
    case_id = contract.submit_content(COMMUNITY_ID, "very rude post")
    assert contract.get_case(case_id).decision == "BLOCK"

    direct_vm.clear_mocks()
    _mock(direct_vm, _llm_response("misinformation", 40))
    case_id = contract.submit_content(COMMUNITY_ID, "dubious claim")
    assert contract.get_case(case_id).decision == "ALLOW"

    direct_vm.clear_mocks()
    _mock(direct_vm, _llm_response("misinformation", 41))
    case_id = contract.submit_content(COMMUNITY_ID, "dubious claim two")
    assert contract.get_case(case_id).decision == "FLAG"

    stats = contract.get_stats()
    assert stats["flagged"] == 2
    assert stats["blocked"] == 1
    assert stats["allowed"] == 1


def test_none_category_overrides_high_confidence(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    _mock(direct_vm, _llm_response("none", 99))
    case_id = contract.submit_content(COMMUNITY_ID, "perfectly fine post")

    case = contract.get_case(case_id)
    assert case.decision == "ALLOW"
    assert case.primary_category == "none"
    assert json.loads(case.categories_json) == []


def test_submit_unknown_community_fails(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    with direct_vm.expect_revert("Unknown community"):
        contract.submit_content("ghost", "hello")


def test_submit_empty_content_fails(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    with direct_vm.expect_revert("Content is empty"):
        contract.submit_content(COMMUNITY_ID, "   ")


def test_submit_too_long_fails(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    with direct_vm.expect_revert("Content exceeds"):
        contract.submit_content(COMMUNITY_ID, "x" * 4001)


# ----------------------------------------------------------------------
# Invalid LLM output is rejected before anything is stored
# ----------------------------------------------------------------------


def test_smuggled_decision_key_rejected(direct_vm, direct_deploy, direct_alice):
    """Model smuggles a 'decision' field -> rejected (not the model's call)."""
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    payload = json.dumps(
        {
            "categories": ["spam"],
            "primary_category": "spam",
            "confidence": 10,
            "reasoning": "Trying to smuggle a decision.",
            "decision": "ALLOW",
        }
    )
    _mock(direct_vm, payload)

    with direct_vm.expect_revert("forbidden key"):
        contract.submit_content(COMMUNITY_ID, "sneaky content")

    assert contract.get_stats()["total_cases"] == 0


def test_non_numeric_confidence_rejected(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    payload = json.dumps(
        {
            "categories": ["spam"],
            "primary_category": "spam",
            "confidence": "very high",
            "reasoning": "Confidence as text.",
        }
    )
    _mock(direct_vm, payload)

    with direct_vm.expect_revert("confidence is not numeric"):
        contract.submit_content(COMMUNITY_ID, "bad confidence content")


def test_unknown_category_rejected(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    payload = json.dumps(
        {
            "categories": ["definitely_not_a_category"],
            "primary_category": "spam",
            "confidence": 90,
            "reasoning": "Bad category.",
        }
    )
    _mock(direct_vm, payload)

    with direct_vm.expect_revert("invalid category element"):
        contract.submit_content(COMMUNITY_ID, "bad category content")


# ----------------------------------------------------------------------
# Appeal
# ----------------------------------------------------------------------


def test_appeal_only_submitter(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    _mock(direct_vm, _llm_response("spam", 95))
    case_id = contract.submit_content(COMMUNITY_ID, "Buy cheap pills now")

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only the submitter can appeal"):
        contract.appeal_case(case_id, "This is a legitimate business.")


def test_appeal_overturns_decision(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    _mock(direct_vm, _llm_response("spam", 95))
    case_id = contract.submit_content(COMMUNITY_ID, "Buy cheap pills now")
    assert contract.get_case(case_id).decision == "BLOCK"

    # Appeal: re-classify with argument -> decision changes.
    direct_vm.clear_mocks()
    _mock(direct_vm, _llm_response("none", 10), match=r"<appeal_argument>")

    contract.appeal_case(case_id, "This is a doctor-approved offer.")

    case = contract.get_case(case_id)
    assert case.decision == "ALLOW"
    assert case.appeals == 1

    stats = contract.get_stats()
    assert stats["appeals"] == 1
    assert stats["appeals_overturned"] == 1
    assert stats["blocked"] == 0
    assert stats["allowed"] == 1


def test_appeal_limit_enforced(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    _mock(direct_vm, _llm_response("spam", 95))
    case_id = contract.submit_content(COMMUNITY_ID, "Buy cheap pills now")

    for i in range(3):
        direct_vm.clear_mocks()
        _mock(direct_vm, _llm_response("spam", 95), match=r"<appeal_argument>")
        contract.appeal_case(case_id, f"appeal number {i}")

    direct_vm.clear_mocks()
    _mock(direct_vm, _llm_response("spam", 95), match=r"<appeal_argument>")
    with direct_vm.expect_revert("Appeal limit reached"):
        contract.appeal_case(case_id, "one more try")


def test_appeal_empty_argument_fails(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    _mock(direct_vm, _llm_response("spam", 95))
    case_id = contract.submit_content(COMMUNITY_ID, "Buy cheap pills now")

    with direct_vm.expect_revert("argument must be"):
        contract.appeal_case(case_id, "  ")


# ----------------------------------------------------------------------
# Human review
# ----------------------------------------------------------------------


def test_human_review_flow(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    _mock(direct_vm, _llm_response("spam", 95))
    case_id = contract.submit_content(COMMUNITY_ID, "Buy cheap pills now")

    # Only the community creator (alice) may flag.
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("community creator"):
        contract.flag_for_human_review(case_id)

    direct_vm.sender = direct_alice
    contract.flag_for_human_review(case_id)
    assert contract.get_case(case_id).status == "human_review"

    # A second flag fails.
    with direct_vm.expect_revert("Already under human review"):
        contract.flag_for_human_review(case_id)

    # Appeals are blocked while under human review.
    with direct_vm.expect_revert("under human review"):
        contract.appeal_case(case_id, "please reconsider")

    # Only the creator may resolve.
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("community creator"):
        contract.resolve_human_review(case_id, "ALLOW", "manual override")

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("final_decision must be"):
        contract.resolve_human_review(case_id, "MAYBE", "manual override")

    # A third-party decision must include justification.
    with direct_vm.expect_revert("note must be"):
        contract.resolve_human_review(case_id, "ALLOW", "   ")

    contract.resolve_human_review(
        case_id, "ALLOW", "Reviewed against the rules; clearly a false positive."
    )
    case = contract.get_case(case_id)
    assert case.status == "decided"
    assert case.decision == "ALLOW"

    stats = contract.get_stats()
    assert stats["human_reviews"] == 1
    assert stats["allowed"] == 1
    assert stats["blocked"] == 0

    # The justification is stored in history.
    history = contract.get_case_history(case_id)
    assert history[-1].action == "human_review"
    assert history[-1].note == "Reviewed against the rules; clearly a false positive."
    assert history[-1].decision == "ALLOW"


def test_resolve_without_flag_fails(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    _mock(direct_vm, _llm_response("spam", 95))
    case_id = contract.submit_content(COMMUNITY_ID, "Buy cheap pills now")

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("not under human review"):
        contract.resolve_human_review(case_id, "ALLOW", "note")


# ----------------------------------------------------------------------
# Reviewer agents & reputation
# ----------------------------------------------------------------------


def test_register_agent_and_duplicate(direct_vm, direct_deploy, direct_bob):
    contract = direct_deploy("contracts/panoptes.py")

    direct_vm.sender = direct_bob
    contract.register_agent("Alice Reviewer")

    agent = contract.get_agent(to_hex(direct_bob))
    assert agent["name"] == "Alice Reviewer"
    assert agent["reviews_total"] == 0
    assert agent["score"] == 0

    with direct_vm.expect_revert("Already registered"):
        contract.register_agent("Again")


def test_register_agent_empty_name_fails(direct_vm, direct_deploy, direct_bob):
    contract = direct_deploy("contracts/panoptes.py")
    direct_vm.sender = direct_bob

    with direct_vm.expect_revert("name must be"):
        contract.register_agent("  ")


def test_review_requires_registration(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    _mock(direct_vm, _llm_response("spam", 95))
    case_id = contract.submit_content(COMMUNITY_ID, "Buy cheap pills now")

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Not a registered agent"):
        contract.review_case(case_id, "ALLOW", "Looks fine to me.")


def test_review_updates_reputation(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    _mock(direct_vm, _llm_response("spam", 95))
    case_id = contract.submit_content(COMMUNITY_ID, "Buy cheap pills now")

    direct_vm.sender = direct_bob
    contract.register_agent("Bob Reviewer")

    # Contract decision is BLOCK; bob agrees -> reputation increases.
    contract.review_case(case_id, "BLOCK", "Agreed, it is spam.")
    agent = contract.get_agent(to_hex(direct_bob))
    assert agent["reviews_total"] == 1
    assert agent["reviews_agreed"] == 1
    assert agent["score"] == 100

    reviews = contract.get_case_reviews(case_id)
    assert to_hex(direct_bob) in reviews
    assert reviews[to_hex(direct_bob)].agreed is True

    # A second review for the same case is rejected.
    with direct_vm.expect_revert("Already reviewed this case"):
        contract.review_case(case_id, "ALLOW", "changed my mind")


def test_review_disagreement_lowers_score(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    _mock(direct_vm, _llm_response("spam", 95))
    case_id = contract.submit_content(COMMUNITY_ID, "Buy cheap pills now")

    direct_vm.sender = direct_bob
    contract.register_agent("Bob")
    contract.review_case(case_id, "BLOCK", "spam")

    direct_vm.sender = direct_charlie
    contract.register_agent("Charlie")
    contract.review_case(case_id, "ALLOW", "not spam")

    bob = contract.get_agent(to_hex(direct_bob))
    charlie = contract.get_agent(to_hex(direct_charlie))
    assert bob["score"] == 100
    assert charlie["score"] == 0


def test_reputation_resync_when_appeal_overturns(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    _mock(direct_vm, _llm_response("spam", 95))
    case_id = contract.submit_content(COMMUNITY_ID, "Buy cheap pills now")

    direct_vm.sender = direct_bob
    contract.register_agent("Bob")
    contract.review_case(case_id, "BLOCK", "matches the verdict")

    assert contract.get_agent(to_hex(direct_bob))["score"] == 100

    # Appeal changes BLOCK -> ALLOW; bob's review must be re-synced.
    direct_vm.sender = direct_alice
    direct_vm.clear_mocks()
    _mock(direct_vm, _llm_response("none", 10), match=r"<appeal_argument>")
    contract.appeal_case(case_id, "context makes it harmless")

    agent = contract.get_agent(to_hex(direct_bob))
    assert agent["reviews_total"] == 1
    assert agent["reviews_agreed"] == 0
    assert agent["score"] == 0

    review = contract.get_case_reviews(case_id)[to_hex(direct_bob)]
    assert review.agreed is False


def test_invalid_verdict_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    _mock(direct_vm, _llm_response("spam", 95))
    case_id = contract.submit_content(COMMUNITY_ID, "Buy cheap pills now")

    direct_vm.sender = direct_bob
    contract.register_agent("Bob")

    with direct_vm.expect_revert("verdict must be"):
        contract.review_case(case_id, "DELETE", "nope")


# ----------------------------------------------------------------------
# Views & audit log
# ----------------------------------------------------------------------


def test_list_cases_pagination(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    for i in range(3):
        _mock(direct_vm, _llm_response("none", 90))
        contract.submit_content(COMMUNITY_ID, f"post number {i}")

    page1 = contract.list_cases(0, 2)
    page2 = contract.list_cases(2, 10)
    assert len(page1) == 2
    assert len(page2) == 1
    assert "case-0" in page1
    assert "case-2" in page2

    community_cases = contract.list_community_cases(COMMUNITY_ID, 0, 10)
    assert len(community_cases) == 3

    assert contract.get_stats()["total_cases"] == 3


def test_get_case_unknown_fails(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/panoptes.py")

    with direct_vm.expect_revert("Unknown case"):
        contract.get_case("case-999")


def test_list_communities_and_agents(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    direct_vm.sender = direct_bob
    contract.register_agent("Bob")

    communities = contract.list_communities(0, 10)
    assert COMMUNITY_ID in communities
    assert communities[COMMUNITY_ID].name == COMMUNITY_NAME

    agents = contract.list_agents(0, 10)
    assert to_hex(direct_bob) in agents
    assert agents[to_hex(direct_bob)].name == "Bob"


# ----------------------------------------------------------------------
# Self-review forbidden — reputation must come from independent parties
# ----------------------------------------------------------------------


def test_submitter_cannot_review_own_case(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """Submitter supplies both outcome and review -> sybil score, rejected."""
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    _mock(direct_vm, _llm_response("spam", 95))
    case_id = contract.submit_content(COMMUNITY_ID, "Buy cheap pills now")

    # Alice (submitter) registers as an agent and tries to judge her own case.
    direct_vm.sender = direct_alice
    contract.register_agent("Sneaky Submitter")
    with direct_vm.expect_revert("Submitter cannot review their own case"):
        contract.review_case(case_id, "BLOCK", "definitely spam, trust me")

    assert contract.get_agent(to_hex(direct_alice))["reviews_total"] == 0
    assert contract.get_case_reviews(case_id) == {}


def test_creator_cannot_review_cases(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """The community creator may not judge cases in their own community."""
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    # Bob submits, so alice is purely the creator (not the submitter).
    direct_vm.sender = direct_bob
    _mock(direct_vm, _llm_response("spam", 95))
    case_id = contract.submit_content(COMMUNITY_ID, "Buy cheap pills now")

    direct_vm.sender = direct_alice
    contract.register_agent("Creator Reviewer")
    with direct_vm.expect_revert("Community creator cannot review cases"):
        contract.review_case(case_id, "BLOCK", "my community, my call")

    assert contract.get_agent(to_hex(direct_alice))["reviews_total"] == 0

    # The independent party (bob, this case's submitter) is still blocked as
    # submitter — a true third party would be charlie.
    direct_vm.sender = direct_bob
    contract.register_agent("Bob Reviewer")
    with direct_vm.expect_revert("Submitter cannot review their own case"):
        contract.review_case(case_id, "BLOCK", "agrees with the verdict")


# ----------------------------------------------------------------------
# Revision history — prior rulings are never lost
# ----------------------------------------------------------------------


def test_case_history_append_only(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """submit -> flag -> resolve leaves a complete trail in the ledger."""
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    _mock(direct_vm, _llm_response("spam", 95))
    case_id = contract.submit_content(COMMUNITY_ID, "Buy cheap pills now")

    history = contract.get_case_history(case_id)
    assert len(history) == 1
    assert history[0].seq == 0
    assert history[0].action == "submit"
    assert history[0].decision == "BLOCK"
    assert history[0].confidence == 95
    assert history[0].note == ""
    assert to_hex(history[0].actor) == to_hex(direct_alice)

    direct_vm.sender = direct_alice
    contract.flag_for_human_review(case_id)
    contract.resolve_human_review(case_id, "ALLOW", "false positive, approved")

    history = contract.get_case_history(case_id)
    assert [rev.action for rev in history] == ["submit", "flag", "human_review"]
    assert [rev.seq for rev in history] == [0, 1, 2]
    # Prior decisions remain readable: submit=BLOCK, resolve=ALLOW.
    assert history[0].decision == "BLOCK"
    assert history[2].decision == "ALLOW"
    assert history[2].note == "false positive, approved"
    assert to_hex(history[2].actor) == to_hex(direct_alice)


def test_appeal_recorded_in_history(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    _mock(direct_vm, _llm_response("spam", 95))
    case_id = contract.submit_content(COMMUNITY_ID, "Buy cheap pills now")

    direct_vm.clear_mocks()
    _mock(direct_vm, _llm_response("none", 10), match=r"<appeal_argument>")
    contract.appeal_case(case_id, "This is a doctor-approved offer.")

    history = contract.get_case_history(case_id)
    assert [rev.action for rev in history] == ["submit", "appeal"]
    assert history[1].note == "This is a doctor-approved offer."
    assert history[1].decision == "ALLOW"
    # The first revision still holds the original BLOCK decision.
    assert history[0].decision == "BLOCK"


def test_history_unknown_case_fails(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/panoptes.py")

    with direct_vm.expect_revert("Unknown case"):
        contract.get_case_history("case-404")


# ----------------------------------------------------------------------
# Confidence bound by prompt (inter-validator tolerance exercised in integration)
# ----------------------------------------------------------------------


def test_prompt_requires_multiples_of_5(
    direct_vm, direct_deploy, direct_alice
):
    """Prompt must request multiples of 5 so confidence is consistent across validators.

    The mock only matches if the prompt contains this text — if the prompt
    changes, submit fails and this test turns red.
    """
    contract = direct_deploy("contracts/panoptes.py")
    _setup_community(direct_vm, contract, direct_alice)

    _mock(direct_vm, _llm_response("spam", 95), match=r"multiple of 5")
    case_id = contract.submit_content(COMMUNITY_ID, "Buy cheap pills now")
    assert contract.get_case(case_id).confidence == 95
