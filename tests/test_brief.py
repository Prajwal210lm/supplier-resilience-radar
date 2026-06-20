import json
import types

import pytest

from brief.models import Claim, RiskBrief
from brief.render import build_render_context
from brief.synthesize import SUBMIT_BRIEF_TOOL, parse_brief, synthesize
from brief.validate import validate, validate_and_render


# --------------------------------------------------------------------------- #
# Shared fixtures / helpers
# --------------------------------------------------------------------------- #
CTX = {
    "spend_share": 0.18,
    "category_share": 0.6207,
    "skus_dependent": 12,
    "skus_single_sourced": 9,
    "avg_lead_time_weeks": 16,
    "weeks_of_cover": 6,
    "line_down_gap_weeks": 10,
    "concentration_score": 94.0,
    "total_strategic_spend_aed": 480000000,
    "top5_spend_share": 0.55,
    "single_source_spend_share": 0.50,
}


@pytest.fixture
def ledger():
    return types.SimpleNamespace(
        web_urls={"https://reuters.com/energy"},
        clause_refs={("SUP-001", 2)},
    )


def base_clean():
    """A fully correct RiskBrief that must survive validation."""
    return RiskBrief(
        concentration_profile=[
            Claim(
                text="Concentration is severe: this supplier is {{spend_share}} of "
                     "total spend with a concentration score of {{concentration_score}}, "
                     "and a failure today opens a production gap of "
                     "{{line_down_gap_weeks}} weeks.",
                citations=[],
            )
        ],
        risk_signals=[
            Claim(
                text="European energy prices have spiked, lifting the supplier's "
                     "operating costs.",
                citations=["https://reuters.com/energy"],
            )
        ],
        contract_implications=[
            Claim(
                text="Under the force majeure clause, the supplier is not shielded "
                     "from energy or freight disruption, so it stays on the hook.",
                citations=["SUP-001 Clause 2"],
            )
        ],
        recommended_actions=[
            Claim(
                text="Qualify a second compressor source and renegotiate the force "
                     "majeure clause to widen notice relief.",
                citations=["https://reuters.com/energy", "SUP-001 Clause 2"],
            )
        ],
        confidence=[
            "No public financial filings were found; request audited financials."
        ],
    )


def fired(violations, code):
    """True if any violation string carries the given V-code."""
    return any(str(v).startswith(code) for v in violations)


def _claim_to_dict(c):
    return {"text": c.text, "citations": list(c.citations)}


def _brief_to_input(brief):
    return {
        "concentration_profile": [_claim_to_dict(c) for c in brief.concentration_profile],
        "risk_signals": [_claim_to_dict(c) for c in brief.risk_signals],
        "contract_implications": [_claim_to_dict(c) for c in brief.contract_implications],
        "recommended_actions": [_claim_to_dict(c) for c in brief.recommended_actions],
        "confidence": list(brief.confidence),
    }


class MockClient:
    def __init__(self, response):
        self._response = response
        self.calls = []
        self.messages = types.SimpleNamespace(create=self._create)

    def _create(self, **kw):
        self.calls.append(kw)
        return self._response


# --------------------------------------------------------------------------- #
# Schema + synthesize
# --------------------------------------------------------------------------- #
def test_submit_brief_schema():
    assert SUBMIT_BRIEF_TOOL["name"] == "submit_brief"
    props = SUBMIT_BRIEF_TOOL["input_schema"]["properties"]
    for section in ("concentration_profile", "risk_signals", "contract_implications",
                    "recommended_actions", "confidence"):
        assert section in props
    item = props["risk_signals"]["items"]
    assert "text" in item["properties"]
    assert "citations" in item["properties"]


def test_synthesize_forces_tool_and_parses():
    canned = types.SimpleNamespace(
        stop_reason="tool_use",
        content=[
            types.SimpleNamespace(
                type="tool_use",
                name="submit_brief",
                id="b_1",
                input=_brief_to_input(base_clean()),
            )
        ],
    )
    client = MockClient(canned)
    profile = types.SimpleNamespace(
        supplier_id="SUP-001", name="Rheinkomp Compressors", country="Germany",
        port_of_origin="Hamburg", category="compressors",
    )
    research_findings = types.SimpleNamespace(
        findings=[types.SimpleNamespace(
            signal_type="country", claim="energy up",
            source="https://reuters.com/energy", relevance="cost")],
        searched_found_nothing=["No public financials"],
    )
    brief = synthesize(profile, research_findings, client, CTX)

    assert isinstance(brief, RiskBrief)
    assert brief.concentration_profile and brief.risk_signals
    assert brief.contract_implications and brief.recommended_actions
    assert brief.confidence
    _, kwargs = client.calls[-1], client.calls[-1]
    assert client.calls[-1]["tool_choice"] == {"type": "tool", "name": "submit_brief"}


