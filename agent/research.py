import re

from agent.constants import (
    ALLOWED_SIGNAL_TYPES,
    MAX_RESEARCH_TURNS,
    RESEARCH_MAX_TOKENS,
    RESEARCH_MODEL,
)
from agent.models import Finding, FindingsLedger, ResearchFindings
from agent.prompts import SYSTEM_PROMPT, build_first_message
from tools.contract_tool import CONTRACT_SEARCH_TOOL, run_contract_search
from tools.web_tool import WEB_SEARCH_TOOL, extract_web_findings

SUBMIT_FINDINGS_TOOL = {
    "name": "submit_findings",
    "description": "Submit your final research findings and stop. Call this when you "
        "have covered the four angles or have nothing further to find. Every finding "
        "must cite a source you actually retrieved.",
    "input_schema": {
        "type": "object",
        "properties": {
            "findings": {"type": "array", "items": {"type": "object", "properties": {
                "signal_type": {"type": "string",
                                "enum": ["company", "country", "logistics", "contract"]},
                "claim": {"type": "string"},
                "source": {"type": "string", "description": "exact URL retrieved, or a "
                           "contract clause reference like 'SUP-001 Clause 2'"},
                "relevance": {"type": "string"}},
                "required": ["signal_type", "claim", "source", "relevance"]}},
            "searched_found_nothing": {"type": "array", "items": {"type": "string"},
                "description": "angles you investigated but found no signal for"}},
        "required": ["findings", "searched_found_nothing"]}}

ALL_TOOLS = [WEB_SEARCH_TOOL, CONTRACT_SEARCH_TOOL, SUBMIT_FINDINGS_TOOL]


def parse_submit(tool_input):
    findings = [Finding(x.get("signal_type"), x.get("claim"), x.get("source"),
                        x.get("relevance")) for x in tool_input.get("findings", [])]
    return findings, list(tool_input.get("searched_found_nothing", []))


def _norm_clause(source):
    m = re.search(r"(SUP-\d+).*?Clause\s+(\d+)", source or "")
    return (m.group(1), int(m.group(2))) if m else None


def filter_against_ledger(raw_findings, ledger):
    kept, dropped = [], []
    for f in raw_findings:
        if f.signal_type not in ALLOWED_SIGNAL_TYPES:
            dropped.append(f)
            continue
        if f.signal_type == "contract":
            ok = _norm_clause(f.source) in ledger.clause_refs
        else:
            ok = f.source in ledger.web_urls
        (kept if ok else dropped).append(f)
    return kept, dropped


def run_research(profile, client, store):
    messages = [{"role": "user", "content": build_first_message(profile)}]
    ledger = FindingsLedger()
    raw, nothing, turns = None, [], 0
    while turns < MAX_RESEARCH_TURNS:
        turns += 1
        resp = client.messages.create(model=RESEARCH_MODEL, max_tokens=RESEARCH_MAX_TOKENS,
                 system=SYSTEM_PROMPT, messages=messages, tools=ALL_TOOLS)
        ledger.add_web(extract_web_findings(resp))
        if resp.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": resp.content})
            continue
        tool_uses = [b for b in resp.content if getattr(b, "type", None) == "tool_use"]
        if not tool_uses:
            messages.append({"role": "assistant", "content": resp.content})
            break
        messages.append({"role": "assistant", "content": resp.content})
        results, submitted = [], False
        for tb in tool_uses:
            if tb.name == "contract_search":
                r = run_contract_search(tb.input, supplier_id=profile.supplier_id, store=store)
                ledger.add_contract(r.chunks)
                results.append({"type": "tool_result", "tool_use_id": tb.id, "content": r.text})
            elif tb.name == "submit_findings":
                raw, nothing = parse_submit(tb.input)
                submitted = True
        if submitted:
            break
        messages.append({"role": "user", "content": results})
    forced = False
    if raw is None:
        forced = True
        if messages[-1]["role"] == "assistant":
            messages.append({"role": "user", "content": "You have finished researching. "
                "Call submit_findings now with everything you found, and list anything you "
                "searched for but could not find."})
        resp = client.messages.create(model=RESEARCH_MODEL, max_tokens=RESEARCH_MAX_TOKENS,
                 system=SYSTEM_PROMPT, messages=messages, tools=ALL_TOOLS,
                 tool_choice={"type": "tool", "name": "submit_findings"})
        sb = next((b for b in resp.content if getattr(b, "type", None) == "tool_use"
                   and b.name == "submit_findings"), None)
        raw, nothing = parse_submit(sb.input) if sb else ([], ["agent did not submit"])
    kept, dropped = filter_against_ledger(raw, ledger)
    return ResearchFindings(kept, nothing, ledger, dropped, turns, forced)
