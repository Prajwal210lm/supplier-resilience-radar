import os
import types

import pytest

from pipeline.graph import run_assessment


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def tu(name, input, id="tool_1"):
    return types.SimpleNamespace(type="tool_use", name=name, input=input, id=id)


def web(*pairs):
    return types.SimpleNamespace(
        type="web_search_tool_result",
        content=[
            types.SimpleNamespace(
                type="web_search_result", url=url, title=title, page_age=None
            )
            for url, title in pairs
        ],
    )


def response(stop_reason, *blocks):
    return types.SimpleNamespace(stop_reason=stop_reason, content=list(blocks))


class MockClient:
    def __init__(self, script):
        self.script = list(script)
        self.calls = []
        self.messages = types.SimpleNamespace(create=self._create)

    def _create(self, **kw):
        self.calls.append(kw)
        if self.script:
            return self.script.pop(0)
        return response("end_turn", types.SimpleNamespace(type="text", text="done"))


class FakeStore:
    def __init__(self):
        self.calls = []

    def contract_search(self, query, supplier_id=None, k=3):
        self.calls.append(supplier_id)
        return [
            types.SimpleNamespace(
                supplier_id=supplier_id,
                contract_reference="RK-2023-001",
                clause_number=2,
                clause_title="Force Majeure",
                text="A party claiming force majeure must give written notice within "
                     "five (5) business days... excludes energy and freight...",
            )
        ]


URL = "https://reuters.com/energy"


def _script():
    research_r1 = response(
        "tool_use",
        web((URL, "German energy")),
        tu("contract_search", {"query": "force majeure"}, id="t_contract"),
    )
    research_r2 = response(
        "tool_use",
        tu("submit_findings", {
            "findings": [
                {"signal_type": "country", "claim": "energy costs up",
                 "source": URL, "relevance": "cost risk"},
                {"signal_type": "contract", "claim": "FM excludes energy/freight",
                 "source": "SUP-001 Clause 2", "relevance": "no protection"},
            ],
            "searched_found_nothing": ["No public financials for Rheinkomp"],
        }, id="t_submit"),
    )
    synth = response(
        "tool_use",
        tu("submit_brief", {
            "concentration_profile": [{"text":
                "This supplier holds {{spend_share}} of spend with a concentration "
                "score of {{concentration_score}} and a line-down gap of "
                "{{line_down_gap_weeks}} weeks.", "citations": []}],
            "risk_signals": [{"text":
                "German energy costs have risen sharply, raising supply-interruption "
                "risk.", "citations": [URL]}],
            "contract_implications": [{"text":
                "The force majeure clause excludes energy and freight, leaving no "
                "contractual relief.", "citations": ["SUP-001 Clause 2"]}],
            "recommended_actions": [{"text":
                "Qualify an alternative compressor source.",
                "citations": [URL, "SUP-001 Clause 2"]}],
            "confidence": ["No public financial filings were found; request audited "
                           "financials."],
        }, id="t_brief"),
    )
    return [research_r1, research_r2, synth]


# --------------------------------------------------------------------------- #
# Tests
# --------------------------------------------------------------------------- #
def test_end_to_end_mocked():
    client = MockClient(_script())
    store = FakeStore()
    final = run_assessment("SUP-001", client=client, store=store)

    for key in ("profile", "research", "brief", "rendered_brief"):
        assert key in final
    assert final["violations"] == []
    assert final["rendered_brief"] is not None

    text = final["rendered_brief"].concentration_profile[0].text
    assert "18.0%" in text
    assert "94.0" in text
    assert "10 weeks" in text
    assert "{{" not in text

    assert "SUP-001" in store.calls


@pytest.mark.skipif(
    not os.environ.get("ANTHROPIC_API_KEY"),
    reason="requires ANTHROPIC_API_KEY for a live end-to-end run",
)
def test_integration_real():
    from brief.validate import parse_clause

    final = run_assessment("SUP-001")

    for key in ("profile", "research", "brief"):
        assert key in final

    ledger = final["research"].ledger
    brief = final["brief"]
    sections = (brief.concentration_profile, brief.risk_signals,
                brief.contract_implications, brief.recommended_actions)
    for section in sections:
        for claim in section:
            for cit in claim.citations:
                if cit.strip().lower().startswith("http"):
                    assert cit in ledger.web_urls
                else:
                    pc = parse_clause(cit)
                    assert pc is not None
                    assert pc in ledger.clause_refs

    assert brief.confidence