# --------------------------------------------------------------------------- #
# Validation — positive
# --------------------------------------------------------------------------- #
def test_synthesized_brief_passes_validate(ledger):
    assert validate(base_clean(), CTX, ledger) == []


# --------------------------------------------------------------------------- #
# Validation — one defect each
# --------------------------------------------------------------------------- #
def test_v1_orphaned_placeholder(ledger):
    brief = base_clean()
    brief.concentration_profile.append(Claim(text="{{revenue}} and {{spend_shr}}"))
    assert fired(validate(brief, CTX, ledger), "V1")


def test_v2_bare_digit(ledger):
    brief = base_clean()
    brief.risk_signals.append(
        Claim(text="Spend share is 18% of total.",
              citations=["https://reuters.com/energy"])
    )
    assert fired(validate(brief, CTX, ledger), "V2")


def test_v3_fabricated_url(ledger):
    brief = base_clean()
    brief.risk_signals.append(
        Claim(text="Unrest reported near the plant.",
              citations=["https://made-up.com/ghost"])
    )
    assert fired(validate(brief, CTX, ledger), "V3")


def test_v4_cross_supplier_clause(ledger):
    brief = base_clean()
    brief.contract_implications.append(
        Claim(text="A neighbouring force majeure clause is narrower.",
              citations=["SUP-004 Clause 2"])
    )
    assert fired(validate(brief, CTX, ledger), "V4")


def test_v4_nonexistent_clause(ledger):
    brief = base_clean()
    brief.contract_implications.append(
        Claim(text="A later force majeure clause adds relief.",
              citations=["SUP-001 Clause 9"])
    )
    assert fired(validate(brief, CTX, ledger), "V4")


def test_v5_uncited_qualitative(ledger):
    brief = base_clean()
    brief.risk_signals.append(Claim(text="Local strikes are spreading.", citations=[]))
    assert fired(validate(brief, CTX, ledger), "V5")


def test_v6_contract_cites_url(ledger):
    brief = base_clean()
    brief.contract_implications.append(
        Claim(text="The force majeure clause is referenced online.",
              citations=["https://reuters.com/energy"])
    )
    assert fired(validate(brief, CTX, ledger), "V6")


def test_v6_signal_cites_clause(ledger):
    brief = base_clean()
    brief.risk_signals.append(
        Claim(text="An external signal that wrongly points at a clause.",
              citations=["SUP-001 Clause 2"])
    )
    assert fired(validate(brief, CTX, ledger), "V6")


def test_v7_empty_confidence(ledger):
    brief = base_clean()
    brief.confidence = []
    assert fired(validate(brief, CTX, ledger), "V7")


# --------------------------------------------------------------------------- #
# Render gate
# --------------------------------------------------------------------------- #
def test_positive_control_renders(ledger):
    violations, rendered = validate_and_render(base_clean(), CTX, ledger)
    assert violations == []
    assert rendered is not None
    text = rendered.concentration_profile[0].text
    assert "18.0%" in text
    assert "94.0" in text
    assert "10 weeks" in text
    assert "{{" not in text


def test_render_refused_on_violation(ledger):
    brief = base_clean()
    brief.risk_signals.append(
        Claim(text="Spend share is 18% of total.",
              citations=["https://reuters.com/energy"])
    )
    violations, rendered = validate_and_render(brief, CTX, ledger)
    assert violations
    assert rendered is None


# --------------------------------------------------------------------------- #
# Render context built from real profile
# --------------------------------------------------------------------------- #
def test_build_render_context():
    from profile_core.builder import build_profile

    with open("data/suppliers.json", encoding="utf-8") as f:
        suppliers = json.load(f)["suppliers"]
    sup = next(s for s in suppliers if s["supplier_id"] == "SUP-001")
    profile = build_profile(sup, suppliers)

    ctx = build_render_context(profile, suppliers)
    assert ctx["spend_share"] == 0.18
    assert ctx["concentration_score"] == 94.0
    assert ctx["line_down_gap_weeks"] == 10
    assert ctx["total_strategic_spend_aed"] == 480000000
    assert ctx["top5_spend_share"] == 0.55
    assert ctx["single_source_spend_share"] == 0.50
