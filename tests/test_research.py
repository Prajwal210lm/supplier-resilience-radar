import os
import types

import pytest

from agent.constants import MAX_RESEARCH_TURNS
from agent.research import SUBMIT_FINDINGS_TOOL, run_research


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def tu(name, input, id="tool_1"):
    """A tool_use content block."""
    return types.SimpleNamespace(type="tool_use", name=name, input=input, id=id)


def web(*pairs):
    """A web_search_tool_result block whose .content is web_search_result items."""
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
    """Records every create() call; returns scripted responses in order."""

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


@pytest.fixture
def profile():
    return types.SimpleNamespace(
        supplier_id="SUP-001",
        name="Rheinkomp Compressors",
        country="Germany",
        port_of_origin="Hamburg",
        category="compressors",
        spend_share=0.18,
        skus_single_sourced=9,
        line_down_gap_weeks=10,
        concentration_score=94.0,
    )


# --------------------------------------------------------------------------- #
# Tests
# --------------------------------------------------------------------------- #
def test_submit_tool_schema():
    assert SUBMIT_FINDINGS_TOOL["name"] == "submit_findings"
    props = SUBMIT_FINDINGS_TOOL["input_schema"]["properties"]
    assert "findings" in props
    assert "searched_found_nothing" in props
    item = props["findings"]["items"]
    assert item["properties"]["signal_type"]["enum"] == [
        "company", "country", "logistics", "contract"
    ]


def test_happy_path(profile):
    client = MockClient([
        response(
            "tool_use",
            web(("https://ex.com/energy", "German energy")),
            tu("contract_search", {"query": "force majeure"}, id="t_contract"),
        ),
        response(
            "tool_use",
            tu("submit_findings", {
                "findings": [
                    {"signal_type": "country", "claim": "energy costs up",
                     "source": "https://ex.com/energy", "relevance": "cost risk"},
                    {"signal_type": "contract", "claim": "FM excludes energy/freight",
                     "source": "SUP-001 Clause 2", "relevance": "no protection"},
                ],
                "searched_found_nothing": ["No public financials for Rheinkomp"],
            }, id="t_submit"),
        ),
    ])
    store = FakeStore()
    result = run_research(profile, client, store)

    assert result.turns == 2
    assert result.forced is False
    assert store.calls == ["SUP-001"]
    assert "https://ex.com/energy" in result.ledger.web_urls
    assert ("SUP-001", 2) in result.ledger.clause_refs
    assert len(result.findings) == 2
    assert len(result.dropped) == 0
    assert result.searched_found_nothing == ["No public financials for Rheinkomp"]


def test_iteration_cap_and_forced_fallback(profile):
    script = [
        response("tool_use", tu("contract_search", {"query": "q"}, id=f"t_{i}"))
        for i in range(MAX_RESEARCH_TURNS)
    ]
    script.append(
        response("tool_use", tu("submit_findings", {
            "findings": [],
            "searched_found_nothing": ["nothing conclusive"],
        }, id="t_forced"))
    )
    client = MockClient(script)
    store = FakeStore()
    result = run_research(profile, client, store)

    assert result.turns == MAX_RESEARCH_TURNS
    assert result.forced is True
    assert result.searched_found_nothing == ["nothing conclusive"]
    last_call = client.calls[-1]
    assert last_call["tool_choice"] == {"type": "tool", "name": "submit_findings"}


def test_fabricated_source_dropped(profile):
    client = MockClient([
        response(
            "tool_use",
            web(("https://real.com/x", "Real")),
            tu("contract_search", {"query": "fm"}, id="t_contract"),
        ),
        response(
            "tool_use",
            tu("submit_findings", {
                "findings": [
                    {"signal_type": "company", "claim": "real url",
                     "source": "https://real.com/x", "relevance": "r"},
                    {"signal_type": "company", "claim": "ghost url",
                     "source": "https://made-up.com/ghost", "relevance": "r"},
                    {"signal_type": "contract", "claim": "real clause",
                     "source": "SUP-001 Clause 2", "relevance": "r"},
                    {"signal_type": "contract", "claim": "ghost clause",
                     "source": "SUP-001 Clause 9", "relevance": "r"},
                ],
                "searched_found_nothing": [],
            }, id="t_submit"),
        ),
    ])
    store = FakeStore()
    result = run_research(profile, client, store)

    kept = {f.claim for f in result.findings}
    dropped = {f.claim for f in result.dropped}
    assert kept == {"real url", "real clause"}
    assert dropped == {"ghost url", "ghost clause"}


def test_unknown_signal_type_dropped(profile):
    client = MockClient([
        response(
            "tool_use",
            web(("https://ex.com/a", "A")),
            tu("contract_search", {"query": "fm"}, id="t_contract"),
        ),
        response(
            "tool_use",
            tu("submit_findings", {
                "findings": [
                    {"signal_type": "weather", "claim": "storm",
                     "source": "https://ex.com/a", "relevance": "r"},
                ],
                "searched_found_nothing": [],
            }, id="t_submit"),
        ),
    ])
    store = FakeStore()
    result = run_research(profile, client, store)

    kept = {f.claim for f in result.findings}
    dropped = {f.claim for f in result.dropped}
    assert "storm" not in kept
    assert "storm" in dropped


def test_pause_turn_handled(profile):
    client = MockClient([
        response("pause_turn", web(("https://ex.com/a", "A"))),
        response(
            "tool_use",
            tu("submit_findings", {
                "findings": [
                    {"signal_type": "company", "claim": "c",
                     "source": "https://ex.com/a", "relevance": "r"},
                ],
                "searched_found_nothing": [],
            }, id="t_submit"),
        ),
    ])
    store = FakeStore()
    result = run_research(profile, client, store)

    assert "https://ex.com/a" in result.ledger.web_urls
    assert len(result.findings) == 1


@pytest.mark.skipif(
    not os.environ.get("ANTHROPIC_API_KEY"),
    reason="requires ANTHROPIC_API_KEY for a live research run",
)
def test_integration_real():
    import anthropic

    from agent.models import FindingsLedger
    from profile_core.builder import build_profile
    from rag.chunker import parse_contracts
    from rag.store import ContractStore

    suppliers = __import__("json").load(
        open("data/suppliers.json", encoding="utf-8")
    )["suppliers"]
    sup = next(s for s in suppliers if s["supplier_id"] == "SUP-001")
    prof = build_profile(sup, suppliers)

    store = ContractStore(parse_contracts())
    client = anthropic.Anthropic()
    result = run_research(prof, client, store)

    from agent.models import ResearchFindings
    assert isinstance(result, ResearchFindings)
    for f in result.findings:
        if f.source.startswith("http"):
            assert f.source in result.ledger.web_urls
        else:
            parts = f.source.replace("Clause", "").split()
            supplier_id = parts[0]
            clause_number = int(parts[-1])
            assert (supplier_id, clause_number) in result.ledger.clause_refs
