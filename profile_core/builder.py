from dataclasses import dataclass

from profile_core import metrics
from profile_core.loader import category_total, total_spend


@dataclass
class SupplierProfile:
    supplier_id: str
    name: str
    country: str
    port_of_origin: str
    category: str
    annual_spend_aed: int
    skus_dependent: int
    skus_single_sourced: int
    avg_lead_time_weeks: int
    weeks_of_cover: int
    spend_share: float
    line_down_gap_weeks: int
    category_share: float
    category_dominant: bool
    spend_score: float
    single_source_score: float
    gap_score: float
    category_score: float
    concentration_score: float


def build_profile(supplier: dict, suppliers: list[dict]) -> SupplierProfile:
    total = total_spend(suppliers)
    cat_total = category_total(suppliers, supplier["category"])

    spend_share_value = metrics.spend_share(supplier["annual_spend_aed"], total)
    line_down_gap_weeks_value = metrics.line_down_gap_weeks(
        supplier["avg_lead_time_weeks"], supplier["weeks_of_cover"]
    )
    category_share_value = metrics.category_share(supplier["annual_spend_aed"], cat_total)
    category_dominant = metrics.is_category_dominant(category_share_value)

    spend_score_value = metrics.spend_score(spend_share_value)
    single_source_score_value = metrics.single_source_score(supplier["skus_single_sourced"])
    gap_score_value = metrics.gap_score(line_down_gap_weeks_value)
    category_score_value = metrics.category_score(category_dominant)
    concentration_score_value = metrics.concentration_score(
        spend_share_value,
        supplier["skus_single_sourced"],
        line_down_gap_weeks_value,
        category_dominant,
    )

    return SupplierProfile(
        supplier_id=supplier["supplier_id"],
        name=supplier["name"],
        country=supplier["country"],
        port_of_origin=supplier["port_of_origin"],
        category=supplier["category"],
        annual_spend_aed=supplier["annual_spend_aed"],
        skus_dependent=supplier["skus_dependent"],
        skus_single_sourced=supplier["skus_single_sourced"],
        avg_lead_time_weeks=supplier["avg_lead_time_weeks"],
        weeks_of_cover=supplier["weeks_of_cover"],
        spend_share=spend_share_value,
        line_down_gap_weeks=line_down_gap_weeks_value,
        category_share=category_share_value,
        category_dominant=category_dominant,
        spend_score=spend_score_value,
        single_source_score=single_source_score_value,
        gap_score=gap_score_value,
        category_score=category_score_value,
        concentration_score=concentration_score_value,
    )


def portfolio_headline(suppliers: list[dict], top_n: int = 5) -> dict:
    total = total_spend(suppliers)
    top_spend = sum(
        s["annual_spend_aed"]
        for s in sorted(suppliers, key=lambda s: s["annual_spend_aed"], reverse=True)[:top_n]
    )
    single_source_spend = sum(
        s["annual_spend_aed"] for s in suppliers if s["skus_single_sourced"] > 0
    )
    return {
        "total_strategic_spend_aed": total,
        "top_n_spend_share": round(top_spend / total, 4),
        "single_source_spend_share": round(single_source_spend / total, 4),
    }
