import re

TOKEN = re.compile(r"\{\{(\w+)\}\}")

QUAL_SECTIONS = ("risk_signals", "contract_implications", "recommended_actions")


def is_url(s):
    return s.strip().lower().startswith("http")


def parse_clause(s):
    m = re.search(r"(SUP-\d+).*?Clause\s+(\d+)", s or "")
    return (m.group(1), int(m.group(2))) if m else None


def validate(brief, ctx, ledger) -> list:
    v = []
    text_claims = (brief.concentration_profile + brief.risk_signals +
                   brief.contract_implications + brief.recommended_actions)
    for c in text_claims:                                   # V1
        for key in TOKEN.findall(c.text):
            if key not in ctx:
                v.append(f"V1: {key}")
    for c in text_claims:                                   # V2
        if any(ch.isdigit() for ch in TOKEN.sub("", c.text)):
            v.append(f"V2: {c.text[:40]}")
    for s in brief.confidence:
        if any(ch.isdigit() for ch in s):
            v.append(f"V2: {s[:40]}")
    for c in text_claims:                                   # V3 / V4
        for cit in c.citations:
            if is_url(cit):
                if cit not in ledger.web_urls:
                    v.append(f"V3: {cit}")
            else:
                pc = parse_clause(cit)
                if pc is None:
                    v.append(f"V3: {cit}")
                elif pc not in ledger.clause_refs:
                    v.append(f"V4: {cit}")
    for sec in QUAL_SECTIONS:                               # V5
        for c in getattr(brief, sec):
            if not c.citations:
                v.append(f"V5: {sec}")
    for c in brief.risk_signals:                            # V6
        if any(not is_url(cit) for cit in c.citations):
            v.append("V6: risk_signals non-url")
    for c in brief.contract_implications:
        if any(is_url(cit) for cit in c.citations):
            v.append("V6: contract url")
    if not brief.confidence:                                # V7
        v.append("V7: confidence empty")
    return v


def validate_and_render(brief, ctx, ledger):
    from brief.render import render_brief
    violations = validate(brief, ctx, ledger)
    if violations:
        return violations, None
    return [], render_brief(brief, ctx)
