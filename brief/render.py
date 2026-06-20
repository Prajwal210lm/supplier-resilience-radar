PCT_KEYS = {"spend_share", "category_share", "top5_spend_share", "single_source_spend_share"}
INT_KEYS = {"skus_dependent", "skus_single_sourced", "avg_lead_time_weeks",
            "weeks_of_cover", "line_down_gap_weeks"}
KEY_MEANINGS = {
    "spend_share": "share of total procurement spend",
    "category_share": "share of this supplier's category spend",
    "skus_dependent": "finished models depending on this supplier",
    "skus_single_sourced": "of those, with no qualified alternative",
    "avg_lead_time_weeks": "replacement lead time",
    "weeks_of_cover": "on-hand cover on critical items",
    "line_down_gap_weeks": "weeks of production halt if they fail today",
    "concentration_score": "composite concentration score 0-100",
    "total_strategic_spend_aed": "total strategic procurement spend",
    "top5_spend_share": "share of spend in the top five suppliers",
    "single_source_spend_share": "share of spend through single-source suppliers",
}


def fmt(key, value):
    if key in PCT_KEYS:
        return f"{value*100:.1f}%"
    if key in INT_KEYS:
        return str(int(value))
    if key == "concentration_score":
        return f"{value:.1f}"
    if key == "total_strategic_spend_aed":
        return f"AED {value/1_000_000:.1f}M"
    return str(value)


def build_render_context(profile, suppliers) -> dict:
    from profile_core.builder import portfolio_headline
    h = portfolio_headline(suppliers)
    return {
        "spend_share": profile.spend_share, "category_share": profile.category_share,
        "skus_dependent": profile.skus_dependent,
        "skus_single_sourced": profile.skus_single_sourced,
        "avg_lead_time_weeks": profile.avg_lead_time_weeks,
        "weeks_of_cover": profile.weeks_of_cover,
        "line_down_gap_weeks": profile.line_down_gap_weeks,
        "concentration_score": profile.concentration_score,
        "total_strategic_spend_aed": h["total_strategic_spend_aed"],
        "top5_spend_share": h["top_n_spend_share"],
        "single_source_spend_share": h["single_source_spend_share"],
    }


def render_brief(brief, ctx):
    from brief.models import Claim, RiskBrief
    from brief.validate import TOKEN

    def sub(t):
        return TOKEN.sub(lambda m: fmt(m.group(1), ctx[m.group(1)]), t)

    def sc(cs):
        return [Claim(sub(c.text), c.citations) for c in cs]

    return RiskBrief(sc(brief.concentration_profile), sc(brief.risk_signals),
                     sc(brief.contract_implications), sc(brief.recommended_actions),
                     [sub(s) for s in brief.confidence])
