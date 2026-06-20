from typing import TypedDict

from typing_extensions import NotRequired

from langgraph.graph import END, START, StateGraph

from agent.research import run_research
from brief.render import build_render_context
from brief.synthesize import synthesize
from brief.validate import validate_and_render
from profile_core.builder import build_profile
from profile_core.loader import load_suppliers


class RadarState(TypedDict):
    supplier_id: str
    profile: NotRequired[object]
    render_ctx: NotRequired[dict]
    research: NotRequired[object]
    brief: NotRequired[object]
    violations: NotRequired[list]
    rendered_brief: NotRequired[object]


def build_graph(client, store):
    suppliers = load_suppliers()

    def profile_node(state):
        sid = state["supplier_id"]
        supplier = next((s for s in suppliers if s["supplier_id"] == sid), None)
        if supplier is None:
            raise KeyError(f"unknown supplier {sid}")
        profile = build_profile(supplier, suppliers)
        ctx = build_render_context(profile, suppliers)
        return {"profile": profile, "render_ctx": ctx}

    def research_node(state):
        return {"research": run_research(state["profile"], client, store)}

    def synthesize_node(state):
        brief = synthesize(state["profile"], state["research"], client, state["render_ctx"])
        return {"brief": brief}

    def validate_node(state):
        violations, rendered = validate_and_render(
            state["brief"], state["render_ctx"], state["research"].ledger)
        return {"violations": violations, "rendered_brief": rendered}

    g = StateGraph(RadarState)
    g.add_node("profile", profile_node)
    g.add_node("research", research_node)
    g.add_node("synthesize", synthesize_node)
    g.add_node("validate", validate_node)
    g.add_edge(START, "profile")
    g.add_edge("profile", "research")
    g.add_edge("research", "synthesize")
    g.add_edge("synthesize", "validate")
    g.add_edge("validate", END)
    return g.compile()


def run_assessment(supplier_id, client=None, store=None):
    if client is None:
        from anthropic import Anthropic
        client = Anthropic()
    if store is None:
        from rag.chunker import parse_contracts
        from rag.store import ContractStore
        store = ContractStore(parse_contracts())
    graph = build_graph(client, store)
    return graph.invoke({"supplier_id": supplier_id})
