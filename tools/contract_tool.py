from dataclasses import dataclass

from rag.models import ContractChunk

CONTRACT_SEARCH_TOOL = {
    "name": "contract_search",
    "description": "Search THIS supplier's own contract for clauses relevant to a "
                   "question. Returns the most relevant clauses from this supplier's "
                   "contract only. Use it to check what the contract says about a risk "
                   "you've identified: force majeure scope, notice periods, penalties, "
                   "alternative sourcing rights, termination.",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "what to look for, in plain words"},
            "k": {"type": "integer", "description": "how many clauses to return", "default": 3},
        },
        "required": ["query"],
    },
}
# NOTE: no supplier_id property. The executor injects the run-bound supplier_id.


@dataclass
class ContractToolResult:
    text: str
    chunks: list


def format_clauses(chunks) -> str:
    return "\n\n".join(
        f"[{c.supplier_id} · Clause {c.clause_number} · {c.clause_title}]\n{c.text}"
        for c in chunks
    )


def run_contract_search(tool_input: dict, supplier_id: str, store) -> ContractToolResult:
    query = tool_input["query"]
    k = tool_input.get("k", 3)
    # read ONLY query and k from tool_input; never read tool_input["supplier_id"]
    chunks = store.contract_search(query, supplier_id=supplier_id, k=k)
    return ContractToolResult(text=format_clauses(chunks), chunks=chunks)
