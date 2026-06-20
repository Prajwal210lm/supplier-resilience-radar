import types
from unittest.mock import MagicMock

from rag.models import ContractChunk
from tools.contract_tool import CONTRACT_SEARCH_TOOL, run_contract_search
from tools.web_tool import WEB_SEARCH_TOOL, extract_web_findings, search_web


class FakeStore:
    def __init__(self):
        self.calls = []

    def contract_search(self, query, supplier_id=None, k=3):
        self.calls.append({"query": query, "supplier_id": supplier_id, "k": k})
        return [
            ContractChunk(
                supplier_id=supplier_id,
                contract_reference="REF-X",
                clause_number=2,
                clause_title="Force Majeure",
                text="A party claiming force majeure must give written notice "
                     "within five (5) business days of the event.",
            ),
            ContractChunk(
                supplier_id=supplier_id,
                contract_reference="REF-X",
                clause_number=8,
                clause_title="Termination",
                text="Either party may terminate for material breach.",
            ),
        ]


def _web_response():
    return types.SimpleNamespace(
        content=[
            types.SimpleNamespace(type="server_tool_use"),
            types.SimpleNamespace(
                type="web_search_tool_result",
                content=[
                    types.SimpleNamespace(
                        type="web_search_result",
                        url="https://example.com/a",
                        title="Result A",
                        page_age="2025-01-01",
                    ),
                    types.SimpleNamespace(
                        type="web_search_result",
                        url="https://example.com/b",
                        title="Result B",
                        page_age=None,
                    ),
                ],
            ),
            types.SimpleNamespace(type="text"),
        ]
    )


def test_contract_tool_schema():
    assert CONTRACT_SEARCH_TOOL["name"] == "contract_search"
    assert "query" in CONTRACT_SEARCH_TOOL["input_schema"]["properties"]
    assert "supplier_id" not in CONTRACT_SEARCH_TOOL["input_schema"]["properties"]


def test_contract_binding_and_passthrough():
    fs = FakeStore()
    result = run_contract_search(
        {"query": "force majeure notice period"},
        supplier_id="SUP-001",
        store=fs,
    )
    assert len(fs.calls) == 1
    call = fs.calls[0]
    assert call["supplier_id"] == "SUP-001"
    assert call["query"] == "force majeure notice period"
    assert call["k"] == 3
    assert all(c.supplier_id == "SUP-001" for c in result.chunks)
    assert result.chunks[0].clause_number == 2
    assert result.chunks[0].clause_title == "Force Majeure"
    assert "SUP-001" in result.text


def test_contract_poisoned_form():
    fs = FakeStore()
    run_contract_search(
        {"query": "force majeure", "supplier_id": "SUP-004", "k": 2},
        supplier_id="SUP-001",
        store=fs,
    )
    assert len(fs.calls) == 1
    call = fs.calls[0]
    assert call["supplier_id"] == "SUP-001"
    assert call["k"] == 2


def test_web_tool_config():
    assert WEB_SEARCH_TOOL["type"] == "web_search_20250305"
    assert WEB_SEARCH_TOOL["name"] == "web_search"
    assert WEB_SEARCH_TOOL["max_uses"] == 5


def test_extract_web_findings():
    findings = extract_web_findings(_web_response())
    assert len(findings) == 2
    assert findings[0].url == "https://example.com/a"
    assert findings[0].title == "Result A"
    assert findings[1].url == "https://example.com/b"
    assert findings[1].title == "Result B"


def test_search_web_mocked():
    client = MagicMock()
    client.messages.create.return_value = _web_response()
    findings = search_web(client, "any prompt")
    assert len(findings) == 2
    assert client.messages.create.call_count == 1
    _, kwargs = client.messages.create.call_args
    assert WEB_SEARCH_TOOL in kwargs["tools"]
