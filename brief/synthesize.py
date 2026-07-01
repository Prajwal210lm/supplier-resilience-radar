from brief.constants import SYNTHESIS_MAX_TOKENS, SYNTHESIS_MODEL
from brief.models import Claim, RiskBrief
from brief.render import KEY_MEANINGS

CLAIM_SCHEMA = {"type": "object", "properties": {
    "text": {"type": "string"},
    "citations": {"type": "array", "items": {"type": "string"}}},
    "required": ["text", "citations"]}

SUBMIT_BRIEF_TOOL = {"name": "submit_brief",
    "description": "Submit the final five-section supplier risk brief.",
    "input_schema": {"type": "object", "properties": {
        "concentration_profile": {"type": "array", "items": CLAIM_SCHEMA},
        "risk_signals": {"type": "array", "items": CLAIM_SCHEMA},
        "contract_implications": {"type": "array", "items": CLAIM_SCHEMA},
        "recommended_actions": {"type": "array", "items": CLAIM_SCHEMA},
        "confidence": {"type": "array", "items": {"type": "string"}}},
        "required": ["concentration_profile", "risk_signals", "contract_implications",
                     "recommended_actions", "confidence"]}}

SYNTHESIS_SYSTEM_PROMPT = (
    "You are a supply chain risk analyst writing a board-level supplier risk brief "
    "for a GCC industrial chiller manufacturer. You are given research findings about "
    "one supplier and a set of approved numeric facts. Write a five-section brief.\n\n"
    "Sections: concentration_profile (our exposure, using the numeric placeholders); "
    "risk_signals (external risks from research, each citing its web URL); "
    "contract_implications (what our contract says, each citing a clause reference, "
    "and ONLY when contract clauses were actually retrieved); "
    "recommended_actions (what to do, each citing the finding it rests on); "
    "confidence (what research could not establish).\n\n"
    "Hard rules:\n"
    "- Write NO digit anywhere in any text. Every number appears ONLY as a placeholder "
    "token like {{spend_share}}, drawn only from the approved key list. The values are "
    "shown for calibration; never write the value itself.\n"
    "- Findings often name a numbered policy, law, tariff, or programme (for example a "
    "'Section 232' tariff, an 'Operation 300bn' programme, or a statute with a year). "
    "Never copy that numeral into the brief prose. Refer to it descriptively instead: "
    "'recent US import tariffs on steel', 'the UAE's national industrial-diversification "
    "strategy', 'Japan's energy-efficiency law'. Keep the source citation. If a fact "
    "exists only as a number you cannot render, omit the number, not the citation.\n"
    "- NEVER write a supplier identifier (the 'SUP-0XX' token, e.g. SUP-006) anywhere "
    "in the brief prose. Refer to the supplier by its name, or by role as 'this "
    "supplier'. A 'SUP-0XX' token may appear ONLY inside a clause reference in the "
    "citations field, never in any text. Mentioning the supplier by name is fine.\n"
    "- Refer to contract clauses by name in prose (e.g. 'the force majeure clause'), "
    "never by number. The formal reference goes in citations, not the text.\n"
    "- Put every source in the citations field, never in the prose.\n"
    "- Only cite sources that appear in the findings you were given; never invent a "
    "URL or a clause.\n"
    "- If a qualitative claim has no genuine retrieved source to cite, move it into the "
    "confidence section instead. Never fabricate a citation such as 'no output returned', "
    "and never copy the approved-facts calibration text as a citation.\n"
    "- risk_signals claims cite URLs; contract_implications claims cite clause references.\n"
    "- Every claim in risk_signals, contract_implications, recommended_actions carries "
    "at least one citation.\n"
    "Contract Implications, conditional on retrieval:\n"
    "- Write contract_implications ONLY from the contract clause references listed in "
    "the message, and cite one of those exact references on each claim.\n"
    "- If NO contract clauses were retrieved for this supplier, contract_implications "
    "MUST be an empty list (zero items). Do NOT name, infer, paraphrase, or cite any "
    "clause. Do NOT write the word 'Clause' or any clause reference. Do NOT invent "
    "contract terms, penalties, or clause numbers. No contract retrieved means no "
    "contract content. Instead, add one honest line to confidence stating that no "
    "contract is on file for this supplier, so contract terms could not be assessed.\n"
    "- If research found no signal for something, put it in confidence. confidence "
    "must be non-empty."
)


def build_synthesis_message(supplier_name, findings, gaps, ctx) -> str:
    lines = [
        f"Supplier under assessment: {supplier_name}. Refer to it by this name or as "
        "'this supplier'. Never write its SUP-0XX identifier in any text.",
        "",
        "Research findings:",
    ]
    for f in findings:
        lines.append(f"- [{f.signal_type}] {f.claim}  (source: {f.source}; {f.relevance})")

    # Make contract availability explicit so the model never invents a clause when
    # none was retrieved. Contract findings carry their clause reference as the source.
    contract_refs = [f.source for f in findings if f.signal_type == "contract"]
    lines.append("\nContract clauses retrieved for this supplier:")
    if contract_refs:
        for src in contract_refs:
            lines.append(f"- {src}")
        lines.append("Write contract_implications ONLY from these clause references and "
                     "cite the exact reference shown.")
    else:
        lines.append("- NONE. No contract is on file for this supplier.")
        lines.append("contract_implications MUST be an empty list. Do not name, infer, "
                     "or cite any clause, and do not write the word 'Clause'. Note in "
                     "confidence that no contract is on file for this supplier.")

    lines.append("\nResearch could not establish:")
    for g in gaps:
        lines.append(f"- {g}")
    lines.append("\nApproved numeric facts (placeholder key = value, for CALIBRATION "
                 "ONLY — never write the value, only the {{key}}):")
    for k, val in ctx.items():
        lines.append(f"- {{{{{k}}}}} = {val}  ({KEY_MEANINGS.get(k, '')})")
    lines.append("\nWrite the five-section brief and call submit_brief.")
    return "\n".join(lines)


def parse_brief(tool_input) -> "RiskBrief":
    def claims(key):
        return [Claim(c.get("text", ""), list(c.get("citations", [])))
                for c in tool_input.get(key, [])]
    return RiskBrief(claims("concentration_profile"), claims("risk_signals"),
                     claims("contract_implications"), claims("recommended_actions"),
                     list(tool_input.get("confidence", [])))


def synthesize(profile, research_findings, client, ctx):
    msg = build_synthesis_message(profile.name, research_findings.findings,
                                  research_findings.searched_found_nothing, ctx)
    resp = client.messages.create(model=SYNTHESIS_MODEL, max_tokens=SYNTHESIS_MAX_TOKENS,
             system=SYNTHESIS_SYSTEM_PROMPT,
             messages=[{"role": "user", "content": msg}],
             tools=[SUBMIT_BRIEF_TOOL],
             tool_choice={"type": "tool", "name": "submit_brief"})
    sb = next(b for b in resp.content if getattr(b, "type", None) == "tool_use"
              and b.name == "submit_brief")
    return parse_brief(sb.input)
